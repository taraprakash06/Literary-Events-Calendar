import type { TwcTribeEvent } from "@/lib/writers-center-map";
import type { PriceKind } from "@/lib/workshop-types";
import { decodeHtmlEntities } from "@/lib/text";

const UA = "calendar_literary/1.0 (+https://github.com/taraprakash06/literary-events-calendar)";

export type WritersCenterPageDetails = {
  price?: PriceKind;
  priceDetail?: string;
  description?: string;
};

/** e.g. "Cost: $ 280.00 for members $ 295.00 for non-members" */
export function parseTwcPricingFromText(text: string): {
  price?: PriceKind;
  priceDetail?: string;
} {
  const t = text.replace(/\s+/g, " ").trim();
  if (!t) return {};

  const member = t.match(
    /\$\s*([\d,]+(?:\.\d{2})?)\s*for\s+members\s*\$\s*([\d,]+(?:\.\d{2})?)\s*for\s+non-?members/i,
  );
  if (member) {
    return {
      price: "paid",
      priceDetail: `$${trimMoney(member[1])} members · $${trimMoney(member[2])} non-members`,
    };
  }

  const costLine = t.match(
    /\bCost:\s*\$\s*([\d,]+(?:\.\d{2})?)(?:\s*[-–—]\s*\$\s*([\d,]+(?:\.\d{2})?))?/i,
  );
  if (costLine) {
    if (costLine[2]) {
      return {
        price: "paid",
        priceDetail: `$${trimMoney(costLine[1])}–$${trimMoney(costLine[2])}`,
      };
    }
    return { price: "paid", priceDetail: `$${trimMoney(costLine[1])}` };
  }

  return {};
}

export function parseTwcPricingFromHtml(html: string): {
  price?: PriceKind;
  priceDetail?: string;
} {
  const text = decodeHtmlEntities(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " "),
  );
  return parseTwcPricingFromText(text);
}

/** Fallback from TEC `cost` / `cost_details` when the page wasn't scraped. */
export function priceDetailFromTwcCost(ev: TwcTribeEvent): string | undefined {
  const details = (
    ev as TwcTribeEvent & {
      cost_details?: { values?: string[]; currency_symbol?: string };
    }
  ).cost_details;
  const values = details?.values ?? [];
  if (values.length === 1 && /^\d/.test(values[0])) {
    return `$${trimMoney(values[0])}`;
  }
  if (values.length >= 2) {
    return `$${trimMoney(values[0])}–$${trimMoney(values[1])}`;
  }

  const decoded = decodeHtmlEntities(ev.cost ?? "").replace(/\s+/g, " ").trim();
  if (!decoded || /free/i.test(decoded)) return undefined;
  const m = decoded.match(/([\d,]+(?:\.\d{2})?)/);
  return m ? `$${trimMoney(m[1])}` : undefined;
}

function trimMoney(raw: string): string {
  const n = raw.replace(/,/g, "");
  if (/\.00$/.test(n)) return n.slice(0, -3);
  return n;
}

async function fetchHtml(url: string): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
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

function needsPagePricing(ev: TwcTribeEvent): boolean {
  const url = ev.url?.trim();
  if (!url) return false;
  const cost = decodeHtmlEntities(ev.cost ?? "").toLowerCase();
  if (cost.includes("free") || cost === "0") return false;
  // Paid workshops usually show member vs non-member only on the public page.
  const isWorkshop = (ev.categories ?? []).some(
    (c) => c.slug?.toLowerCase() === "workshop",
  );
  return isWorkshop && (/\$|\d|&#036;/i.test(ev.cost ?? "") || !ev.cost?.trim());
}

/**
 * Fetches Writer's Center event pages for member/non-member Cost lines.
 * TEC REST often only exposes the non-member sticker price.
 */
export async function resolveWritersCenterPageDetails(
  events: TwcTribeEvent[],
): Promise<Map<number, WritersCenterPageDetails>> {
  const byId = new Map<number, WritersCenterPageDetails>();
  const need = events.filter(needsPagePricing);
  const uniqueUrls = [...new Set(need.map((e) => e.url.trim()))];
  const pricingByUrl = await resolveWritersCenterPricingByUrls(uniqueUrls);

  for (const ev of need) {
    const fromPage = pricingByUrl.get(ev.url.trim());
    if (fromPage) byId.set(ev.id, fromPage);
  }

  return byId;
}

/** Scrape Cost lines for a set of writer.org event URLs. */
export async function resolveWritersCenterPricingByUrls(
  urls: string[],
): Promise<Map<string, WritersCenterPageDetails>> {
  const uniqueUrls = [...new Set(urls.map((u) => u.trim()).filter(Boolean))];
  const pricingByUrl = new Map<string, WritersCenterPageDetails>();

  await mapWithConcurrency(uniqueUrls, 8, async (url) => {
    const html = await fetchHtml(url);
    if (!html) return;
    const pricing = parseTwcPricingFromHtml(html);
    if (pricing.price || pricing.priceDetail) pricingByUrl.set(url, pricing);
  });

  return pricingByUrl;
}
