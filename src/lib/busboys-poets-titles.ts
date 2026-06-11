import type { BusboysEventsMoreRow } from "@/lib/busboys-poets-client";
import { decodeHtmlEntities } from "@/lib/text";

const UA = "calendar_literary/1.0 (+https://github.com/taraprakash06/literary-events-calendar)";

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

async function fetchFullTitleFromUrl(url: string): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(url, {
      headers: { Accept: "text/html", "User-Agent": UA },
      cache: "no-store",
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const html = await res.text();
    return parseEventPageTitle(html);
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
 * Resolves full event titles for rows whose API `name` ends with &hellip;.
 * Results are keyed by WordPress event ID.
 */
export async function resolveFullBusboysTitles(
  rows: BusboysEventsMoreRow[],
): Promise<Map<number, string>> {
  const truncated = rows.filter((r) => isTruncatedBusboysName(r.name) && r.url?.trim());
  const uniqueUrls = [...new Set(truncated.map((r) => r.url.trim()))];
  const byUrl = new Map<string, string>();

  await mapWithConcurrency(uniqueUrls, 6, async (url) => {
    const title = await fetchFullTitleFromUrl(url);
    if (title) byUrl.set(url, title);
  });

  const byId = new Map<number, string>();
  for (const row of truncated) {
    const full = byUrl.get(row.url.trim());
    if (full) byId.set(row.ID, full);
  }
  return byId;
}
