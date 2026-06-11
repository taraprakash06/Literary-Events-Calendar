import { DateTime } from "luxon";
import type {
  EventFormat,
  PriceKind,
  WorkshopEvent,
  WorkshopEventCategory,
} from "@/lib/workshop-types";
import { decodeHtmlEntities, stripHtmlAndDecode, toShortOverview } from "@/lib/text";

const ORIGIN = "https://www.writersgrotto.org";
export const WRITERS_GROTTO_CALENDAR_URL = `${ORIGIN}/classes-events`;
const DEFAULT_ADDRESS = "466 Bryant St, San Francisco, CA 94107";
const TZ = "America/Los_Angeles";

const UA =
  "calendar_literary/1.0 (+https://github.com/taraprakash06/literary-events-calendar)";

export type WritersGrottoMeta = {
  calendarPageFetched: boolean;
  listingsParsed: number;
  detailPagesFetched: number;
  rowsInMonth: number;
};

type CalendarListing = {
  title: string;
  timeRange: string;
  day: DateTime;
  path?: string;
  identifier?: string;
};

type DetailInfo = {
  description: string;
  price: PriceKind;
  format: EventFormat;
  venue?: string;
  address?: string;
  rsvpUrl: string;
};

async function fetchText(url: string, signal?: AbortSignal): Promise<string> {
  const res = await fetch(url, {
    headers: {
      Accept: "text/html,application/xhtml+xml",
      "Accept-Language": "en-US,en;q=0.9",
      "User-Agent": UA,
      Referer: ORIGIN,
    },
    cache: "no-store",
    signal,
  });
  if (!res.ok) throw new Error(`Writers Grotto HTTP ${res.status} for ${url}`);
  return res.text();
}

