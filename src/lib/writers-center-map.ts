import { DateTime } from "luxon";
import type {
  EventFormat,
  WorkshopEvent,
  WorkshopEventCategory,
} from "@/lib/workshop-types";
import { stripHtmlAndDecode, toShortOverview } from "@/lib/text";

const DEFAULT_TZ = "America/New_York";

/** One event from `GET /wp-json/tribe/events/v1/events` (subset of fields). */
export type TwcTribeEvent = {
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

function toIsoUtc(raw?: string | null): string | null {
  if (!raw?.trim()) return null;
  const s = raw.trim().replace(" ", "T");
  if (s.endsWith("Z")) return s;
  if (/[+-]\d{2}:\d{2}$/.test(s)) return s;
  return `${s}Z`;
}

function mapPrice(cost?: string): WorkshopEvent["price"] {
  if (!cost?.trim()) return "unknown";
  const c = cost.toLowerCase();
  if (c.includes("free") || c === "0") return "free";
  if (/\$|€|£|\d/.test(cost)) return "paid";
  return "unknown";
}

function mapFormat(ev: TwcTribeEvent): EventFormat {
  const hasVenue =
    Boolean(ev.venue?.venue?.trim()) ||
    Boolean(ev.venue?.address?.trim()) ||
    (ev.venue?.geo_lat != null &&
      ev.venue?.geo_lng != null &&
      String(ev.venue.geo_lat).trim() !== "" &&
      String(ev.venue.geo_lng).trim() !== "");
  if (ev.is_virtual && hasVenue) return "hybrid";
  if (ev.is_virtual) return "virtual";
  return "in-person";
}

function venueLine(ev: TwcTribeEvent): string | undefined {
  const v = ev.venue;
  if (!v) return undefined;
  const parts = [
    v.venue,
    [v.address, v.city, v.state, v.zip].filter(Boolean).join(", ") || null,
  ].filter(Boolean) as string[];
  if (parts.length === 0) return undefined;
  return parts.join(" · ");
}

function safeTitle(title: unknown): string {
  if (typeof title === "string") return title.trim();
  if (title && typeof title === "object" && "rendered" in title) {
    const r = (title as { rendered?: string }).rendered;
    if (typeof r === "string") return stripHtml(r).trim();
  }
  return "";
}

function parseTwcLocal(
  raw: string | undefined,
  zone: string,
): DateTime | null {
  if (!raw?.trim()) return null;
  const dt = DateTime.fromFormat(raw.trim(), "yyyy-MM-dd HH:mm:ss", {
    zone,
    locale: "en",
  });
  return dt.isValid ? dt : null;
}

/** Multi-week workshops use first/last session dates with matching weekdays. */
function shouldExpandWeeklySessions(
  ev: TwcTribeEvent,
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

function buildWorkshopFromTwc(
  ev: TwcTribeEvent,
  opts: { id: string; start: string; end?: string; timeZone: string },
): WorkshopEvent | null {
  const excerpt = (ev.excerpt ?? "").trim();
  const descHtml = (ev.description ?? "").trim();
  const description =
    (excerpt ? stripHtml(excerpt) : "") ||
    (descHtml ? stripHtml(descHtml).slice(0, 3000) : "") ||
    "Workshop at The Writer's Center.";

  const tagline = excerpt.length > 0 ? toShortOverview(excerpt, 220) : "";

  const title = safeTitle(ev.title);
  if (!title) return null;

  const format = mapFormat(ev);
  const virtualLabel =
    format === "hybrid"
      ? "Hybrid (online + in person)"
      : format === "virtual"
        ? "Online (The Writer's Center)"
        : undefined;

  return {
    id: opts.id,
    cityId: "dmv",
    title,
    tagline,
    description,
    start: opts.start,
    end: opts.end,
    timeZone: opts.timeZone,
    format,
    price: mapPrice(ev.cost),
    category: "workshop",
    organizer: "The Writer's Center",
    venue: venueLine(ev),
    address: ev.venue?.address?.trim() || undefined,
    neighborhood: ev.venue?.city?.trim() || undefined,
    virtualLabel,
    rsvpUrl: ev.url?.trim() || undefined,
    source: "The Writer's Center — Workshops (writer.org)",
    sourceChannel: "literary_org",
    listingProvenance: "live",
  };
}

function expandWeeklySessions(
  ev: TwcTribeEvent,
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
      const built = buildWorkshopFromTwc(ev, {
        id: `twc-${ev.id}-${sessStart.toFormat("yyyyLLddHHmm")}`,
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

/** Maps one TEC row to one or more calendar listings (weekly sessions when applicable). */
export function mapTwcEventToWorkshops(ev: TwcTribeEvent): WorkshopEvent[] {
  const zone = ev.timezone?.trim() || DEFAULT_TZ;
  const localStart = parseTwcLocal(ev.start_date, zone);
  const localEnd = parseTwcLocal(ev.end_date, zone);

  if (localStart && localEnd && shouldExpandWeeklySessions(ev, localStart, localEnd)) {
    return expandWeeklySessions(ev, localStart, localEnd, zone);
  }

  const single = mapTwcEventToWorkshop(ev);
  return single ? [single] : [];
}

export function mapTwcEventToWorkshop(ev: TwcTribeEvent): WorkshopEvent | null {
  const zone = ev.timezone?.trim() || DEFAULT_TZ;
  const start = toIsoUtc(ev.utc_start_date);
  if (!start) return null;

  const end = toIsoUtc(ev.utc_end_date) ?? undefined;

  return buildWorkshopFromTwc(ev, {
    id: `twc-${ev.id}`,
    start,
    end,
    timeZone: zone,
  });
}
