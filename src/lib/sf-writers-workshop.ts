import { DateTime } from "luxon";
import type {
  EventFormat,
  PriceKind,
  WorkshopEvent,
  WorkshopEventCategory,
} from "@/lib/workshop-types";
import { decodeHtmlEntities, stripHtmlAndDecode, toShortOverview } from "@/lib/text";

const ORIGIN = "https://sanfranciscowritersworkshop.com";
export const SFWW_EVENTS_URL = `${ORIGIN}/category/events/`;
const TZ = "America/Los_Angeles";
const DEFAULT_VENUE = "Noisebridge";
const DEFAULT_ADDRESS = "272 Capp St, San Francisco, CA";

const UA =
  "calendar_literary/1.0 (+https://github.com/taraprakash06/literary-events-calendar)";

const MONTHS: Record<string, number> = {
  january: 1,
  february: 2,
  march: 3,
  april: 4,
  may: 5,
  june: 6,
  july: 7,
  august: 8,
  september: 9,
  october: 10,
  november: 11,
  december: 12,
};

export type SfWritersWorkshopMeta = {
  postUrlsCollected: number;
  postsFetched: number;
  occurrencesParsed: number;
  rowsInMonth: number;
};

type PostDraft = {
  url: string;
  title: string;
  body: string;
  defaultYear: number;
};

type ParsedOccurrence = {
  start: DateTime;
  end: DateTime;
};

async function fetchText(url: string, signal?: AbortSignal): Promise<string> {
  const res = await fetch(url, {
    headers: { Accept: "text/html", "User-Agent": UA },
    cache: "no-store",
    signal,
  });
  if (!res.ok) throw new Error(`SFWW HTTP ${res.status} for ${url}`);
  return res.text();
}

