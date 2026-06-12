import { DateTime } from "luxon";
import type { EventFormat, WorkshopEvent } from "@/lib/workshop-types";
import { inferEventCategory } from "@/lib/event-category";
import { parseIcsEvents, type IcsEvent } from "@/lib/ics";
import { toShortOverview } from "@/lib/text";

const TZ = "America/Los_Angeles";
export const WORLD_STAGE_EVENTS_URL = "https://www.theworldstage.org/events.html";
const ICS_URL = "https://tockify.com/api/feeds/ics/the.world.stage";

const UA =
  "calendar_literary/1.0 (+https://github.com/taraprakash06/literary-events-calendar)";

const VENUE = "The World Stage";
const ADDRESS = "4321 Degnan Blvd, Los Angeles, CA 90008";
const NEIGHBORHOOD = "Leimert Park";

export type WorldStageMeta = {
  pageFetched: boolean;
  icsEvents: number;
  literaryInMonth: number;
};

function unescapeIcsText(s: string): string {
  return s
    .replace(/\\n/gi, "\n")
    .replace(/\\,/g, ",")
    .replace(/\\;/g, ";")
    .replace(/\\\\/g, "\\");
}

function parseIcsInstant(raw: string): DateTime {
  const dt = DateTime.fromISO(raw, { setZone: true });
  return dt.isValid ? dt.setZone(TZ) : DateTime.invalid("bad ics date");
}

function inferFormat(title: string, description: string, location: string): EventFormat {
  const b = `${title}\n${description}\n${location}`.toLowerCase();
  if (/\b(zoom|virtual|online|youtube)\b/.test(b)) return "hybrid";
  return "in-person";
}

function inferPrice(description: string): WorkshopEvent["price"] {
  const b = description.toLowerCase();
  if (/\bfree\b/.test(b) && !/\$\d/.test(b)) return "free";
  if (/\$\d|admission|donation|ticket/.test(b)) return "paid";
  return "unknown";
}

/** The World Stage is primarily jazz; keep literary programming only. */
export function isWorldStageLiterary(title: string, description: string): boolean {
  const b = `${title}\n${description}`.toLowerCase();
  if (/\banansi\b/.test(b)) return true;
  if (
    /\b(open\s*mic|poetry|poet|spoken word|writers?\s+workshop|writing workshop|literary|author|memoir|fiction|book launch|reading)\b/.test(
      b,
    )
  ) {
    return true;
  }
  return false;
}

function stableId(ev: IcsEvent, start: DateTime): string {
  const key =
    (ev.uid ?? ev.url ?? ev.summary ?? "world-stage")
      .replace(/[^a-z0-9]+/gi, "-")
      .replace(/-+/g, "-")
      .toLowerCase() || "world-stage";
  return `world-stage-${key}-${start.toFormat("yyyyLLddHHmm")}`;
}

function mapIcsEvent(ev: IcsEvent): WorkshopEvent | null {
  if (!ev.dtstart || !ev.summary) return null;

  const title = unescapeIcsText(ev.summary).trim();
  const description = unescapeIcsText(ev.description ?? "");
  if (!isWorldStageLiterary(title, description)) return null;

  const start = parseIcsInstant(ev.dtstart);
  if (!start.isValid) return null;
  const end = ev.dtend ? parseIcsInstant(ev.dtend) : null;

  const format = inferFormat(title, description, ev.location ?? "");
  const category = inferEventCategory(title, description);

  return {
    id: stableId(ev, start),
    cityId: "la",
    title,
    tagline: `${VENUE} · Leimert Park`,
    description: toShortOverview(description, 420) || title,
    start: start.toISO() ?? start.toString(),
    end: end?.isValid ? end.toISO() ?? undefined : undefined,
    timeZone: TZ,
    format,
    price: inferPrice(description),
    category,
    organizer: VENUE,
    venue: VENUE,
    address: ev.location ? toShortOverview(unescapeIcsText(ev.location), 220) : ADDRESS,
    neighborhood: NEIGHBORHOOD,
    rsvpUrl: ev.url ?? WORLD_STAGE_EVENTS_URL,
    source: "The World Stage",
    sourceChannel: "literary_org",
    listingProvenance: "live",
  };
}

export async function fetchWorldStageEventsForMonth(
  year: number,
  monthIndex: number,
  signal?: AbortSignal,
): Promise<{ events: WorkshopEvent[]; meta: WorldStageMeta }> {
  const res = await fetch(ICS_URL, {
    signal,
    headers: {
      Accept: "text/calendar,text/plain,*/*",
      "User-Agent": UA,
    },
    next: { revalidate: 600 },
  });
  if (!res.ok) {
    throw new Error(`World Stage ICS HTTP ${res.status}`);
  }

  const ics = await res.text();
  const raw = parseIcsEvents(ics, 800);

  const events = raw
    .map(mapIcsEvent)
    .filter((x): x is WorkshopEvent => x != null)
    .filter((e) => {
      const dt = DateTime.fromISO(e.start, { setZone: true }).setZone(TZ);
      return dt.isValid && dt.year === year && dt.month === monthIndex + 1;
    })
    .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());

  return {
    events,
    meta: {
      pageFetched: true,
      icsEvents: raw.length,
      literaryInMonth: events.length,
    },
  };
}
