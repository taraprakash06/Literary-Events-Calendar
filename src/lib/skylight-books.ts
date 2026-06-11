import { DateTime } from "luxon";
import type {
  EventFormat,
  PriceKind,
  WorkshopEvent,
  WorkshopEventCategory,
} from "@/lib/workshop-types";
import { decodeHtmlEntities, stripHtmlAndDecode, toShortOverview } from "@/lib/text";

const ORIGIN = "https://www.skylightbooks.com";
const EVENTS_URL = `${ORIGIN}/event`;
const TZ = "America/Los_Angeles";
const DEFAULT_ADDRESS = "1818 N Vermont Ave, Los Angeles, CA 90027";

const UA =
  "calendar_literary/1.0 (+https://github.com/taraprakash06/literary-events-calendar)";

export type SkylightBooksMeta = {
  monthPageFetched: boolean;
  pathsFound: number;
  detailPagesFetched: number;
  rowsInMonth: number;
};

async function fetchText(url: string, signal?: AbortSignal): Promise<string> {
  const res = await fetch(url, {
    headers: { Accept: "text/html", "User-Agent": UA },
    cache: "no-store",
    signal,
  });
  if (!res.ok) {
    throw new Error(`Skylight Books HTTP ${res.status} for ${url}`);
  }
  return res.text();
}

function monthPageUrl(year: number, monthIndex: number): string {
  const mm = String(monthIndex + 1).padStart(2, "0");
  return `${EVENTS_URL}/${year}-${mm}`;
}

function parseEventPaths(html: string): string[] {
  const paths = [...html.matchAll(/href="(\/event\/[^"#?]+)"/gi)]
    .map((m) => m[1].trim())
    .filter((p) => !/^\/event\/\d{4}-\d{2}$/.test(p))
    .filter((p) => p.startsWith("/event/") && p.length > "/event/".length + 2);
  return [...new Set(paths)];
}

function parseEventDate(html: string): DateTime | null {
  const text = decodeHtmlEntities(
    articleHtml(html).replace(/<[^>]+>/g, " ").replace(/\s+/g, " "),
  );
  const m = text.match(
    /Event date:\s*(?:\s|&nbsp;)*([A-Za-z]+day,\s+[A-Za-z]+\s+\d{1,2},\s+\d{4}\s*-\s*\d{1,2}:\d{2}(?:am|pm))/i,
  );
  if (!m) return null;
  const dt = DateTime.fromFormat(m[1].trim(), "cccc, LLLL d, yyyy - h:mma", {
    zone: TZ,
    locale: "en",
  });
  return dt.isValid ? dt : null;
}

function articleHtml(html: string): string {
  return (
    html.match(/<article[^>]*class="[^"]*node-event[^"]*"[\s\S]*?<\/article>/i)?.[0] ??
    html.match(/<article[^>]*>[\s\S]*?<\/article>/i)?.[0] ??
    html
  );
}

function parseEventAddress(html: string): string | undefined {
  const scope = articleHtml(html);
  const thoroughfare = scope.match(
    /field-name-field-address[\s\S]*?class="thoroughfare"[^>]*>([^<]+)</i,
  )?.[1];
  const locality = scope.match(
    /field-name-field-address[\s\S]*?class="locality"[^>]*>([^<]+)</i,
  )?.[1];
  const state = scope.match(
    /field-name-field-address[\s\S]*?class="state"[^>]*>([^<]+)</i,
  )?.[1];
  const postal = scope.match(
    /field-name-field-address[\s\S]*?class="postal-code"[^>]*>([^<]+)</i,
  )?.[1];
  if (thoroughfare || locality) {
    return [thoroughfare, locality, state, postal]
      .filter(Boolean)
      .map((p) => decodeHtmlEntities(p!.trim()))
      .join(", ")
      .replace(/,\s*,/g, ",")
      .trim();
  }

  const text = decodeHtmlEntities(
    scope.replace(/<[^>]+>/g, " ").replace(/\s+/g, " "),
  );
  const m = text.match(
    /Event address:\s*(?:\s|&nbsp;)*(.+?)(?:\s+Event|\s+CLICK|\s+RSVP|$)/i,
  );
  if (!m) return undefined;
  const addr = m[1]
    .replace(/\s+,/g, ",")
    .replace(/\s+/g, " ")
    .trim();
  return addr || undefined;
}

function parseTitle(html: string): string {
  const pageTitle = html.match(/<h1[^>]*class="[^"]*page-title[^"]*"[^>]*>([\s\S]*?)<\/h1>/i)?.[1];
  if (pageTitle) {
    return decodeHtmlEntities(pageTitle.replace(/<[^>]+>/g, ""))
      .replace(/\s+/g, " ")
      .trim();
  }
  const h1 = articleHtml(html).match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1];
  if (h1) {
    return decodeHtmlEntities(h1.replace(/<[^>]+>/g, ""))
      .replace(/\s+/g, " ")
      .trim();
  }
  const t = html.match(/<title>([^<|]+)/i)?.[1]?.trim();
  if (t) return decodeHtmlEntities(t.replace(/\s*\|.*$/, "")).trim();
  return "Skylight Books event";
}

function parseDescription(html: string): string {
  const scope = articleHtml(html);
  const body =
    scope.match(
      /field-name-body[\s\S]*?<div class="field-items">([\s\S]*?)<\/div>\s*<\/div>\s*<\/div>/i,
    )?.[1] ?? "";
  const text = stripHtmlAndDecode(body);
  return toShortOverview(text, 520);
}

function parseHumanitixUrl(html: string): string | undefined {
  const scope = articleHtml(html);
  const popup = scope.match(/\bhx-popup="([^"]+)"/i)?.[1]?.trim();
  if (popup) return `https://events.humanitix.com/${popup}`;
  return undefined;
}

