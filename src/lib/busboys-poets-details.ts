import type { BusboysEventsMoreRow } from "@/lib/busboys-poets-client";
import { BUSBOYS_POETS_TIMEZONE, parseBusboysRowStart } from "@/lib/busboys-poets-client";
import { DateTime } from "luxon";
import { decodeHtmlEntities } from "@/lib/text";

const UA = "calendar_literary/1.0 (+https://github.com/taraprakash06/literary-events-calendar)";

/**
 * End times confirmed on the event page (flyer / listing copy) when Busboys'
 * Event Espresso CMS still has the site-wide default duration (+2 hours).
 * Public pages usually show start only; the flyer is the accurate end.
 */
const END_OVERRIDES_LOCAL: Record<number, { hour: number; minute?: number }> = {
  // Flyer on https://www.busboysandpoets.com/events/whistleblower-book-signing-and-author-discussion/
  // reads "6 PM - 9 PM" (CMS end was the default 8:00 pm).
  88925: { hour: 21, minute: 0 },
};

export type BusboysEventDetails = {
  title?: string;
  endISO?: string;
};

/** API list truncates long titles with an ellipsis entity. */
export function isTruncatedBusboysName(name: string): boolean {
  return /&hellip;|&#x0*2026;|&#0*8230;/i.test(name) || /\u2026\s*$/.test(name.trim());
}

function parseEventPageTitle(html: string): string | null {
  const og =
    html.match(/property=["']og:title["'][^>]*content=["']([^"']+)["']/i)?.[1] ??
    html.match(/content=["']([^"']+)["'][^>]*property=["']og:title["']/i)?.[1] ??
    html.match(/<h1[^>]*class=["'][^"']*entry-title[^"']*["'][^>]*>([\s\S]*?)<\/h1>/i)?.[1];
  if (!og) return null;
  const decoded = decodeHtmlEntities(og.replace(/<[^>]+>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
  const stripped = decoded
    .replace(/\s*[-|]\s*Busboys and Poets\s*$/i, "")
    .replace(/\s+/g, " ")
    .trim();
  return stripped || null;
}

/** e.g. "6 PM - 9 PM", "6:00pm–9:00pm" in page copy (not image OCR). */
function parseTimeRangeEndHour(html: string): { hour: number; minute: number } | null {
  const text = decodeHtmlEntities(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " "),
  );
  const m = text.match(
    /\b(\d{1,2})(?::(\d{2}))?\s*(a\.?m\.?|p\.?m\.?)\s*[-–—to]+\s*(\d{1,2})(?::(\d{2}))?\s*(a\.?m\.?|p\.?m\.?)\b/i,
  );
  if (!m) return null;
  let hour = Number(m[4]);
  const minute = m[5] ? Number(m[5]) : 0;
  const ap = m[6].toLowerCase().replace(/\./g, "");
  if (ap.startsWith("p") && hour < 12) hour += 12;
  if (ap.startsWith("a") && hour === 12) hour = 0;
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  return { hour, minute };
}

async function fetchHtml(url: string): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(url, {
      headers: { Accept: "text/html", "User-Agent": UA },
      cache: "no-store",
      signal: controller.signal,
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  if (items.length === 0) return [];
  const results = new Array<R>(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i]);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, () => worker()),
  );
  return results;
}

function endISOFromStart(
  start: DateTime,
  hour: number,
  minute: number,
): string | undefined {
  const end = start.set({ hour, minute, second: 0, millisecond: 0 });
  if (!end.isValid || end <= start) return undefined;
  return end.setZone(BUSBOYS_POETS_TIMEZONE).toISO() ?? undefined;
}

/**
 * Resolves full titles for truncated list names, and end times only when the
 * event page (or a flyer-backed override) confirms them.
 *
 * We intentionally do **not** invent a +2h end: Busboys Event Espresso uses a
 * 2-hour default that often disagrees with flyers, and public pages usually
 * show start time only.
 */
export async function resolveBusboysEventDetails(
  rows: BusboysEventsMoreRow[],
): Promise<Map<number, BusboysEventDetails>> {
  const byId = new Map<number, BusboysEventDetails>();
  if (rows.length === 0) return byId;

  for (const row of rows) {
    const override = END_OVERRIDES_LOCAL[row.ID];
    if (!override) continue;
    const start = parseBusboysRowStart(row);
    if (!start) continue;
    const endISO = endISOFromStart(start, override.hour, override.minute ?? 0);
    if (endISO) byId.set(row.ID, { endISO });
  }

  const needHtml = rows.filter(
    (r) =>
      r.url?.trim() &&
      (isTruncatedBusboysName(r.name) || END_OVERRIDES_LOCAL[r.ID]),
  );
  const uniqueUrls = [...new Set(needHtml.map((r) => r.url.trim()))];
  const titleByUrl = new Map<string, string>();
  const rangeByUrl = new Map<string, { hour: number; minute: number }>();

  await mapWithConcurrency(uniqueUrls, 6, async (url) => {
    const html = await fetchHtml(url);
    if (!html) return;
    const title = parseEventPageTitle(html);
    if (title) titleByUrl.set(url, title);
    const range = parseTimeRangeEndHour(html);
    if (range) rangeByUrl.set(url, range);
  });

  for (const row of needHtml) {
    const url = row.url.trim();
    const prev = byId.get(row.ID) ?? {};
    const title = titleByUrl.get(url);
    if (title) prev.title = title;

    // Prefer curated flyer override; else explicit text range on the page.
    if (!prev.endISO && rangeByUrl.has(url)) {
      const start = parseBusboysRowStart(row);
      const range = rangeByUrl.get(url)!;
      if (start) {
        const endISO = endISOFromStart(start, range.hour, range.minute);
        if (endISO) prev.endISO = endISO;
      }
    }

    if (prev.title || prev.endISO) byId.set(row.ID, prev);
  }

  return byId;
}

/** @deprecated Prefer resolveBusboysEventDetails */
export async function resolveFullBusboysTitles(
  rows: BusboysEventsMoreRow[],
): Promise<Map<number, string>> {
  const details = await resolveBusboysEventDetails(rows);
  const byId = new Map<number, string>();
  for (const [id, d] of details) {
    if (d.title) byId.set(id, d.title);
  }
  return byId;
}
