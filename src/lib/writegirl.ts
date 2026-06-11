import { DateTime } from "luxon";
import type {
  EventFormat,
  PriceKind,
  WorkshopEvent,
  WorkshopEventCategory,
} from "@/lib/workshop-types";
import { stripHtmlAndDecode, toShortOverview } from "@/lib/text";

const ORIGIN = "https://www.writegirl.org";
const CALENDAR_URL = `${ORIGIN}/calendar-view`;
const WIDGET_ID = "bc266c31-93ce-49e2-a93d-e663d611ed59";
const TZ = "America/Los_Angeles";

const UA =
  "calendar_literary/1.0 (+https://github.com/taraprakash06/literary-events-calendar)";

export type WriteGirlMeta = {
  eventsFetched: number;
  rowsInMonth: number;
};

type ElfsightDatePart = {
  date?: string | null;
  time?: string | null;
  dateTime?: string | null;
  type?: string;
};

type ElfsightEvent = {
  id: string;
  name: string;
  start: ElfsightDatePart;
  end?: ElfsightDatePart;
  description?: string;
  venue?: { name?: string; address?: string } | null;
  buttonLink?: string | null;
};

type ElfsightEventsResponse = {
  code?: number;
  payload?: ElfsightEvent[];
};

async function fetchJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(url, {
    headers: { Accept: "application/json", "User-Agent": UA },
    cache: "no-store",
    signal,
  });
  if (!res.ok) {
    throw new Error(`WriteGirl Elfsight HTTP ${res.status} for ${url}`);
  }
  return res.json() as Promise<T>;
}

async function fetchBootCredentials(signal?: AbortSignal): Promise<{
  token: string;
  sourceId: string;
}> {
  const page = encodeURIComponent(CALENDAR_URL);
  const bootUrl = `https://core.service.elfsight.com/p/boot/?page=${page}&w=${WIDGET_ID}`;
  const boot = await fetchJson<{
    data?: {
      widgets?: Record<
        string,
        {
          data?: {
            public_widget_token?: string;
            settings?: {
              integrationGoogleCalendar?: { source?: string };
            };
          };
        }
      >;
    };
  }>(bootUrl, signal);

  const widget = boot.data?.widgets?.[WIDGET_ID]?.data;
  const token = widget?.public_widget_token?.trim();
  const sourceId = widget?.settings?.integrationGoogleCalendar?.source?.trim();
  if (!token || !sourceId) {
    throw new Error("WriteGirl: could not read Elfsight calendar credentials");
  }
  return { token, sourceId };
}

function parseElfsightInstant(part: ElfsightDatePart, zone: string): DateTime | null {
  if (part.dateTime) {
    const dt = DateTime.fromISO(part.dateTime, { setZone: true }).setZone(zone);
    return dt.isValid ? dt : null;
  }
  if (part.date) {
    const time = (part.time ?? "00:00").trim();
    const dt = DateTime.fromFormat(`${part.date} ${time}`, "yyyy-MM-dd HH:mm", {
      zone,
    });
    return dt.isValid ? dt : null;
  }
  return null;
}

function inferCategory(title: string, description: string): WorkshopEventCategory {
  const b = `${title}\n${description}`.toLowerCase();
  if (/\b(open mic|poetry slam)\b/.test(b)) return "open-mic";
  if (/\b(college|info session)\b/.test(b)) return "other";
  if (/\b(reading|public reading)\b/.test(b)) return "reading";
  if (/\b(workshop|writing session|songwriting)\b/.test(b)) return "workshop";
  return "workshop";
}

function inferFormat(title: string, description: string): EventFormat {
  const b = `${title}\n${description}`.toLowerCase();
  if (/\b(online|virtual|zoom)\b/.test(b)) return "virtual";
  return "in-person";
}

function isPublicEvent(title: string, description: string): boolean {
  const b = `${title}\n${description}`.toLowerCase();
  return /\bpublic\b/.test(b);
}

function stableId(elfsightId: string, start: DateTime): string {
  return `writegirl-${elfsightId}-${start.toFormat("yyyyLLddHHmm")}`;
}

function mapEvent(raw: ElfsightEvent): WorkshopEvent | null {
  const start = parseElfsightInstant(raw.start, TZ);
  if (!start) return null;

  const endPart = raw.end ?? raw.start;
  let end = parseElfsightInstant(endPart, TZ);
  if (!end || end <= start) end = start.plus({ hours: 2 });

  const title = raw.name.replace(/\s+/g, " ").trim();
  if (!title) return null;

  const descriptionHtml = raw.description ?? "";
  const description =
    toShortOverview(stripHtmlAndDecode(descriptionHtml), 520) || title;
  const format = inferFormat(title, description);
  const publicEvent = isPublicEvent(title, description);

  const venueName = raw.venue?.name?.trim();
  const address = raw.venue?.address?.trim();

  return {
    id: stableId(raw.id, start),
    cityId: "la",
    title,
    tagline: publicEvent ? "WriteGirl (public event)" : "WriteGirl",
    description,
    start: start.toISO() ?? start.toString(),
    end: end.toISO() ?? undefined,
    timeZone: TZ,
    format,
    price: "unknown" as PriceKind,
    category: inferCategory(title, description),
    organizer: "WriteGirl",
    venue:
      format === "virtual"
        ? "WriteGirl"
        : venueName
          ? `WriteGirl — ${venueName}`
          : "WriteGirl",
    address:
      format === "virtual"
        ? undefined
        : address || "Los Angeles, CA",
    neighborhood: "Los Angeles",
    virtualLabel: format === "virtual" ? "Online (WriteGirl)" : undefined,
    rsvpUrl: raw.buttonLink?.trim() || CALENDAR_URL,
    source: "WriteGirl (writegirl.org)",
    sourceChannel: "literary_org",
    listingProvenance: "live",
  };
}

export async function fetchWriteGirlEventsForMonth(
  year: number,
  monthIndex: number,
  signal?: AbortSignal,
): Promise<{ events: WorkshopEvent[]; meta: WriteGirlMeta }> {
  const monthStart = DateTime.fromObject(
    { year, month: monthIndex + 1, day: 1 },
    { zone: TZ },
  ).startOf("day");
  const monthEnd = monthStart.endOf("month").endOf("day");

  const { token, sourceId } = await fetchBootCredentials(signal);
  const from = monthStart.toUTC().toISO() ?? monthStart.toString();
  const to = monthEnd.toUTC().toISO() ?? monthEnd.toString();

  const u = new URL("https://widget-data.service.elfsight.com/api/events");
  u.searchParams.set("source", sourceId);
  u.searchParams.set("from", from);
  u.searchParams.set("to", to);
  u.searchParams.set("timeZone", TZ);
  u.searchParams.set("widget-token", token);

  const body = await fetchJson<ElfsightEventsResponse>(u.toString(), signal);
  const rows = (body.payload ?? [])
    .map(mapEvent)
    .filter((e): e is WorkshopEvent => e !== null)
    .filter((e) => {
      const start = DateTime.fromISO(e.start, { setZone: true }).setZone(TZ);
      return start.isValid && start >= monthStart && start <= monthEnd;
    });

  rows.sort(
    (a, b) => new Date(a.start).getTime() - new Date(b.start).getTime(),
  );

  return {
    events: rows,
    meta: {
      eventsFetched: body.payload?.length ?? 0,
      rowsInMonth: rows.length,
    },
  };
}