function parseRsvpUrl(html: string, path: string): string {
  const humanitix = parseHumanitixUrl(html);
  if (humanitix) return humanitix;

  const scope = articleHtml(html);
  const body =
    scope.match(
      /field-name-body[\s\S]*?<div class="field-items">([\s\S]*?)<\/div>\s*<\/div>\s*<\/div>/i,
    )?.[1] ?? "";

  const external = body.match(
    /href="(https?:\/\/[^"]+(?:eventbrite|litcrawl|humanitix|ticket)[^"]*)"/i,
  )?.[1];
  if (external) return external;

  const canonical = scope.match(/rel="canonical"\s+href="([^"]+)"/i)?.[1];
  if (canonical) {
    return canonical.startsWith("http")
      ? canonical
      : `${ORIGIN}${canonical.startsWith("/") ? canonical : `/${canonical}`}`;
  }

  return `${ORIGIN}${path}`;
}

function inferCategory(title: string, description: string): WorkshopEventCategory {
  const b = `${title}\n${description}`.toLowerCase();
  if (/\b(open mic|poetry slam)\b/.test(b)) return "open-mic";
  if (/\b(panel|in conversation|conversation)\b/.test(b)) return "other";
  if (/\b(workshop|class)\b/.test(b)) return "workshop";
  if (/\b(reading|presents|book launch|launch)\b/.test(b)) return "reading";
  if (/\b(festival)\b/.test(b)) return "other";
  if (/\b(book club)\b/.test(b)) return "other";
  return "reading";
}

function inferFormat(text: string): EventFormat {
  if (/\b(zoom|virtual|online)\b/i.test(text)) return "virtual";
  return "in-person";
}

function inferPrice(description: string): PriceKind {
  const b = description.toLowerCase();
  if (/\bfree\b/.test(b) && !/\bnot free\b/.test(b)) return "free";
  if (/\$\d/.test(b) || /\bticket/.test(b)) return "paid";
  return "unknown";
}

function venueLabel(address: string | undefined): string {
  if (!address) return "Skylight Books";
  if (/1818\s+n?\s*vermont/i.test(address)) return "Skylight Books";
  return "Skylight Books (off-site)";
}

function stableId(path: string, start: DateTime): string {
  const slug = path
    .replace(/^\/event\//, "")
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/-+/g, "-")
    .toLowerCase()
    .slice(0, 80);
  return `skylight-books-${slug}-${start.toFormat("yyyyLLddHHmm")}`;
}

function parseEventDetail(html: string, path: string): WorkshopEvent | null {
  const start = parseEventDate(html);
  if (!start) return null;

  const title = parseTitle(html);
  if (!title) return null;

  const description = parseDescription(html) || title;
  const address = parseEventAddress(html) ?? DEFAULT_ADDRESS;
  const url = `${ORIGIN}${path}`;

  return {
    id: stableId(path, start),
    cityId: "la",
    title,
    tagline: "Skylight Books",
    description,
    start: start.toISO() ?? start.toString(),
    end: start.plus({ hours: 2 }).toISO() ?? undefined,
    timeZone: TZ,
    format: inferFormat(description),
    price: inferPrice(description),
    category: inferCategory(title, description),
    organizer: "Skylight Books",
    venue: venueLabel(address),
    address,
    neighborhood: "Los Feliz",
    rsvpUrl: parseRsvpUrl(html, path),
    source: "Skylight Books (skylightbooks.com)",
    sourceChannel: "bookstore",
    listingProvenance: "live",
  };
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

export async function fetchSkylightBooksEventsForMonth(
  year: number,
  monthIndex: number,
  signal?: AbortSignal,
): Promise<{ events: WorkshopEvent[]; meta: SkylightBooksMeta }> {
  const monthStart = DateTime.fromObject(
    { year, month: monthIndex + 1, day: 1 },
    { zone: TZ },
  ).startOf("day");
  const monthEnd = monthStart.endOf("month").endOf("day");

  let monthHtml = "";
  let monthPageFetched = false;
  try {
    monthHtml = await fetchText(monthPageUrl(year, monthIndex), signal);
    monthPageFetched = true;
  } catch {
    monthHtml = await fetchText(EVENTS_URL, signal).catch(() => "");
  }

  let paths = parseEventPaths(monthHtml);
  if (paths.length === 0 && monthPageFetched) {
    const indexHtml = await fetchText(EVENTS_URL, signal).catch(() => "");
    paths = parseEventPaths(indexHtml);
  }

  const parsed = await mapWithConcurrency(paths, 5, async (path) => {
    try {
      const html = await fetchText(`${ORIGIN}${path}`, signal);
      return parseEventDetail(html, path);
    } catch {
      return null;
    }
  });

  const inMonth = parsed
    .filter((e): e is WorkshopEvent => e !== null)
    .filter((e) => {
      const start = DateTime.fromISO(e.start, { setZone: true }).setZone(TZ);
      return start.isValid && start >= monthStart && start <= monthEnd;
    });

  inMonth.sort(
    (a, b) => new Date(a.start).getTime() - new Date(b.start).getTime(),
  );

  return {
    events: inMonth,
    meta: {
      monthPageFetched,
      pathsFound: paths.length,
      detailPagesFetched: paths.length,
      rowsInMonth: inMonth.length,
    },
  };
}
