import type { WorkshopEvent, WorkshopEventCategory } from "@/lib/workshop-types";
import type { PnpFullCalendarEvent } from "@/lib/politics-prose-client";
import { POLITICS_PROSE_ORIGIN } from "@/lib/politics-prose-client";
import { DateTime } from "luxon";
import { stripHtmlAndDecode, toShortOverview } from "@/lib/text";

function stripHtml(html: string): string {
  return stripHtmlAndDecode(html);
}

/** Prefer plain title inside first `<span>...</span>` in FullCalendar title HTML. */
function parseTitle(raw?: string): string {
  if (!raw?.trim()) return "";
  const span = raw.match(/<span>\s*([\s\S]*?)\s*<\/span>/i);
  if (span) return stripHtml(span[1]);
  return stripHtml(raw);
}

function parseVenueFromTitleHtml(raw?: string): string | undefined {
  if (!raw) return undefined;
  const addr = raw.match(
    /<address>([\s\S]*?)<\/address>/i,
  );
  if (!addr) return undefined;
  return stripHtml(addr[1]).replace(/\s+,/g, ",") || undefined;
}

/**
 * About copy when the calendar feed has none and the event page is rate-limited.
 * Prefer the live page via /api/event-page-enrich when it succeeds.
 */
const PNP_ABOUT_BY_PATH: Record<string, string> = {
  "/donica-merhazion":
    "In 1970s Ethiopia, 13-year-old Elen, determined to escape her arranged marriage, secretly abandons her tiny village hoping to find her aunt living in Asmara, the capital of Eritrea. Meanwhile, Girmai escapes his abusive stepmother after the death of his beloved father, only to end up homeless and starving on the streets of the city. Based on a true story, Born at the End of the World is a powerful narrative of patriotism, love, camaraderie, and courage, no less uplifting or appalling than Schindler's List. Merhazion will be in conversation with Bsrat Mezghebe.",
};

function aboutOverrideForUrl(rsvpUrl: string | undefined): string | undefined {
  if (!rsvpUrl) return undefined;
  try {
    const path = new URL(rsvpUrl).pathname.replace(/\/+$/, "") || "/";
    return PNP_ABOUT_BY_PATH[path];
  } catch {
    return undefined;
  }
}

export function mapPnpEventToWorkshop(
  ev: PnpFullCalendarEvent,
  opts?: {
    price?: WorkshopEvent["price"];
    description?: string;
  },
): WorkshopEvent | null {
  const start = ev.start?.trim();
  if (!start) return null;

  const title = parseTitle(ev.title);
  if (!title) return null;

  const tz = "America/New_York";
  // P&P FullCalendar strings are local times for the store (DC). Ensure the stored ISO
  // includes an offset so display is stable across user locales.
  const startDt = DateTime.fromISO(start, { zone: tz });
  if (!startDt.isValid) return null;

  const endRaw = ev.end?.trim();
  const endDt = endRaw ? DateTime.fromISO(endRaw, { zone: tz }) : null;
  const endIso =
    endDt && endDt.isValid && endDt > startDt
      ? endDt.toISO() ?? undefined
      : undefined;

  const path = ev.url?.trim();
  const rsvpUrl =
    path && path.startsWith("http")
      ? path
      : path
        ? `${POLITICS_PROSE_ORIGIN}${path.startsWith("/") ? path : `/${path}`}`
        : undefined;

  const venue = parseVenueFromTitleHtml(ev.title);
  const tagline = ev.des ? toShortOverview(ev.des, 240) : "";

  const category: WorkshopEventCategory = "reading";

  const eid =
    ev.eid != null && String(ev.eid).trim() !== ""
      ? String(ev.eid).trim()
      : "";
  const idKey = eid || path || title;
  return {
    id: `pnp-${String(idKey).replace(/\s+/g, "-").slice(0, 80)}`,
    cityId: "dmv",
    title,
    tagline,
    description:
      opts?.description?.trim() ||
      aboutOverrideForUrl(rsvpUrl) ||
      "Details from Politics and Prose.",
    start: startDt.toISO() ?? startDt.toUTC().toISO() ?? start,
    end: endIso,
    timeZone: tz,
    format: "in-person",
    price: opts?.price ?? "unknown",
    category,
    organizer: "Politics and Prose",
    venue,
    rsvpUrl,
    source: "Politics and Prose (politics-prose.com)",
    sourceChannel: "bookstore",
    listingProvenance: "live",
  };
}
