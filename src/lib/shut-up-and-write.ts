import { DateTime } from "luxon";
import type { WorkshopEvent } from "@/lib/workshop-types";

const TZ = "America/Los_Angeles";
const ORIGIN = "https://www.meetup.com";
export const SHUT_UP_AND_WRITE_EVENT_URL =
  "https://www.meetup.com/shutupandwritesfo/events/314807057/";

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

export type ShutUpAndWriteMeta = {
  pageFetched: boolean;
  recurring: boolean;
  instancesInMonth: number;
};

type MeetupVenue = {
  name?: string;
  address?: string;
  city?: string;
  state?: string;
};

type MeetupEvent = {
  id?: string;
  title?: string;
  description?: string;
  eventUrl?: string;
  dateTime?: string;
  endTime?: string;
  eventHosts?: { name?: string }[];
  venue?: MeetupVenue;
  series?: { description?: string };
};

function parseNextDataEvent(html: string): MeetupEvent | null {
  const m = html.match(
    /<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/i,
  );
  if (!m) return null;
  try {
    const data = JSON.parse(m[1]) as {
      props?: { pageProps?: { event?: MeetupEvent } };
    };
    return data.props?.pageProps?.event ?? null;
  } catch {
    return null;
  }
}

function weekdayFromSeriesDescription(desc: string | undefined): number | null {
  if (!desc) return null;
  const days: Record<string, number> = {
    monday: 1,
    tuesday: 2,
    wednesday: 3,
    thursday: 4,
    friday: 5,
    saturday: 6,
    sunday: 7,
  };
  const lower = desc.toLowerCase();
  for (const [name, weekday] of Object.entries(days)) {
    if (lower.includes(name)) return weekday;
  }
  return null;
}

function expandWeeklyInMonth(
  anchor: DateTime,
  end: DateTime,
  monthStart: DateTime,
  monthEnd: DateTime,
  weekday: number,
): { start: DateTime; end: DateTime }[] {
  const duration = end.diff(anchor);
  const out: { start: DateTime; end: DateTime }[] = [];
  let day = monthStart.startOf("day");
  while (day <= monthEnd) {
    if (day.weekday === weekday) {
      const start = day.set({
        hour: anchor.hour,
        minute: anchor.minute,
        second: 0,
        millisecond: 0,
      });
      if (start >= monthStart && start <= monthEnd) {
        out.push({ start, end: start.plus(duration) });
      }
    }
    day = day.plus({ days: 1 });
  }
  return out;
}

function mapInstance(
  raw: MeetupEvent,
  start: DateTime,
  end: DateTime,
): WorkshopEvent {
  const title = raw.title?.trim() || "Shut Up & Write!®";
  const host = raw.eventHosts?.[0]?.name?.trim();
  const venueName = raw.venue?.name?.trim() || "Glen Park Branch Library";
  const address = [
    raw.venue?.address?.trim(),
    raw.venue?.city?.trim(),
    raw.venue?.state?.trim(),
  ]
    .filter(Boolean)
    .join(", ");

  const eventId = raw.id ?? "314807057";
  const description =
    raw.description?.trim() ||
    "Free focused writing time with Shut Up & Write!® SF Bay Area. Bring your project and write alongside other writers.";

  return {
    id: `shut-up-and-write-${eventId}-${start.toFormat("yyyyLLddHHmm")}`,
    cityId: "sf",
    title,
    tagline: host
      ? `${host} · Shut Up & Write!® SF Bay Area`
      : "Shut Up & Write!® SF Bay Area",
    description,
    start: start.toISO() ?? start.toString(),
    end: end.toISO() ?? undefined,
    timeZone: TZ,
    format: "in-person",
    price: "free",
    category: "workshop",
    organizer: "Shut Up & Write!® SF Bay Area",
    venue: venueName,
    address: address || "2825 Diamond St, San Francisco, CA",
    neighborhood: "Glen Park",
    rsvpUrl: raw.eventUrl?.trim() || SHUT_UP_AND_WRITE_EVENT_URL,
    source: "Shut Up & Write!® (Meetup)",
    sourceChannel: "literary_org",
    listingProvenance: "live",
  };
}

export async function fetchShutUpAndWriteEventsForMonth(
  year: number,
  monthIndex: number,
  signal?: AbortSignal,
): Promise<{ events: WorkshopEvent[]; meta: ShutUpAndWriteMeta }> {
  const res = await fetch(SHUT_UP_AND_WRITE_EVENT_URL, {
    signal,
    headers: {
      Accept: "text/html,application/xhtml+xml",
      "Accept-Language": "en-US,en;q=0.9",
      "User-Agent": UA,
      Referer: ORIGIN,
    },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Shut Up & Write Meetup HTTP ${res.status}`);
  }

  const html = await res.text();
  const raw = parseNextDataEvent(html);
  if (!raw?.dateTime) {
    return {
      events: [],
      meta: { pageFetched: true, recurring: false, instancesInMonth: 0 },
    };
  }

  const anchor = DateTime.fromISO(raw.dateTime, { setZone: true }).setZone(TZ);
  const endAnchor = raw.endTime
    ? DateTime.fromISO(raw.endTime, { setZone: true }).setZone(TZ)
    : anchor.plus({ hours: 2 });
  if (!anchor.isValid) {
    return {
      events: [],
      meta: { pageFetched: true, recurring: false, instancesInMonth: 0 },
    };
  }

  const monthStart = DateTime.fromObject(
    { year, month: monthIndex + 1, day: 1 },
    { zone: TZ },
  ).startOf("day");
  const monthEnd = monthStart.endOf("month").endOf("day");

  const seriesDesc = raw.series?.description;
  const weekday =
    weekdayFromSeriesDescription(seriesDesc) ?? anchor.weekday;
  const recurring = /every week/i.test(seriesDesc ?? "");

  const slots = recurring
    ? expandWeeklyInMonth(anchor, endAnchor, monthStart, monthEnd, weekday)
    : anchor >= monthStart && anchor <= monthEnd
      ? [{ start: anchor, end: endAnchor }]
      : [];

  const events = slots
    .map((slot) => mapInstance(raw, slot.start, slot.end))
    .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());

  return {
    events,
    meta: {
      pageFetched: true,
      recurring,
      instancesInMonth: events.length,
    },
  };
}
