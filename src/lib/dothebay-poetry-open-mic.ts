import { DateTime } from "luxon";
import type { WorkshopEvent } from "@/lib/workshop-types";
import { stripHtmlAndDecode, toShortOverview } from "@/lib/text";

const TZ = "America/Los_Angeles";
const ORIGIN = "https://dothebay.com";
export const DOTHEBAY_POETRY_OPEN_MIC_URL =
  `${ORIGIN}/events/weekly/wed/poetry-open-mic`;
const JSON_URL = `${DOTHEBAY_POETRY_OPEN_MIC_URL}.json`;

const UA =
  "calendar_literary/1.0 (+https://github.com/taraprakash06/literary-events-calendar)";

export type DoTheBayPoetryOpenMicMeta = {
  pageFetched: boolean;
  recurring: boolean;
  instancesInMonth: number;
};

type DoStuffVenue = {
  title?: string;
  full_address?: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
};

type DoStuffEvent = {
  id?: number;
  title?: string;
  description?: string;
  excerpt?: string;
  tz_adjusted_begin_date?: string;
  tz_adjusted_end_date?: string;
  repeating?: boolean;
  dow?: number;
  absolute_url?: string;
  is_free?: boolean;
  venue?: DoStuffVenue;
};

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
  raw: DoStuffEvent,
  start: DateTime,
  end: DateTime,
): WorkshopEvent {
  const title = raw.title?.trim() || "Poetry Open Mic";
  const venueName = raw.venue?.title?.trim() || "Sacred Grounds Cafe";
  const address =
    raw.venue?.full_address?.trim() ||
    [raw.venue?.address, raw.venue?.city, raw.venue?.state, raw.venue?.zip]
      .filter(Boolean)
      .join(", ") ||
    "2095 Hayes, San Francisco, CA";

  const htmlDesc = raw.description?.trim() || raw.excerpt?.trim() || "";
  const description =
    stripHtmlAndDecode(htmlDesc) ||
    "Weekly poetry open mic. Sign-ups begin at 7:00pm; readings from 7:30pm to 10:00pm.";

  const eventId = raw.id ?? 1082169;

  return {
    id: `dothebay-poetry-open-mic-${eventId}-${start.toFormat("yyyyLLddHHmm")}`,
    cityId: "sf",
    title,
    tagline: `${venueName} · Wednesdays`,
    description: toShortOverview(description, 420) || description,
    start: start.toISO() ?? start.toString(),
    end: end.toISO() ?? undefined,
    timeZone: TZ,
    format: "in-person",
    price: raw.is_free ? "free" : "unknown",
    category: "open-mic",
    organizer: venueName,
    venue: venueName,
    address,
    neighborhood: "Hayes Valley",
    rsvpUrl: raw.absolute_url?.trim() || DOTHEBAY_POETRY_OPEN_MIC_URL,
    source: "DoTheBay",
    sourceChannel: "literary_org",
    listingProvenance: "live",
  };
}

export async function fetchDoTheBayPoetryOpenMicForMonth(
  year: number,
  monthIndex: number,
  signal?: AbortSignal,
): Promise<{ events: WorkshopEvent[]; meta: DoTheBayPoetryOpenMicMeta }> {
  const res = await fetch(JSON_URL, {
    signal,
    headers: {
      Accept: "application/json",
      "User-Agent": UA,
      Referer: DOTHEBAY_POETRY_OPEN_MIC_URL,
    },
    next: { revalidate: 600 },
  });
  if (!res.ok) {
    throw new Error(`DoTheBay HTTP ${res.status}`);
  }

  const data = (await res.json()) as { event?: DoStuffEvent };
  const raw = data.event;
  if (!raw?.tz_adjusted_begin_date) {
    return {
      events: [],
      meta: { pageFetched: true, recurring: false, instancesInMonth: 0 },
    };
  }

  const anchor = DateTime.fromISO(raw.tz_adjusted_begin_date, { setZone: true }).setZone(
    TZ,
  );
  const endAnchor = raw.tz_adjusted_end_date
    ? DateTime.fromISO(raw.tz_adjusted_end_date, { setZone: true }).setZone(TZ)
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

  const weekday = raw.dow ?? anchor.weekday;
  const recurring = raw.repeating === true;

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
