import type { WorkshopEvent, WorkshopEventCategory } from "@/lib/workshop-types";
import type { PnpFullCalendarEvent } from "@/lib/politics-prose-client";
import { POLITICS_PROSE_ORIGIN } from "@/lib/politics-prose-client";
import { eventLineFromBookstoreTitle } from "@/lib/rsvp-page-enrichment";
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
 * Keys may be exact paths or path substrings (matched after exact lookup).
 */
const PNP_ABOUT_BY_PATH: Record<string, string> = {
  "/donica-merhazion":
    "Donica Merhazion discusses her debut novel Born at the End of the World in conversation with writer Bsrat Mezghebe. Based on a true story set in 1970s Ethiopia and Eritrea, the book follows two young people whose lives collide amid the Red Terror.",
  "/robert-g-parkinson73126":
    "Robert G. Parkinson will be in conversation with Dr. Lindsay M. Chervinsky about Tyrants and Rogues: Understanding the Declaration of Independence. From an acclaimed historian, a revelatory account of the Declaration centered on the grievances that shaped 1776—not only the lofty preamble.",
  "summer-storytime-face-painting-conn-ave":
    "Join us for summer story time series, where we will have a bookseller story time followed by face painting.",
};

function aboutOverrideForUrl(rsvpUrl: string | undefined): string | undefined {
  if (!rsvpUrl) return undefined;
  try {
    const path = new URL(rsvpUrl).pathname.replace(/\/+$/, "") || "/";
    if (PNP_ABOUT_BY_PATH[path]) return PNP_ABOUT_BY_PATH[path];
    for (const [key, about] of Object.entries(PNP_ABOUT_BY_PATH)) {
      if (key.startsWith("/") ? path === key : path.includes(key)) return about;
    }
  } catch {
    return undefined;
  }
  return undefined;
}

/** Prefer conversation-first About; never keep a long plot-only stub. */
function resolvePnpDescription(
  title: string,
  rsvpUrl: string | undefined,
  fromPage?: string,
): string {
  const page = fromPage?.trim();
  if (page && looksLikeEventAbout(page)) return page;

  const override = aboutOverrideForUrl(rsvpUrl);
  if (override) return override;

  const fromTitle = eventLineFromBookstoreTitle(title);
  if (fromTitle) return fromTitle;

  if (page) return page;
  return "Details from Politics and Prose.";
}

function looksLikeEventAbout(text: string): boolean {
  const t = text.replace(/\s+/g, " ").trim();
  if (!t || /^[a-z]/.test(t)) return false;
  // Plot-first blurbs are never good About copy for Lit List cards.
  if (/^(?:In (?:the )?\d{4}s?|When the|Meanwhile,)\b/i.test(t)) return false;
  return /\b(?:in conversation with|will be joined in conversation|discusses .+ in conversation|discusses her debut|discusses his debut)\b/i.test(
    t.slice(0, 180),
  );
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

  // Retail / membership promos are not literary programming.
  if (/\bmember\s+sale\b|\bmembership\s+sale\b/i.test(title)) return null;

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
    description: resolvePnpDescription(title, rsvpUrl, opts?.description),
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
