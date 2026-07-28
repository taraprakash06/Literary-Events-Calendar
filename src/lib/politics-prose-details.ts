import type { PriceKind } from "@/lib/workshop-types";
import {
  inferPriceFromEventPageText,
  parseEnrichmentFromEventPageHtml,
} from "@/lib/rsvp-page-enrichment";

/** Browser-like UA — Politics & Prose blocks generic scrapers with 403. */
const UA =
  "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)";

export type PoliticsProsePageDetails = {
  price?: PriceKind;
  description?: string;
};

export function inferPoliticsProsePriceFromPage(html: string): PriceKind | undefined {
  return inferPriceFromEventPageText(
    html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " "),
  );
}

async function fetchHtml(url: string): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
  try {
    const res = await fetch(url, {
      headers: {
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "en-US,en;q=0.9",
        "User-Agent": UA,
      },
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

/**
 * Fetches Politics & Prose event pages to resolve free/paid and About text
 * when the FullCalendar feed omits them.
 */
export async function resolvePoliticsProsePageDetails(
  urls: string[],
): Promise<Map<string, PoliticsProsePageDetails>> {
  const unique = [...new Set(urls.map((u) => u.trim()).filter(Boolean))];
  const byUrl = new Map<string, PoliticsProsePageDetails>();

  await mapWithConcurrency(unique, 6, async (url) => {
    const html = await fetchHtml(url);
    if (!html) return;
    const parsed = parseEnrichmentFromEventPageHtml(html);
    if (parsed.price || parsed.description) byUrl.set(url, parsed);
  });

  return byUrl;
}