function parseCalendarListings(html: string): CalendarListing[] {
  const re =
    /<div class="ncf-date-template">([\s\S]*?)(?=<div class="ncf-date-template">|<div class="ncf-date-day-template">|$)/gi;
  const items: CalendarListing[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const block = m[1];
    const dateRaw = block.match(/data-date="([^"]+)"/)?.[1];
    const title = block.match(/appointment-title">([^<]+)</)?.[1]?.trim();
    const timeRange = block.match(
      /from-to-flex[^>]*>[\s\S]*?text-block">([^<]+)</,
    )?.[1]?.trim();
    const href = block.match(/calendar-detail-button"><a href="([^"]*)"/)?.[1];
    const identifier = block.match(/class="identifyer"[^>]*id="([^"]+)"/)?.[1];
    if (!dateRaw || !title || !timeRange) continue;

    const day = DateTime.fromISO(dateRaw, { zone: TZ });
    if (!day.isValid) continue;

    const path =
      href && href !== "#" && href.startsWith("/")
        ? href
        : undefined;

    items.push({
      title,
      timeRange,
      day: day.startOf("day"),
      path,
      identifier,
    });
  }
  return items;
}

function meridiemFromToken(tok: string): string | undefined {
  return tok.match(/(am|pm)\b/i)?.[1]?.toLowerCase();
}

function normalizeTimeToken(tok: string, fallbackMeridiem?: string): string {
  let t = tok.trim().toLowerCase();
  t = t.replace(/(\d{1,2}:\d{2})(am|pm)\b/i, "$1 $2");
  t = t.replace(/(\d{1,2})(am|pm)\b/i, "$1:00 $2");
  if (!meridiemFromToken(t) && fallbackMeridiem) t = `${t} ${fallbackMeridiem}`;
  if (/^\d{1,2}:\d{2}$/.test(t) && fallbackMeridiem) t = `${t} ${fallbackMeridiem}`;
  if (/^\d{1,2}\s*(am|pm)\b/i.test(t)) {
    t = t.replace(/^(\d{1,2})\s*(am|pm)\b/i, "$1:00 $2");
  }
  return t.toUpperCase();
}

function parseTimeRange(
  timeRange: string,
  day: DateTime,
): { start: DateTime; end: DateTime } | null {
  const raw = timeRange.replace(/\s*PT\s*$/i, "").trim();
  const split = raw.match(/^(.+?)\s*-\s*(.+)$/);
  const startTok = (split?.[1] ?? raw).trim();
  const endTok = split?.[2]?.trim() ?? "";

  const endMer = meridiemFromToken(endTok);
  const startMer = meridiemFromToken(startTok) ?? endMer;
  const startNorm = normalizeTimeToken(startTok, startMer);
  const dateStr = day.toFormat("yyyy-MM-dd");

  const start = DateTime.fromFormat(
    `${dateStr} ${startNorm}`,
    "yyyy-MM-dd h:mm a",
    { zone: TZ, locale: "en" },
  );
  if (!start.isValid) return null;

  let end: DateTime;
  if (endTok) {
    const endNorm = normalizeTimeToken(endTok, endMer ?? startMer);
    end = DateTime.fromFormat(`${dateStr} ${endNorm}`, "yyyy-MM-dd h:mm a", {
      zone: TZ,
      locale: "en",
    });
    if (!end.isValid) end = start.plus({ hours: 2 });
    else if (end <= start) end = end.plus({ days: 1 });
  } else {
    end = start.plus({ hours: 2 });
  }

  return { start, end };
}

function cleanTitle(title: string): string {
  return title
    .replace(/^(CLASS|EVENT)\s+/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

function mapCategory(title: string, description: string): WorkshopEventCategory {
  const b = `${title}\n${description}`.toLowerCase();
  if (/\b(open mic|poetry slam)\b/.test(b)) return "open-mic";
  if (/\b(write-in|salon)\b/.test(b)) return "workshop";
  if (/\b(reading|aloud\/out loud|aloud)\b/.test(b)) return "reading";
  if (/\b(workshop|class|course|session)\b/.test(b)) return "workshop";
  if (/\b(panel|in conversation|conversation|lecture|info session)\b/.test(b)) {
    return "panel";
  }
  if (/\b(festival|lit crawl|fair)\b/.test(b)) return "festival";
  return "workshop";
}

function parsePrice(text: string): PriceKind {
  const m = text.match(/Course Fee:\s*\$?\s*(\d+(?:\.\d{2})?)/i);
  if (!m) return "unknown";
  const n = Number(m[1]);
  if (!Number.isFinite(n)) return "unknown";
  if (n <= 0) return "free";
  return "paid";
}

function detectFormat(text: string): EventFormat {
  const b = text.toLowerCase();
  const hasZoom = /\b(via zoom|zoom)\b/.test(b);
  const hasVenue =
    /\bsan francisco,\s*ca\b/.test(b) ||
    /\btelegraph hill books\b/.test(b) ||
    /\bsfpl\b/.test(b) ||
    /\bwriters grotto\b/.test(b);
  if (hasZoom && hasVenue) return "hybrid";
  if (hasZoom) return "virtual";
  if (/\bsfpl\b|san francisco public library/i.test(b)) return "in-person";
  return "in-person";
}

function parseDetailPage(html: string, path: string): DetailInfo {
  const canonical = stripHtmlAndDecode(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " "),
  );

  const h1 = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1];
  const titleFromH1 = h1
    ? decodeHtmlEntities(h1.replace(/<[^>]+>/g, "")).replace(/\s+/g, " ").trim()
    : "";

  const narrative =
    canonical.match(
      /(?:Take some time|Join us|In this)[\s\S]{40,900}?(?=Course Fee:|Dates, Times|Register Now|Follow us on social|$)/i,
    )?.[0] ?? canonical.slice(0, 900);

  const description = toShortOverview(
    narrative || titleFromH1 || "Writers Grotto class or event.",
    520,
  );

  const price = parsePrice(canonical);
  const format = detectFormat(canonical);

  const venue =
    canonical.match(/\bTelegraph Hill Books\b[^\n,]*/i)?.[0]?.trim() ??
    (/\bsfpl\b|san francisco public library/i.test(canonical)
      ? "San Francisco Public Library"
      : format === "virtual"
        ? undefined
        : "The Writers Grotto");

  const address =
    canonical.match(/\b\d{3,5}\s+[^,\n]+,\s*San Francisco,\s*CA\s*\d{5}\b/i)?.[0]?.trim() ??
    (format === "virtual" ? undefined : DEFAULT_ADDRESS);

  const external = html.match(
    /href="(https?:\/\/[^"]+(?:eventbrite|humanitix|luma\.to|ticket)[^"]*)"/i,
  )?.[1];
  const rsvpUrl = external ?? `${ORIGIN}${path}`;

  return { description, price, format, venue, address, rsvpUrl };
}

function stableId(
  path: string | undefined,
  identifier: string | undefined,
  title: string,
  start: DateTime,
): string {
  const slug =
    (path?.split("/").pop() ?? identifier ?? title)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "event";
  return `writers-grotto-${slug}-${start.toFormat("yyyyLLddHHmm")}`;
}

function listingToEvent(
  listing: CalendarListing,
  when: { start: DateTime; end: DateTime },
  detail?: DetailInfo,
): WorkshopEvent {
  const title = cleanTitle(listing.title);
  const path = listing.path;
  const description =
    detail?.description ?? toShortOverview(title, 240);
  const format = detail?.format ?? detectFormat(`${title}\n${description}`);
  const price = detail?.price ?? "unknown";
  const category = mapCategory(title, description);

  const venue =
    detail?.venue ??
    (/\bsfpl\b/i.test(title)
      ? "San Francisco Public Library"
      : format === "virtual"
        ? "The Writers Grotto"
        : "The Writers Grotto");

  const address =
    detail?.address ??
    (format === "virtual" ? undefined : DEFAULT_ADDRESS);

  const rsvpUrl =
    detail?.rsvpUrl ??
    (path ? `${ORIGIN}${path}` : WRITERS_GROTTO_CALENDAR_URL);

  return {
    id: stableId(path, listing.identifier, title, when.start),
    cityId: "sf",
    title,
    tagline: venue,
    description,
    start: when.start.toISO() ?? when.start.toString(),
    end: when.end.toISO() ?? undefined,
    timeZone: TZ,
    format,
    price,
    category,
    organizer: "The Writers Grotto",
    venue,
    address,
    neighborhood: "San Francisco",
    virtualLabel: format !== "in-person" ? "Online (Writers Grotto)" : undefined,
    rsvpUrl,
    source: "The Writers Grotto (writersgrotto.org)",
    sourceChannel: "literary_org",
    listingProvenance: "live",
  };
}

async function fetchDetailsForPaths(
  paths: string[],
  signal?: AbortSignal,
): Promise<Map<string, DetailInfo>> {
  const out = new Map<string, DetailInfo>();
  const unique = [...new Set(paths)];
  const batchSize = 6;
  for (let i = 0; i < unique.length; i += batchSize) {
    const batch = unique.slice(i, i + batchSize);
    await Promise.all(
      batch.map(async (path) => {
        try {
          const html = await fetchText(`${ORIGIN}${path}`, signal);
          out.set(path, parseDetailPage(html, path));
        } catch {
          /* keep calendar-only data */
        }
      }),
    );
  }
  return out;
}

export async function fetchWritersGrottoEventsForMonth(
  year: number,
  monthIndex: number,
  signal?: AbortSignal,
): Promise<{ events: WorkshopEvent[]; meta: WritersGrottoMeta }> {
  const monthStart = DateTime.fromObject(
    { year, month: monthIndex + 1, day: 1 },
    { zone: TZ },
  ).startOf("day");
  const monthEnd = monthStart.endOf("month").endOf("day");

  const html = await fetchText(WRITERS_GROTTO_CALENDAR_URL, signal);
  const listings = parseCalendarListings(html);

  const inMonth = listings
    .map((listing) => {
      const when = parseTimeRange(listing.timeRange, listing.day);
      if (!when) return null;
      if (when.start < monthStart || when.start > monthEnd) return null;
      return { listing, when };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  const detailPaths = inMonth
    .map(({ listing }) => listing.path)
    .filter((p): p is string => Boolean(p));
  const details = await fetchDetailsForPaths(detailPaths, signal);

  const seen = new Set<string>();
  const events: WorkshopEvent[] = [];
  for (const { listing, when } of inMonth) {
    const key = `${when.start.toISO()}-${listing.path ?? listing.identifier ?? listing.title}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const detail = listing.path ? details.get(listing.path) : undefined;
    events.push(listingToEvent(listing, when, detail));
  }

  events.sort(
    (a, b) => new Date(a.start).getTime() - new Date(b.start).getTime(),
  );

  return {
    events,
    meta: {
      calendarPageFetched: true,
      listingsParsed: listings.length,
      detailPagesFetched: details.size,
      rowsInMonth: events.length,
    },
  };
}