function collectPostUrlsFromHtml(html: string): string[] {
  return [
    ...new Set(
      [...html.matchAll(/href="(https:\/\/sanfranciscowritersworkshop\.com\/\d{4}\/[^"#]+)/gi)]
        .map((m) => m[1].replace(/\/$/, ""))
        .filter((u) => !u.includes("/author/") && !u.includes("/category/")),
    ),
  ];
}

function collectPostUrlsFromRss(xml: string): string[] {
  return [
    ...new Set(
      [...xml.matchAll(/<link>(https:\/\/sanfranciscowritersworkshop\.com\/\d{4}\/[^<]+)<\/link>/gi)]
        .map((m) => m[1].replace(/\/$/, "")),
    ),
  ];
}

async function collectPostUrls(signal?: AbortSignal): Promise<string[]> {
  const urls = new Set<string>();
  const categoryPages = [
    SFWW_EVENTS_URL,
    `${SFWW_EVENTS_URL}page/2/`,
  ];
  for (const pageUrl of categoryPages) {
    try {
      const html = await fetchText(pageUrl, signal);
      collectPostUrlsFromHtml(html).forEach((u) => urls.add(u));
    } catch {
      /* page may 404 */
    }
  }
  try {
    const rss = await fetchText(`${SFWW_EVENTS_URL}feed/`, signal);
    collectPostUrlsFromRss(rss).forEach((u) => urls.add(u));
  } catch {
    /* optional */
  }
  return [...urls];
}

function yearFromPostUrl(url: string): number {
  const y = url.match(/sanfranciscowritersworkshop\.com\/(\d{4})\//)?.[1];
  const n = y ? Number(y) : NaN;
  return Number.isFinite(n) ? n : DateTime.now().setZone(TZ).year;
}

function extractPostBody(html: string): string {
  const entry =
    html.match(
      /<div class="entry-content">([\s\S]*?)(?:<footer class="entry-footer"|<nav class="post-navigation|<\/article>)/i,
    )?.[1] ?? "";
  if (entry) return stripHtmlAndDecode(entry);
  const og = html.match(/property="og:description" content="([^"]+)"/i)?.[1];
  return og ? decodeHtmlEntities(og) : "";
}

function extractPostTitle(html: string, fallback: string): string {
  const h1 = html.match(/<h1[^>]*class="[^"]*entry-title[^"]*"[^>]*>([\s\S]*?)<\/h1>/i)?.[1];
  if (h1) return stripHtmlAndDecode(h1).trim();
  const t = html.match(/<title>([^<]+)/i)?.[1]?.trim();
  if (t) return decodeHtmlEntities(t.split(/[–|]/)[0]).trim();
  return fallback;
}

function normalizeTimeToken(tok: string): string {
  let t = tok.trim().toLowerCase();
  t = t.replace(/(\d{1,2}:\d{2})(am|pm)\b/i, "$1 $2");
  t = t.replace(/(\d{1,2})(am|pm)\b/i, "$1:00 $2");
  if (/^\d{1,2}\s*(am|pm)$/i.test(t)) {
    t = t.replace(/^(\d{1,2})\s*(am|pm)$/i, "$1:00 $2");
  }
  if (/^\d{1,2}$/.test(t)) t = `${t}:00`;
  return t.toUpperCase();
}

function buildDateTime(
  monthName: string,
  day: number,
  year: number,
  timeTok?: string,
): DateTime | null {
  const month = MONTHS[monthName.toLowerCase()];
  if (!month || !day || !year) return null;
  const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  if (!timeTok) {
    return DateTime.fromISO(`${dateStr}T19:00:00`, { zone: TZ });
  }
  const dt = DateTime.fromFormat(
    `${dateStr} ${normalizeTimeToken(timeTok)}`,
    "yyyy-MM-dd h:mm a",
    { zone: TZ, locale: "en" },
  );
  return dt.isValid ? dt : null;
}

function parseOccurrences(body: string, defaultYear: number): ParsedOccurrence[] {
  const text = body.replace(/\s+/g, " ");
  const found: ParsedOccurrence[] = [];
  const seen = new Set<string>();

  const add = (start: DateTime | null, end?: DateTime | null) => {
    if (!start?.isValid) return;
    const endDt =
      end && end.isValid && end > start ? end : start.plus({ hours: 2 });
    const key = start.toISO() ?? start.toString();
    if (seen.has(key)) return;
    seen.add(key);
    found.push({ start, end: endDt });
  };

  const patterns: {
    re: RegExp;
    map: (m: RegExpExecArray) => { start: DateTime | null; end?: DateTime | null };
  }[] = [
    {
      re: /\b(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),?\s+([A-Za-z]+)\s+(\d{1,2})(?:st|nd|rd|th)?,?\s*(\d{4}),?\s+(\d{1,2}(?::\d{2})?)\s*[–-]\s*(\d{1,2}(?::\d{2})?\s*(?:am|pm))/gi,
      map: (m) => {
        const start = buildDateTime(m[1], Number(m[2]), Number(m[3]), m[4]);
        const end = start
          ? buildDateTime(m[1], Number(m[2]), Number(m[3]), m[5])
          : null;
        return { start, end };
      },
    },
    {
      re: /\b([A-Za-z]+)\s+(\d{1,2})(?:st|nd|rd|th)?,?\s*(\d{4})\s+at\s+(\d{1,2}(?::\d{2})?\s*(?:am|pm))/gi,
      map: (m) => ({
        start: buildDateTime(m[1], Number(m[2]), Number(m[3]), m[4]),
      }),
    },
    {
      re: /\b(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),?\s+([A-Za-z]+)\s+(\d{1,2})(?:st|nd|rd|th)?(?:,?\s*(\d{4}))?\s+at\s+(\d{1,2}(?::\d{2})?\s*(?:am|pm))/gi,
      map: (m) => ({
        start: buildDateTime(
          m[1],
          Number(m[2]),
          m[3] ? Number(m[3]) : defaultYear,
          m[4],
        ),
      }),
    },
    {
      re: /\bfor\s+(\d{1,2}(?::\d{2})?\s*(?:am|pm))\s+on\s+([A-Za-z]+)\s+(\d{1,2}),?\s*(\d{4})/gi,
      map: (m) => ({
        start: buildDateTime(m[2], Number(m[3]), Number(m[4]), m[1]),
      }),
    },
    {
      re: /\bon\s+([A-Za-z]+)\s+(\d{1,2})(?:st|nd|rd|th)?(?:,?\s*(\d{4}))?\s+at\s+(\d{1,2}(?::\d{2})?\s*(?:am|pm))/gi,
      map: (m) => ({
        start: buildDateTime(
          m[1],
          Number(m[2]),
          m[3] ? Number(m[3]) : defaultYear,
          m[4],
        ),
      }),
    },
    {
      re: /\bon\s+([A-Za-z]+)\s+(\d{1,2})(?:st|nd|rd|th)?(?:,?\s*(\d{4}))?\b/gi,
      map: (m) => ({
        start: buildDateTime(
          m[1],
          Number(m[2]),
          m[3] ? Number(m[3]) : defaultYear,
        ),
      }),
    },
  ];

  for (const { re, map } of patterns) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text))) {
      const { start, end } = map(m);
      add(start, end);
    }
  }

  return found;
}

function isSfRelevant(text: string): boolean {
  const b = text.toLowerCase();
  if (/\boakland\b/.test(b) && !/\bsan francisco\b/.test(b) && !/\bnoisebridge\b/.test(b)) {
    return false;
  }
  if (/\bberkeley\b/.test(b) && !/\bsan francisco\b/.test(b)) return false;
  return true;
}

