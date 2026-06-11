import { DateTime } from "luxon";
import type {
  EventFormat,
  PriceKind,
  WorkshopEvent,
  WorkshopEventCategory,
} from "@/lib/workshop-types";
import { stripHtmlAndDecode, toShortOverview } from "@/lib/text";

const DEFAULT_TZ = "America/Los_Angeles";
const SF_ADDRESS = "2042 Balboa St, San Francisco, CA 94121";

/** One event from Writing Salon's Tribe REST API (subset of fields). */
export type WsTribeEvent = {
  id: number;
  title: string | { rendered?: string };
  url: string;
  excerpt?: string;
  description?: string;
  start_date?: string;
  end_date?: string;
  utc_start_date?: string;
  utc_end_date?: string;
  timezone?: string;
  all_day?: boolean;
  cost?: string;
  is_virtual?: boolean;
  virtual_url?: string | null;
  categories?: { slug?: string; name?: string }[];
  organizer?: { organizer?: string }[];
  venue?: {
    venue?: string;
    address?: string;
    city?: string;
    state?: string;
    zip?: string;
    geo_lat?: string | number | null;
    geo_lng?: string | number | null;
  } | null;
};

function stripHtml(html: string): string {
  return stripHtmlAndDecode(html);
}

function safeTitle(title: unknown): string {
  if (typeof title === "string") return title.trim();
  if (title && typeof title === "object" && "rendered" in title) {
    const r = (title as { rendered?: string }).rendered;
    if (typeof r === "string") return stripHtml(r).trim();
  }
  return "";
}

function toIsoUtc(raw?: string | null): string | null {
  if (!raw?.trim()) return null;
  const s = raw.trim().replace(" ", "T");
  if (s.endsWith("Z")) return s;
  if (/[+-]\d{2}:\d{2}$/.test(s)) return s;
  return `${s}Z`;
}

function parseLocal(raw: string | undefined, zone: string): DateTime | null {
  if (!raw?.trim()) return null;
  const dt = DateTime.fromFormat(raw.trim(), "yyyy-MM-dd HH:mm:ss", {
    zone,
    locale: "en",
  });
  return dt.isValid ? dt : null;
}

function categorySlugs(ev: WsTribeEvent): string[] {
  return (ev.categories ?? [])
    .map((c) => c.slug?.trim())
    .filter((s): s is string => Boolean(s));
}

/** SF calendar: SF classroom + online; exclude Berkeley-only classes. */
export function isWritingSalonSfRelevant(ev: WsTribeEvent): boolean {
  const slugs = categorySlugs(ev);
  if (slugs.includes("berkeley-class")) return false;
  if (
    slugs.includes("san-francisco-class") ||
    slugs.includes("zoom-class") ||
    slugs.includes("online-class")
  ) {
    return true;
  }

  const venueName = (ev.venue?.venue ?? "").toLowerCase();
  const city = (ev.venue?.city ?? "").toLowerCase();
  if (venueName.includes("san francisco") || city.includes("san francisco")) {
    return true;
  }
  if (
    venueName.includes("online") ||
    venueName.includes("zoom") ||
    ev.is_virtual
  ) {
    return true;
  }
  return false;
}

function mapPrice(cost?: string): PriceKind {
  if (!cost?.trim()) return "unknown";
  const c = cost.toLowerCase();
  if (c.includes("free") || c === "0" || c === "$0") return "free";
  if (/\$|€|£|\d/.test(cost)) return "paid";
  return "unknown";
}

function mapFormat(ev: WsTribeEvent): EventFormat {
  const slugs = categorySlugs(ev);
  const venueName = (ev.venue?.venue ?? "").toLowerCase();
  const isOnline =
    slugs.includes("zoom-class") ||
    slugs.includes("online-class") ||
    venueName.includes("online") ||
    venueName.includes("zoom") ||
    Boolean(ev.is_virtual);

  const isSfClassroom =
    slugs.includes("san-francisco-class") ||
    venueName.includes("san francisco");

  if (isOnline && isSfClassroom) return "hybrid";
  if (isOnline) return "virtual";
  return "in-person";
}

function mapWorkshopCategory(title: string, description: string): WorkshopEventCategory {
  const b = `${title}\n${description}`.toLowerCase();
  if (/\b(open mic|poetry slam)\b/.test(b)) return "open-mic";
  if (/\b(reading|salon|meetup)\b/.test(b)) return "reading";
  if (/\b(panel|publishing|professional)\b/.test(b)) return "panel";
  if (/\b(round robin|workshop|class|course)\b/.test(b)) return "workshop";
  return "workshop";
}

function venueLine(ev: WsTribeEvent): string | undefined {
  const v = ev.venue;
  if (!v?.venue?.trim()) return undefined;
  return v.venue.trim();
}

function addressLine(ev: WsTribeEvent, format: EventFormat): string | undefined {
  if (format === "virtual") return undefined;
  const v = ev.venue;
  if (!v) return SF_ADDRESS;
  const parts = [
    v.address?.trim(),
    v.city?.trim(),
    v.state?.trim(),
    v.zip?.trim(),
  ].filter(Boolean);
  if (parts.length === 0) return SF_ADDRESS;
  return parts.join(", ");
}

