import { DateTime } from "luxon";
import type {
  EventFormat,
  WorkshopEvent,
  WorkshopEventCategory,
} from "@/lib/workshop-types";
import { decodeHtmlEntities, stripHtmlAndDecode, toShortOverview, limitAboutToSentences } from "@/lib/text";

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
  categories?: Array<{ slug?: string; name?: string }>;
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

/** Preserve paragraph / list structure for detail-modal About copy. */
function htmlToPlainDescription(html: string): string {
  return decodeHtmlEntities(
    html
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/p>/gi, "\n\n")
      // Headlines often omit a trailing period; keep a sentence break for About.
      .replace(/<\/h[1-6]>/gi, ".\n\n")
      .replace(/<\/li>/gi, "\n")
      .replace(/<li[^>]*>/gi, "• ")
      .replace(/<hr[^>]*>/gi, "\n\n")
      .replace(/<[^>]+>/g, " ")
      .replace(/([.!?…])\s*\./g, "$1")
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n[ \t]+/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .replace(/[ \t]{2,}/g, " ")
      .trim(),
  );
}

function isTruncatedExcerpt(text: string): boolean {
  return /…|\.\.\.\s*$/.test(text.trim()) || /&#8230;|&hellip;/i.test(text);
}

function toIsoUtc(raw?: string | null): string | null {
  if (!raw?.trim()) return null;
  const s = raw.trim().replace(" ", "T");
  if (s.endsWith("Z")) return s;
  if (/[+-]\d{2}:\d{2}$/.test(s)) return s;
  return `${s}Z`;
}

function mapPrice(cost?: string, ev?: TwcTribeEvent): WorkshopEvent["price"] {
  if (!cost?.trim()) {
    // Free-events calendar often omits cost; treat blank Event listings as free.
    if (ev && categorySlugs(ev).includes("event") && !isWorkshopListing(ev)) {
      return "free";
    }
    return "unknown";
  }
  const decoded = stripHtmlAndDecode(cost);
  const c = decoded.toLowerCase();
  if (c.includes("free") || c === "0") return "free";
  if (/\$|€|£|\d/.test(decoded)) return "paid";
  return "unknown";
}

function buildWorkshopFromTwc(
  ev: TwcTribeEvent,
  opts: {
    id: string;
    start: string;
    end?: string;
    timeZone: string;
    price?: WorkshopEvent["price"];
    priceDetail?: string;
    descriptionOverride?: string;
  },
): WorkshopEvent | null {
  const excerpt = (ev.excerpt ?? "").trim();
  const descHtml = (ev.description ?? "").trim();
  const workshop = isWorkshopListing(ev);
  // Prefer the full event-page description over the truncated excerpt.
  const fullDescription = descHtml
    ? htmlToPlainDescription(descHtml).slice(0, 4000)
    : "";
  const excerptPlain = excerpt ? stripHtml(excerpt) : "";
  const rawDescription =
    opts.descriptionOverride?.trim() ||
    fullDescription ||
    excerptPlain ||
    (workshop
      ? "Workshop at The Writer's Center."
      : "Event at The Writer's Center.");
  const description = limitAboutToSentences(rawDescription, 4);

  // Avoid truncated “… ” excerpts for the subtitle when we have full copy.
  const taglineSource =
    excerptPlain && !isTruncatedExcerpt(excerptPlain)
      ? excerptPlain
      : fullDescription || excerptPlain;
  const tagline = taglineSource
    ? toShortOverview(taglineSource, 220)
    : "";

  const title = safeTitle(ev.title);
  if (!title) return null;

  const format = mapFormat(ev);
  const virtualLabel =
    format === "hybrid"
      ? "Hybrid (online + in person)"
      : format === "virtual"
        ? "Online (The Writer's Center)"
        : undefined;

  const price = opts.price ?? mapPrice(ev.cost, ev);
  const venue = venueLine(ev);
  // Address is already folded into `venue` (e.g. "The Writer's Center · 4508…").
  // Leaving it separate makes the modal show a duplicated street line.
  const street = cleanTwcText(ev.venue?.address);
  const addressEmbeddedInVenue =
    Boolean(venue) &&
    Boolean(street) &&
    venue!.toLowerCase().includes(street.toLowerCase());

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
    price,
    priceDetail: opts.priceDetail,
    // Workshops and readings are ticketed/registered on writer.org.
    registrationRequired: true,
    category: mapCategory(ev, title),
    organizer: "The Writer's Center",
    venue,
    address: addressEmbeddedInVenue ? undefined : street || undefined,
    neighborhood: addressEmbeddedInVenue
      ? undefined
      : cleanTwcText(ev.venue?.city) || undefined,
    virtualLabel,
    rsvpUrl: ev.url?.trim() || undefined,
    source: workshop
      ? "The Writer's Center — Workshops (writer.org)"
      : "The Writer's Center — Free Events Calendar (writer.org)",
    sourceChannel: "literary_org",
    listingProvenance: "live",
  };
}

