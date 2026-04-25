import { DateTime } from "luxon";
import type {
  EventFormat,
  WorkshopEvent,
  WorkshopEventCategory,
} from "@/lib/workshop-types";
import { decodeHtmlEntities, stripHtmlAndDecode, toShortOverview } from "@/lib/text";

const ORIGIN = "https://lyrichyperion.com";
const SOURCE_URL = `${ORIGIN}/tickets`;
const TZ = "America/Los_Angeles";

export type LyricHyperionParseMeta = {
  pageFetched: boolean;
  chunksFound: number;
  chunksParsed: number;
  rowsInMonth: number;
};

type RawChunk = {
  htmlChunk: string;
  primaryUrl?: string;
};

function htmlToTextLines(html: string): string[] {
  const withBreaks = html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|h1|h2|h3|h4|h5|h6|section|article)>/gi, "\n")
    .replace(/<li\b[^>]*>/gi, "\n")
    .replace(/<\/tr>/gi, "\n")
    .replace(/<\/td>/gi, "\n");
  const withoutTags = withBreaks.replace(/<[^>]+>/g, " ");
  const decoded = decodeHtmlEntities(withoutTags);
  return decoded
    .replace(/\r/g, "")
    .split("\n")
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

function absoluteUrl(u: string): string {
  const s = u.trim();
  if (!s) return SOURCE_URL;
  if (/^https?:\/\//i.test(s)) return s;
  if (s.startsWith("/")) return `${ORIGIN}${s}`;
  return `${ORIGIN}/${s.replace(/^\.?\//, "")}`;
}

function extractChunks(html: string): RawChunk[] {
  // Squarespace renders each listing as an <article class="eventlist-event ..."> ... </article>.
  const chunks: RawChunk[] = [];
  const re = /<article class="eventlist-event[\s\S]*?<\/article>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const htmlChunk = m[0];
    const viewUrl = htmlChunk.match(/<a\b[^>]*href="([^"]+)"[^>]*>/i)?.[1];
    chunks.push({
      htmlChunk,
      primaryUrl: viewUrl ? absoluteUrl(viewUrl) : undefined,
    });
  }

  const seen = new Set<string>();
  return chunks.filter((c) => {
    const key = c.primaryUrl ?? c.htmlChunk.slice(0, 200);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function inferCategory(title: string, description: string): WorkshopEventCategory {
  const b = `${title}\n${description}`.toLowerCase();
  if (/\b(open mic|open-mic)\b/.test(b)) return "open-mic";
  if (/\b(workshop|class|writing)\b/.test(b)) return "workshop";
  if (/\b(panel|in conversation|lecture|talk)\b/.test(b)) return "panel";
  if (/\b(festival|conference)\b/.test(b)) return "festival";
  if (/\b(book launch|launch party)\b/.test(b)) return "launch";
  if (/\b(book club|reading group)\b/.test(b)) return "book-club";
  if (/\b(poetry|poet|spoken word|reading)\b/.test(b)) return "reading";
  return "other";
}

function inferFormat(_title: string, description: string): EventFormat {
  const b = description.toLowerCase();
  if (/\b(zoom|virtual|online)\b/.test(b)) return "virtual";
  return "in-person";
}

function firstTitleAfter(lines: string[], startIdx: number): string | null {
  for (let i = Math.max(0, startIdx); i < Math.min(lines.length, startIdx + 30); i++) {
    const l = lines[i]?.trim();
    if (!l) continue;
    if (/^Calendar$/i.test(l)) continue;
    if (/^(Buy Tickets|View Event|Google Calendar|ICS)$/i.test(l)) continue;
    if (/^(Sun|Mon|Tue|Wed|Thu|Fri|Sat)$/i.test(l)) continue;
    if (/^(January|February|March|April|May|June|July|August|September|October|November|December)$/i.test(l)) continue;
    if (/^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)$/i.test(l)) continue;
    if (/^\d{1,2}$/.test(l)) continue;
    if (/\b(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),\s+[A-Za-z]+\s+\d{1,2},\s+\d{4}\b/.test(l))
      continue;
    if (/^\d{1,2}(:\d{2})?\s*(AM|PM)\b/i.test(l)) continue;
    if (l.length >= 3) return l.replace(/^#\s*/, "").trim();
  }
  return null;
}

function parseDateLine(lines: string[]): string | null {
  const joined = lines.join("\n");
  return (
    joined.match(
      /\b(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),\s+[A-Za-z]+\s+\d{1,2},\s+\d{4}\b/,
    )?.[0] ?? null
  );
}

function parseTimes(lines: string[]): { start: string; end?: string } | null {
  // Prefer Squarespace's localized time nodes. They often contain narrow no-break spaces.
  const joined = lines.join("\n").replace(/\u202f/g, " ").replace(/\u00a0/g, " ");
  const times = [...joined.matchAll(/\b(\d{1,2})(?::(\d{2}))?\s*(AM|PM)\b/gi)].map(
    (m) => {
      const hh = m[1];
      const mm = m[2] ?? "00";
      const ap = m[3].toUpperCase();
      return `${hh}:${mm} ${ap}`;
    },
  );
  if (times.length === 0) return null;
  return { start: times[0], end: times[1] };
}

function parseStartEnd(dateLine: string, times: { start: string; end?: string }): { start: DateTime; end?: DateTime } | null {
  const startDt = DateTime.fromFormat(
    `${dateLine} ${times.start}`,
    "cccc, LLLL d, yyyy h:mm a",
    { zone: TZ, locale: "en" },
  );
  if (!startDt.isValid) return null;

  if (!times.end) return { start: startDt, end: startDt.plus({ hours: 1 }) };
  const endDt = DateTime.fromFormat(`${dateLine} ${times.end}`, "cccc, LLLL d, yyyy h:mm a", {
    zone: TZ,
    locale: "en",
  });
  const endOk = endDt.isValid ? endDt : startDt.plus({ hours: 1 });
  const end = endOk < startDt ? startDt.plus({ hours: 1 }) : endOk;
  return { start: startDt, end };
}

function stableId(primaryUrl: string | undefined, title: string, start: DateTime): string {
  const base = primaryUrl ?? title;
  const slug = base
    .replace(ORIGIN, "")
    .replace(/^\/+/, "")
    .replace(/\/+$/, "")
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/-+/g, "-")
    .toLowerCase()
    .slice(0, 80);
  return `lyric-hyperion-${slug}-${start.toFormat("yyyyLLddHHmm")}`;
}

function parseChunk(chunk: RawChunk): Omit<WorkshopEvent, "cityId"> | null {
  const lines = htmlToTextLines(chunk.htmlChunk);
  const dateLine = parseDateLine(lines);
  if (!dateLine) return null;
  const times = parseTimes(lines);
  if (!times) return null;
  const when = parseStartEnd(dateLine, times);
  if (!when) return null;

  const title =
    chunk.htmlChunk.match(/class="eventlist-title"[\s\S]*?>([^<]+)<\/a>/i)?.[1]?.trim() ??
    chunk.htmlChunk.match(/\btext=([^&"]+)/i)?.[1]?.replace(/\+/g, " ") ??
    firstTitleAfter(lines, 0) ??
    "Lyric Hyperion event";
  const normalizedTitle = decodeHtmlEntities(title).replace(/\s+/g, " ").trim();

  const excerptHtml =
    chunk.htmlChunk.match(/class="eventlist-excerpt"[\s\S]*?>([\s\S]*?)<\/p>/i)?.[1] ??
    "";
  const description =
    toShortOverview(stripHtmlAndDecode(excerptHtml), 520) ||
    toShortOverview(stripHtmlAndDecode(chunk.htmlChunk), 520) ||
    normalizedTitle;

  const category = inferCategory(normalizedTitle, description);
  const format = inferFormat(normalizedTitle, description);

  // They’re a venue; default address is stable.
  const venue = "Lyric Hyperion";
  const address = "2106 Hyperion Ave, Los Angeles, CA 90027";
  const neighborhood = "Silver Lake";

  return {
    id: stableId(chunk.primaryUrl, normalizedTitle, when.start),
    title: normalizedTitle,
    tagline: "Lyric Hyperion",
    description,
    start: when.start.toISO() ?? when.start.toString(),
    end: when.end?.toISO() ?? undefined,
    timeZone: TZ,
    format,
    price: "unknown",
    category,
    organizer: "Lyric Hyperion",
    venue,
    address,
    neighborhood,
    rsvpUrl: chunk.primaryUrl ?? SOURCE_URL,
    source: "Lyric Hyperion (lyrichyperion.com)",
    sourceChannel: "theater_arts",
    listingProvenance: "live",
  };
}

export async function fetchLyricHyperionEventsForMonth(
  year: number,
  monthIndex: number,
  signal?: AbortSignal,
): Promise<{ events: WorkshopEvent[]; meta: LyricHyperionParseMeta }> {
  const ua =
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";
  const res = await fetch(SOURCE_URL, {
    signal,
    headers: {
      Accept: "text/html,application/xhtml+xml",
      "Accept-Language": "en-US,en;q=0.9",
      "User-Agent": ua,
      Referer: ORIGIN,
    },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Lyric Hyperion page HTTP ${res.status}`);
  const html = await res.text();

  const chunks = extractChunks(html);
  const parsed = chunks
    .map(parseChunk)
    .filter((e): e is NonNullable<typeof e> => e != null);

  const inMonth = parsed.filter((e) => {
    const dt = DateTime.fromISO(e.start, { zone: TZ });
    return dt.isValid && dt.year === year && dt.month === monthIndex + 1;
  });

  const events: WorkshopEvent[] = inMonth.map((e) => ({ ...e, cityId: "la" }));
  events.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());

  return {
    events,
    meta: {
      pageFetched: true,
      chunksFound: chunks.length,
      chunksParsed: parsed.length,
      rowsInMonth: events.length,
    },
  };
}

