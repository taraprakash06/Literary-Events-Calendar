import { DateTime } from "luxon";
import type {
  EventFormat,
  PriceKind,
  WorkshopEvent,
  WorkshopEventCategory,
} from "@/lib/workshop-types";
import { decodeHtmlEntities, stripHtmlAndDecode, toShortOverview } from "@/lib/text";

const ORIGIN = "https://www.lastbookstorela.com";
const EVENT_LIST_URL = `${ORIGIN}/event-list`;
const EVENT_SITEMAP_URL = `${ORIGIN}/event-pages-sitemap.xml`;
const TZ = "America/Los_Angeles";

const UA =
  "calendar_literary/1.0 (+https://github.com/taraprakash06/literary-events-calendar)";

export type LastBookstoreMeta = {
  sitemapUrls: number;
  detailPagesFetched: number;
  embeddedFromList: number;
  rowsInMonth: number;
};

type SchemaEvent = {
  "@type"?: string;
  name?: string;
  description?: string;
  startDate?: string;
  endDate?: string;
  eventStatus?: string;
  eventAttendanceMode?: string;
  location?: {
    name?: string;
    address?: string | { streetAddress?: string };
  };
  offers?: {
    lowPrice?: string | number;
    highPrice?: string | number;
    price?: string | number;
  };
};

type WixEmbeddedEvent = {
  id?: string;
  slug?: string;
  title?: string;
  description?: string;
  scheduling?: {
    config?: { startDate?: string; endDate?: string; timeZoneId?: string };
  };
  location?: {
    name?: string;
    address?: string;
    fullAddress?: { formattedAddress?: string };
  };
  registration?: {
    ticketing?: { lowestPrice?: string; highestPrice?: string };
  };
};

async function fetchText(url: string, signal?: AbortSignal): Promise<string> {
  const res = await fetch(url, {
    headers: { Accept: "text/html,application/xml", "User-Agent": UA },
    cache: "no-store",
    signal,
  });
  if (!res.ok) {
    throw new Error(`The Last Bookstore HTTP ${res.status} for ${url}`);
  }
  return res.text();
}

function parseEventSitemapUrls(xml: string): string[] {
  const urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/gi)]
    .map((m) => m[1].trim())
    .filter((u) => /\/event-details\//i.test(u));
  return [...new Set(urls)];
}

function extractEmbeddedEvents(html: string): WixEmbeddedEvent[] {
  const marker = '"events":{"events":[';
  const idx = html.indexOf(marker);
  if (idx < 0) return [];
  let i = idx + marker.length - 1;
  let depth = 0;
  const start = i;
  for (; i < html.length; i++) {
    if (html[i] === "[") depth++;
    else if (html[i] === "]") {
      depth--;
      if (depth === 0) {
        try {
          return JSON.parse(html.slice(start, i + 1)) as WixEmbeddedEvent[];
        } catch {
          return [];
        }
      }
    }
  }
  return [];
}

function parseJsonLdEvent(html: string): SchemaEvent | null {
  const raw = html.match(
    /<script type="application\/ld\+json">([^<]+)<\/script>/i,
  )?.[1];
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as SchemaEvent | SchemaEvent[];
    if (Array.isArray(parsed)) {
      return parsed.find((e) => e["@type"] === "Event") ?? null;
    }
    return parsed["@type"] === "Event" ? parsed : null;
  } catch {
    return null;
  }
}