function categorySlugs(ev: TwcTribeEvent): string[] {
  return (ev.categories ?? [])
    .map((c) => c.slug?.trim().toLowerCase())
    .filter((s): s is string => Boolean(s));
}

function isWorkshopListing(ev: TwcTribeEvent): boolean {
  return categorySlugs(ev).includes("workshop");
}

function mapCategory(ev: TwcTribeEvent, title: string): WorkshopEventCategory {
  if (isWorkshopListing(ev)) return "workshop";

  const t = title.toLowerCase();
  if (/\bopen\s*mic\b/.test(t)) return "open-mic";
  if (
    /\b(reading|book\s*release|book\s*launch|author.?s\s*corner|literary\s*salon|craft\s*chat)\b/.test(
      t,
    )
  ) {
    return "reading";
  }
  // Free-events calendar: book clubs, mixers, info sessions, etc.
  return "other";
}

function mapFormat(ev: TwcTribeEvent): EventFormat {
  const venueName = cleanTwcText(ev.venue?.venue).toLowerCase();
  const zoomVenue = /\bzoom\b/.test(venueName);
  const hasPhysicalVenue =
    !zoomVenue &&
    (Boolean(ev.venue?.address?.trim()) ||
      (Boolean(ev.venue?.venue?.trim()) &&
        !/\b(virtual|online|webinar)\b/.test(venueName)) ||
      (ev.venue?.geo_lat != null &&
        ev.venue?.geo_lng != null &&
        String(ev.venue.geo_lat).trim() !== "" &&
        String(ev.venue.geo_lng).trim() !== ""));

  if (ev.is_virtual && hasPhysicalVenue) return "hybrid";
  if (ev.is_virtual || zoomVenue) return "virtual";
  // Title-based fallback when TEC omits is_virtual on Zoom-only free events.
  const title = safeTitle(ev.title).toLowerCase();
  if (/\b(virtual|zoom|online)\b/.test(title) && !hasPhysicalVenue) return "virtual";
  return "in-person";
}

function cleanTwcText(raw?: string | null): string {
  return stripHtmlAndDecode(raw ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

function venueLine(ev: TwcTribeEvent): string | undefined {
  const v = ev.venue;
  if (!v) return undefined;
  const name = cleanTwcText(v.venue);
  if (/\bzoom\b/i.test(name)) return "Zoom";
  const street = cleanTwcText(v.address);
  const city = cleanTwcText(v.city);
  const state = cleanTwcText(v.state);
  const zip = cleanTwcText(v.zip);
  const place = [street, city, state, zip].filter(Boolean).join(", ");
  const parts = [name || null, place || null].filter(Boolean) as string[];
  if (parts.length === 0) return undefined;
  return parts.join(" · ");
}

function safeTitle(title: unknown): string {
  if (typeof title === "string") return stripHtml(title).trim();
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

function expandWeeklySessions(
  ev: TwcTribeEvent,
  seriesStart: DateTime,
  seriesEnd: DateTime,
  zone: string,
  details?: {
    price?: WorkshopEvent["price"];
    priceDetail?: string;
    descriptionOverride?: string;
  },
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
        price: details?.price,
        priceDetail: details?.priceDetail,
        descriptionOverride: details?.descriptionOverride,
      });
      if (built) out.push(built);
    }
    day = day.plus({ days: 1 });
  }

  return out;
}

/** Maps one TEC row to one or more calendar listings (weekly sessions when applicable). */
export function mapTwcEventToWorkshops(
  ev: TwcTribeEvent,
  details?: {
    price?: WorkshopEvent["price"];
    priceDetail?: string;
    descriptionOverride?: string;
  },
): WorkshopEvent[] {
  const zone = ev.timezone?.trim() || DEFAULT_TZ;
  const localStart = parseTwcLocal(ev.start_date, zone);
  const localEnd = parseTwcLocal(ev.end_date, zone);

  if (localStart && localEnd && shouldExpandWeeklySessions(ev, localStart, localEnd)) {
    return expandWeeklySessions(ev, localStart, localEnd, zone, details);
  }

  const single = mapTwcEventToWorkshop(ev, details);
  return single ? [single] : [];
}

export function mapTwcEventToWorkshop(
  ev: TwcTribeEvent,
  details?: {
    price?: WorkshopEvent["price"];
    priceDetail?: string;
    descriptionOverride?: string;
  },
): WorkshopEvent | null {
  const zone = ev.timezone?.trim() || DEFAULT_TZ;
  const start = toIsoUtc(ev.utc_start_date);
  if (!start) return null;

  const end = toIsoUtc(ev.utc_end_date) ?? undefined;

  return buildWorkshopFromTwc(ev, {
    id: `twc-${ev.id}`,
    start,
    end,
    timeZone: zone,
    price: details?.price,
    priceDetail: details?.priceDetail,
    descriptionOverride: details?.descriptionOverride,
  });
}
