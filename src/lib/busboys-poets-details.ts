import type { BusboysEventsMoreRow } from "@/lib/busboys-poets-client";
import { BUSBOYS_POETS_TIMEZONE, parseBusboysRowStart } from "@/lib/busboys-poets-client";
import type { PriceKind } from "@/lib/workshop-types";
import { DateTime } from "luxon";
import { decodeHtmlEntities, limitAboutToSentences } from "@/lib/text";

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
  description?: string;
  price?: PriceKind;
  priceDetail?: string;
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

function cleanBusboysAbout(plain: string): string {
  return limitAboutToSentences(
    plain
      .replace(
        /(A Busboys and Poetry Event hosted this week by .+?)\s+\1/i,
        "$1 ",
      )
      .replace(/([a-z])([A-Z])/g, "$1 $2")
      .replace(/\s+/g, " ")
      .replace(/\s*&\s*hellip;?\s*$/i, "")
      .replace(/\u2026\s*$/g, "")
      .trim(),
    4,
  );
}

/** Pull About copy from Busboys event page HTML (Description block preferred over truncated JSON-LD). */
export function parseBusboysDescriptionFromHtml(html: string): string | undefined {
  const candidates: string[] = [];

  const block = html.match(
    /Description:\s*<\/[^>]+>\s*([\s\S]*?)(?:<h[1-4][^>]*>|\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2},\s+20\d{2}\b|Go to Events)/i,
  );
  if (block?.[1]) {
    const plain = cleanBusboysAbout(
      decodeHtmlEntities(block[1].replace(/<[^>]+>/g, " ")),
    );
    if (plain.length > 60) candidates.push(plain);
  }

  for (const m of html.matchAll(
    /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
  )) {
    try {
      const data = JSON.parse(m[1]) as unknown;
      const nodes = Array.isArray(data)
        ? data
        : data && typeof data === "object" && "@graph" in (data as object)
          ? ((data as { "@graph": unknown })["@graph"] as unknown[])
          : [data];
      for (const node of nodes) {
        if (!node || typeof node !== "object") continue;
        const n = node as { "@type"?: string | string[]; description?: string };
        const type = n["@type"];
        const isEvent =
          type === "Event" ||
          (Array.isArray(type) && type.includes("Event"));
        if (!isEvent || !n.description?.trim()) continue;
        const plain = cleanBusboysAbout(decodeHtmlEntities(n.description));
        if (plain.length > 60) candidates.push(plain);
      }
    } catch {
      /* ignore bad JSON-LD */
    }
  }

  if (candidates.length === 0) return undefined;
  candidates.sort((a, b) => b.length - a.length);
  return candidates[0];
}

/** Cover / ticket language from Busboys listing pages (list API price is usually empty). */
export function parseBusboysPricingFromText(text: string): {
  price?: PriceKind;
  priceDetail?: string;
} {
  if (!text.trim()) return {};

  const cover = text.match(/\$\s*(\d+(?:\.\d{2})?)\s+cover\b/i);
  if (cover) {
    return { price: "paid", priceDetail: `$${cover[1]} cover` };
  }

  const admission = text.match(
    /\b(?:admission|tickets?|cover(?:\s+charge)?)\s*(?:is|:)?\s*\$\s*(\d+(?:\.\d{2})?)\b/i,
  );
  if (admission) {
    return { price: "paid", priceDetail: `$${admission[1]}` };
  }

  if (
    /\bthis event is free\b/i.test(text) ||
    /\bfree admission\b/i.test(text) ||
    /\bfree and open to the public\b/i.test(text) ||
    /\bno\s+cover\b/i.test(text)
  ) {
    return { price: "free" };
  }

  if (
    /\bpurchase\s+(?:your\s+)?(?:wristbands?|tickets?)\b/i.test(text) ||
    /\bticket purchase limit\b/i.test(text) ||
    /\bwristbands?\s+are\s+available\s+for\s+purchase\b/i.test(text)
  ) {
    return { price: "paid" };
  }

  return {};
}

export function parseBusboysPricingFromHtml(html: string): {
  price?: PriceKind;
  priceDetail?: string;
} {
  const fromAbout = parseBusboysPricingFromText(
    parseBusboysDescriptionFromHtml(html) ?? "",
  );
  if (fromAbout.price) return fromAbout;

  const text = decodeHtmlEntities(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " "),
  ).replace(/\s+/g, " ");
  return parseBusboysPricingFromText(text);
}

function looksLiteraryBusboysRow(row: BusboysEventsMoreRow): boolean {
  const blob = `${row.name ?? ""} ${row.category ?? ""}`.toLowerCase();
  return /\b(poetry|open\s*mic|author|book|writer|writing|literary|spoken\s*word|slam|reading)\b/.test(
    blob,
  );
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
 * Resolves full titles, flyer-backed end times, About copy, and pricing from event pages.
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
      (isTruncatedBusboysName(r.name) ||
        END_OVERRIDES_LOCAL[r.ID] ||
        looksLiteraryBusboysRow(r)),
  );
  const uniqueUrls = [...new Set(needHtml.map((r) => r.url.trim()))];
  const titleByUrl = new Map<string, string>();
  const rangeByUrl = new Map<string, { hour: number; minute: number }>();
  const descriptionByUrl = new Map<string, string>();
  const pricingByUrl = new Map<
    string,
    { price?: PriceKind; priceDetail?: string }
  >();

  await mapWithConcurrency(uniqueUrls, 6, async (url) => {
    const html = await fetchHtml(url);
    if (!html) return;
    const title = parseEventPageTitle(html);
    if (title) titleByUrl.set(url, title);
    const range = parseTimeRangeEndHour(html);
    if (range) rangeByUrl.set(url, range);
    const description = parseBusboysDescriptionFromHtml(html);
    if (description) descriptionByUrl.set(url, description);
    const pricing = parseBusboysPricingFromHtml(html);
    if (pricing.price) pricingByUrl.set(url, pricing);
  });

  for (const row of needHtml) {
    const url = row.url.trim();
    const prev = byId.get(row.ID) ?? {};
    const title = titleByUrl.get(url);
    if (title) prev.title = title;

    const description = descriptionByUrl.get(url);
    if (description) prev.description = description;

    const pricing = pricingByUrl.get(url);
    if (pricing?.price) {
      prev.price = pricing.price;
      if (pricing.priceDetail) prev.priceDetail = pricing.priceDetail;
    }

    // Prefer curated flyer override; else explicit text range on the page.
    if (!prev.endISO && rangeByUrl.has(url)) {
      const start = parseBusboysRowStart(row);
      const range = rangeByUrl.get(url)!;
      if (start) {
        const endISO = endISOFromStart(start, range.hour, range.minute);
        if (endISO) prev.endISO = endISO;
      }
    }

    if (prev.title || prev.endISO || prev.description || prev.price) {
      byId.set(row.ID, prev);
    }
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