function slugFromUrl(url: string): string {
  const m = url.match(/\/event-details\/([^/?#]+)/i);
  return (m?.[1] ?? url).toLowerCase();
}

function locationAddress(
  loc: SchemaEvent["location"] | WixEmbeddedEvent["location"],
): { venue: string; address?: string } {
  const name =
    (loc && "name" in loc && loc.name?.trim()) || "The Last Bookstore";
  let address: string | undefined;
  if (loc && "address" in loc) {
    if (typeof loc.address === "string") address = loc.address.trim();
    else if (loc.address && typeof loc.address === "object") {
      address = [
        loc.address.streetAddress,
        (loc as { addressLocality?: string }).addressLocality,
      ]
        .filter(Boolean)
        .join(", ");
    }
  }
  if (!address && loc && "fullAddress" in loc) {
    address = loc.fullAddress?.formattedAddress?.trim();
  }
  return {
    venue: name === "Los Angeles" ? "The Last Bookstore" : `The Last Bookstore — ${name}`,
    address,
  };
}

function priceFromOffers(
  offers: SchemaEvent["offers"] | undefined,
  ticketing?: { lowestPrice?: string; highestPrice?: string },
): PriceKind {
  const raw =
    offers?.lowPrice ??
    offers?.highPrice ??
    offers?.price ??
    ticketing?.lowestPrice ??
    ticketing?.highestPrice;
  if (raw === undefined || raw === null || raw === "") return "unknown";
  const n = Number(String(raw).replace(/[^0-9.]/g, ""));
  if (!Number.isFinite(n)) return "unknown";
  if (n <= 0) return "free";
  return "paid";
}

function inferCategory(title: string, description: string): WorkshopEventCategory {
  const b = `${title}\n${description}`.toLowerCase();
  if (/\b(open mic|standup|stand-up|comedy)\b/.test(b)) return "open-mic";
  if (/\b(poetry|poet|reading)\b/.test(b)) return "reading";
  if (/\b(workshop|class)\b/.test(b)) return "workshop";
  if (/\b(panel|conversation|lecture)\b/.test(b)) return "panel";
  if (/\b(festival|takeover|market|pop-up|popup)\b/.test(b)) return "festival";
  if (/\b(book launch|launch)\b/.test(b)) return "launch";
  if (/\b(book club)\b/.test(b)) return "book-club";
  return "other";
}

function inferFormat(
  attendanceMode: string | undefined,
  text: string,
): EventFormat {
  if (/OnlineEventAttendanceMode/i.test(attendanceMode ?? "")) return "virtual";
  if (/\b(zoom|virtual|online)\b/i.test(text)) return "virtual";
  return "in-person";
}

function parseIsoRange(
  startRaw: string,
  endRaw: string | undefined,
  zone: string,
): { start: DateTime; end?: DateTime } | null {
  const start = DateTime.fromISO(startRaw, { setZone: true }).setZone(zone);
  if (!start.isValid) return null;
  let end: DateTime | undefined;
  if (endRaw) {
    const e = DateTime.fromISO(endRaw, { setZone: true }).setZone(zone);
    if (e.isValid && e > start) end = e;
  }
  if (!end || end <= start) end = start.plus({ hours: 2 });
  return { start, end };
}

function stableId(url: string, start: DateTime): string {
  return `last-bookstore-${slugFromUrl(url)}-${start.toFormat("yyyyLLddHHmm")}`;
}

function mapToWorkshop(
  input: {
    url: string;
    title: string;
    description: string;
    start: DateTime;
    end?: DateTime;
    venue: string;
    address?: string;
    price: PriceKind;
    format: EventFormat;
  },
): WorkshopEvent {
  const title = decodeHtmlEntities(input.title).replace(/\s+/g, " ").trim();
  const description = toShortOverview(input.description, 520) || title;
  const category = inferCategory(title, description);
  return {
    id: stableId(input.url, input.start),
    cityId: "la",
    title,
    tagline: "The Last Bookstore",
    description,
    start: input.start.toISO() ?? input.start.toString(),
    end: input.end?.toISO() ?? undefined,
    timeZone: TZ,
    format: input.format,
    price: input.price,
    category,
    organizer: "The Last Bookstore",
    venue: input.venue,
    address: input.address,
    neighborhood: "Downtown LA",
    rsvpUrl: input.url,
    source: "The Last Bookstore (lastbookstorela.com)",
    sourceChannel: "bookstore",
    listingProvenance: "live",
  };
}

function workshopFromSchema(url: string, ev: SchemaEvent): WorkshopEvent | null {
  if (!ev.name?.trim() || !ev.startDate) return null;
  if (/EventCancelled/i.test(ev.eventStatus ?? "")) return null;
  const when = parseIsoRange(ev.startDate, ev.endDate, TZ);
  if (!when) return null;
  const { venue, address } = locationAddress(ev.location);
  const description =
    stripHtmlAndDecode(ev.description ?? "") || ev.name.trim();
  return mapToWorkshop({
    url,
    title: ev.name.trim(),
    description,
    start: when.start,
    end: when.end,
    venue,
    address,
    price: priceFromOffers(ev.offers),
    format: inferFormat(ev.eventAttendanceMode, description),
  });
}

function workshopFromEmbedded(url: string, ev: WixEmbeddedEvent): WorkshopEvent | null {
  const startRaw = ev.scheduling?.config?.startDate;
  if (!ev.title?.trim() || !startRaw) return null;
  const zone = ev.scheduling?.config?.timeZoneId?.trim() || TZ;
  const when = parseIsoRange(startRaw, ev.scheduling?.config?.endDate, zone);
  if (!when) return null;
  const { venue, address } = locationAddress(ev.location);
  const description =
    stripHtmlAndDecode(ev.description ?? "") || ev.title.trim();
  return mapToWorkshop({
    url,
    title: ev.title.trim(),
    description,
    start: when.start,
    end: when.end,
    venue,
    address,
    price: priceFromOffers(undefined, ev.registration?.ticketing),
    format: inferFormat(undefined, description),
  });
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

export async function fetchLastBookstoreEventsForMonth(
  year: number,
  monthIndex: number,
  signal?: AbortSignal,
): Promise<{ events: WorkshopEvent[]; meta: LastBookstoreMeta }> {
  const monthStart = DateTime.fromObject(
    { year, month: monthIndex + 1, day: 1 },
    { zone: TZ },
  ).startOf("day");
  const monthEnd = monthStart.endOf("month").endOf("day");

  const [sitemapXml, listHtml] = await Promise.all([
    fetchText(EVENT_SITEMAP_URL, signal),
    fetchText(EVENT_LIST_URL, signal).catch(() => ""),
  ]);

  const urls = parseEventSitemapUrls(sitemapXml);
  const embedded = listHtml ? extractEmbeddedEvents(listHtml) : [];
  const urlBySlug = new Map<string, string>();
  for (const u of urls) urlBySlug.set(slugFromUrl(u), u);
  for (const ev of embedded) {
    if (ev.slug) {
      urlBySlug.set(
        ev.slug,
        `${ORIGIN}/event-details/${ev.slug}`,
      );
    }
  }

  const allUrls = [...urlBySlug.values()];
  const bySlug = new Map<string, WorkshopEvent>();

  const detailResults = await mapWithConcurrency(allUrls, 5, async (url) => {
    try {
      const html = await fetchText(url, signal);
      const schema = parseJsonLdEvent(html);
      if (!schema) return null;
      return workshopFromSchema(url, schema);
    } catch {
      return null;
    }
  });

  for (const row of detailResults) {
    if (!row) continue;
    bySlug.set(slugFromUrl(row.rsvpUrl ?? ""), row);
  }

  for (const ev of embedded) {
    if (!ev.slug) continue;
    const url = urlBySlug.get(ev.slug);
    if (!url) continue;
    const mapped = workshopFromEmbedded(url, ev);
    if (mapped) bySlug.set(ev.slug, mapped);
  }

  const inMonth = [...bySlug.values()].filter((e) => {
    const start = DateTime.fromISO(e.start, { setZone: true }).setZone(TZ);
    return start.isValid && start >= monthStart && start <= monthEnd;
  });

  inMonth.sort(
    (a, b) => new Date(a.start).getTime() - new Date(b.start).getTime(),
  );

  return {
    events: inMonth,
    meta: {
      sitemapUrls: urls.length,
      detailPagesFetched: allUrls.length,
      embeddedFromList: embedded.length,
      rowsInMonth: inMonth.length,
    },
  };
}