function instructorTagline(ev: WsTribeEvent): string {
  const name = ev.organizer?.[0]?.organizer?.trim();
  return name ? `${name} · The Writing Salon` : "The Writing Salon";
}

function shouldExpandWeeklySessions(
  ev: WsTribeEvent,
  start: DateTime,
  end: DateTime,
): boolean {
  if (ev.all_day) return false;
  const daySpan = end.startOf("day").diff(start.startOf("day"), "days").days;
  if (daySpan < 6) return false;
  if (start.weekday !== end.weekday) return false;

  const looksAllDaySpan =
    start.hour === 0 &&
    start.minute === 0 &&
    end.hour === 23 &&
    end.minute >= 59;
  if (looksAllDaySpan) return false;

  const startMins = start.hour * 60 + start.minute;
  const endMins = end.hour * 60 + end.minute;
  if (endMins <= startMins || endMins - startMins > 12 * 60) return false;
  return true;
}

function buildWorkshop(
  ev: WsTribeEvent,
  opts: { id: string; start: string; end?: string; timeZone: string },
): WorkshopEvent | null {
  const title = safeTitle(ev.title);
  if (!title) return null;

  const excerpt = stripHtml((ev.excerpt ?? "").trim());
  const descHtml = stripHtml((ev.description ?? "").trim());
  const description =
    (excerpt ? toShortOverview(excerpt, 520) : "") ||
    (descHtml ? toShortOverview(descHtml, 520) : "") ||
    title;

  const format = mapFormat(ev);
  const virtualLabel =
    format === "hybrid"
      ? "Hybrid (online + in person)"
      : format === "virtual"
        ? venueLine(ev) ?? "Online (The Writing Salon)"
        : undefined;

  return {
    id: opts.id,
    cityId: "sf",
    title,
    tagline: instructorTagline(ev),
    description,
    start: opts.start,
    end: opts.end,
    timeZone: opts.timeZone,
    format,
    price: mapPrice(ev.cost),
    category: mapWorkshopCategory(title, description),
    organizer: "The Writing Salon",
    venue: venueLine(ev) ?? "The Writing Salon",
    address: addressLine(ev, format),
    neighborhood:
      format === "virtual"
        ? undefined
        : ev.venue?.city?.trim() || "San Francisco",
    virtualLabel,
    rsvpUrl: ev.url?.trim() || undefined,
    source: "The Writing Salon (writingsalons.com)",
    sourceChannel: "literary_org",
    listingProvenance: "live",
  };
}

function expandWeeklySessions(
  ev: WsTribeEvent,
  seriesStart: DateTime,
  seriesEnd: DateTime,
  zone: string,
): WorkshopEvent[] {
  const out: WorkshopEvent[] = [];
  let day = seriesStart.startOf("day");
  const lastDay = seriesEnd.startOf("day");

  while (day <= lastDay) {
    if (day.weekday === seriesStart.weekday) {
      const sessStart = day.set({
        hour: seriesStart.hour,
        minute: seriesStart.minute,
        second: 0,
        millisecond: 0,
      });
      const sessEnd = day.set({
        hour: seriesEnd.hour,
        minute: seriesEnd.minute,
        second: 0,
        millisecond: 0,
      });
      const built = buildWorkshop(ev, {
        id: `writing-salon-${ev.id}-${sessStart.toFormat("yyyyLLddHHmm")}`,
        start: sessStart.toUTC().toISO() ?? sessStart.toString(),
        end: sessEnd.toUTC().toISO() ?? undefined,
        timeZone: zone,
      });
      if (built) out.push(built);
    }
    day = day.plus({ days: 1 });
  }

  return out;
}

export function mapWritingSalonEventToWorkshops(ev: WsTribeEvent): WorkshopEvent[] {
  if (!isWritingSalonSfRelevant(ev)) return [];

  const zone = ev.timezone?.trim() || DEFAULT_TZ;
  const localStart = parseLocal(ev.start_date, zone);
  const localEnd = parseLocal(ev.end_date, zone);

  if (localStart && localEnd && shouldExpandWeeklySessions(ev, localStart, localEnd)) {
    return expandWeeklySessions(ev, localStart, localEnd, zone);
  }

  const single = mapWritingSalonEventToWorkshop(ev);
  return single ? [single] : [];
}

export function mapWritingSalonEventToWorkshop(ev: WsTribeEvent): WorkshopEvent | null {
  if (!isWritingSalonSfRelevant(ev)) return null;

  const zone = ev.timezone?.trim() || DEFAULT_TZ;
  const start = toIsoUtc(ev.utc_start_date);
  if (!start) return null;
  const end = toIsoUtc(ev.utc_end_date) ?? undefined;

  return buildWorkshop(ev, {
    id: `writing-salon-${ev.id}`,
    start,
    end,
    timeZone: zone,
  });
}