function inferVenue(text: string): { venue: string; address?: string } {
  const b = text;
  if (/noisebridge|272 capp/i.test(b)) {
    return { venue: DEFAULT_VENUE, address: DEFAULT_ADDRESS };
  }
  if (/book passage|ferry building/i.test(b)) {
    return {
      venue: "Book Passage (Ferry Building)",
      address: "Ferry Building, San Francisco, CA",
    };
  }
  if (/books inc/i.test(b)) {
    return {
      venue: "Books Inc.",
      address: "Marina District, San Francisco, CA",
    };
  }
  if (/san francisco/i.test(b)) {
    return { venue: "San Francisco Writers Workshop", address: DEFAULT_ADDRESS };
  }
  return { venue: DEFAULT_VENUE, address: DEFAULT_ADDRESS };
}

function inferCategory(title: string, body: string): WorkshopEventCategory {
  const b = `${title}\n${body}`.toLowerCase();
  if (/\bfundraiser|benefit\b/.test(b)) return "festival";
  if (/\blit crawl|litquake|festival|beastcrawl\b/.test(b)) return "festival";
  if (/\breading|read their|featured readers\b/.test(b)) return "reading";
  if (/\bworkshop|class\b/.test(b)) return "workshop";
  if (/\bbook launch|debut\b/.test(b)) return "launch";
  return "reading";
}

function slugFromUrl(url: string): string {
  const slug = url.split("/").filter(Boolean).pop() ?? "event";
  return slug.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function dedupeByPostDay(events: WorkshopEvent[]): WorkshopEvent[] {
  const byKey = new Map<string, WorkshopEvent>();
  for (const ev of events) {
    const day = DateTime.fromISO(ev.start, { setZone: true })
      .setZone(TZ)
      .toFormat("yyyy-MM-dd");
    const key = `${ev.rsvpUrl ?? ""}-${day}`;
    const prev = byKey.get(key);
    if (!prev) {
      byKey.set(key, ev);
      continue;
    }
    const prevStart = DateTime.fromISO(prev.start, { setZone: true }).setZone(TZ);
    const curStart = DateTime.fromISO(ev.start, { setZone: true }).setZone(TZ);
    const prevDefault = prevStart.hour === 19 && prevStart.minute === 0;
    const curDefault = curStart.hour === 19 && curStart.minute === 0;
    if (prevDefault && !curDefault) byKey.set(key, ev);
  }
  return [...byKey.values()];
}

function mapOccurrence(
  post: PostDraft,
  occ: ParsedOccurrence,
): WorkshopEvent {
  const { venue, address } = inferVenue(post.body);
  const description = toShortOverview(post.body, 520) || post.title;

  return {
    id: `sfww-${slugFromUrl(post.url)}-${occ.start.toFormat("yyyyLLddHHmm")}`,
    cityId: "sf",
    title: post.title,
    tagline: "San Francisco Writers Workshop",
    description,
    start: occ.start.toISO() ?? occ.start.toString(),
    end: occ.end.toISO() ?? undefined,
    timeZone: TZ,
    format: "in-person" as EventFormat,
    price: /\bfree\b/i.test(post.body) ? ("free" as PriceKind) : "unknown",
    category: inferCategory(post.title, post.body),
    organizer: "San Francisco Writers Workshop",
    venue,
    address,
    neighborhood: "Mission District",
    rsvpUrl: post.url,
    source: "San Francisco Writers Workshop (sanfranciscowritersworkshop.com)",
    sourceChannel: "literary_org",
    listingProvenance: "live",
  };
}

export async function fetchSfWritersWorkshopEventsForMonth(
  year: number,
  monthIndex: number,
  signal?: AbortSignal,
): Promise<{ events: WorkshopEvent[]; meta: SfWritersWorkshopMeta }> {
  const monthStart = DateTime.fromObject(
    { year, month: monthIndex + 1, day: 1 },
    { zone: TZ },
  ).startOf("day");
  const monthEnd = monthStart.endOf("month").endOf("day");

  const postUrls = await collectPostUrls(signal);
  const events: WorkshopEvent[] = [];
  let postsFetched = 0;
  let occurrencesParsed = 0;

  for (const url of postUrls) {
    try {
      const html = await fetchText(url, signal);
      postsFetched += 1;
      const title = extractPostTitle(html, "San Francisco Writers Workshop event");
      const body = extractPostBody(html);
      if (!body || !isSfRelevant(body)) continue;

      const post: PostDraft = {
        url,
        title,
        body,
        defaultYear: yearFromPostUrl(url),
      };
      const occs = parseOccurrences(body, post.defaultYear);
      occurrencesParsed += occs.length;

      for (const occ of occs) {
        if (occ.start < monthStart || occ.start > monthEnd) continue;
        events.push(mapOccurrence(post, occ));
      }
    } catch {
      /* skip broken post */
    }
  }

  const deduped = dedupeByPostDay(events);

  deduped.sort(
    (a, b) => new Date(a.start).getTime() - new Date(b.start).getTime(),
  );

  return {
    events: deduped,
    meta: {
      postUrlsCollected: postUrls.length,
      postsFetched,
      occurrencesParsed,
      rowsInMonth: deduped.length,
    },
  };
}
