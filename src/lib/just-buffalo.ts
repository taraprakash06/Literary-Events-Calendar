import { DateTime } from "luxon";
import type { EventFormat, WorkshopEvent, WorkshopEventCategory } from "@/lib/workshop-types";
import { decodeHtmlEntities, stripHtmlAndDecode, toShortOverview } from "@/lib/text";

const ORIGIN = "https://www.justbuffalo.org";
const SOURCE_URL = `${ORIGIN}/literary-events-in-buffalo/`;
const TZ = "America/New_York";

export type JustBuffaloParseMeta = {
  pageFetched: boolean;
  chunksFound: number;
  chunksParsed: number;
  rowsInMonth: number;
};

type RawChunk = {
  viewUrl: string;
  htmlChunk: string;
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

function firstMeaningfulTitleAfter(lines: string[], startIdx: number): string | null {
  for (let i = Math.max(0, startIdx); i < lines.length; i++) {
    const l = lines[i].trim();
    if (!l) continue;
    if (/%[0-9A-F]{2}/i.test(l)) continue;
    if (/^(Facebook|Twitter|Linkedin|Email)$/i.test(l)) continue;
    if (/^(Get Tickets Now|View Event|Load More|No event found!)$/i.test(l)) continue;
    if (/^(Upcoming Literary Events in Buffalo)$/i.test(l)) continue;
    if (/\b(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),\s+[A-Za-z]+\s+\d{1,2},\s+\d{4}\b/.test(l))
      continue;
    if (/^(\d{1,2}:\d{2}\s*(?:am|pm)|All Day)\b/i.test(l)) continue;
    // Prefer a real-ish title length.
    if (l.length >= 8) return l;
  }
  return null;
}

function extractEventDescription(lines: string[], title: string): string {
  const idx = lines.findIndex((l) => l.trim() === title.trim());
  if (idx === -1) return "";

  const out: string[] = [];
  for (let i = idx + 1; i < Math.min(lines.length, idx + 40); i++) {
    const l = lines[i].trim();
    if (!l) continue;
    if (/%[0-9A-F]{2}/i.test(l)) continue;
    if (/^(Facebook|Twitter|Linkedin|Email)$/i.test(l)) continue;
    if (/^(Get Tickets Now|View Event|Load More|No event found!)$/i.test(l)) break;
    if (/\b\d{1,6}\s+[^,\n]{3,120}\s+Buffalo,?\s*(?:NY|New York)\s+\d{5}\b/i.test(l)) break;
    if (/\bBuffalo,?\s*(?:NY|New York)\s+\d{5}\b/i.test(l)) break;
    // Avoid repeating venue/date/time.
    if (/\b(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),\s+[A-Za-z]+\s+\d{1,2},\s+\d{4}\b/.test(l))
      continue;
    if (/^(\d{1,2}:\d{2}\s*(?:am|pm)|All Day)\b/i.test(l)) continue;
    if (l === title) continue;

    out.push(l);
    if (out.join(" ").length > 700) break;
  }

  return out.join(" ").replace(/\s+/g, " ").trim();
}

function normalizeTimeToken(t: string): string {
  const s = t.trim().toLowerCase();
  if (/\d{1,2}:\d{2}/.test(s)) return s.replace(/\s+/g, " ");
  return s.replace(/^(\d{1,2})\s*(am|pm)$/i, "$1:00 $2").replace(/\s+/g, " ");
}

function parseDateTime(dateLine: string, timeStart: string): DateTime | null {
  const date = dateLine.trim();
  const time = normalizeTimeToken(timeStart);
  const dt1 = DateTime.fromFormat(`${date} ${time}`, "cccc, LLLL d, yyyy h:mm a", {
    zone: TZ,
    locale: "en",
  });
  if (dt1.isValid) return dt1;
  const dt2 = DateTime.fromFormat(`${date} ${time}`, "ccc, LLLL d, yyyy h:mm a", {
    zone: TZ,
    locale: "en",
  });
  if (dt2.isValid) return dt2;
  return null;
}

function categoryFromText(title: string, desc: string): WorkshopEventCategory {
  const b = `${title}\n${desc}`.toLowerCase();
  if (/\b(workshop|writing center|open hours|writing)\b/.test(b)) return "workshop";
  if (/\b(reading group|book club|discussion group|reading & discussion)\b/.test(b)) return "other";
  if (/\b(open mic|literary café|lit[-\s]?cafe)\b/.test(b)) return "open-mic";
  if (/\b(panel|conversation|lecture|talk|in conversation)\b/.test(b)) return "other";
  if (/\b(fair|conference|festival|crawl)\b/.test(b)) return "other";
  return "reading";
}

function formatFromVenueAndText(venue: string, desc: string): EventFormat {
  const b = `${venue}\n${desc}`.toLowerCase();
  if (/\bonline\b|zoom\b|virtual\b/.test(b)) return "virtual";
  return "in-person";
}

function stableId(viewUrl: string, start: DateTime): string {
  const slug = viewUrl
    .replace(ORIGIN, "")
    .replace(/^\/+/, "")
    .replace(/\/+$/, "")
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/-+/g, "-")
    .toLowerCase();
  return `jb-${slug}-${start.toFormat("yyyyLLddHHmm")}`;
}

function extractUpcomingSection(html: string): string {
  const start = html.search(/Upcoming Literary Events in Buffalo/i);
  if (start === -1) return html;
  const slice = html.slice(start);
  const end = slice.search(/Just Buffalo’s Literary Events|Just Buffalo's Literary Events/i);
  return end === -1 ? slice : slice.slice(0, end);
}

function extractChunks(html: string): RawChunk[] {
  const section = extractUpcomingSection(html);

  // A "View Event" link reliably points at the event permalink.
  const viewRe =
    /<a\b[^>]*href="(https?:\/\/www\.justbuffalo\.org\/events\/[^"#?]+\/?)"[^>]*>\s*View Event\s*<\/a>/gi;
  const dateRe =
    /\b(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),\s+[A-Za-z]+\s+\d{1,2},\s+\d{4}\b/gi;

  const viewMatches: { url: string; idx: number }[] = [];
  let m: RegExpExecArray | null;
  while ((m = viewRe.exec(section))) {
    viewMatches.push({ url: m[1], idx: m.index });
  }

  if (viewMatches.length === 0) return [];

  const chunks: RawChunk[] = [];
  for (const cur of viewMatches) {
    // Find the nearest date heading before this "View Event" link.
    const before = section.slice(0, cur.idx);
    let lastDateIdx = -1;
    dateRe.lastIndex = 0;
    for (const mm of before.matchAll(dateRe)) {
      lastDateIdx = mm.index ?? lastDateIdx;
    }
    const startIdx = lastDateIdx !== -1 ? lastDateIdx : Math.max(0, cur.idx - 8000);

    // Find the next date heading after this link to bound the chunk.
    const after = section.slice(cur.idx);
    dateRe.lastIndex = 0;
    const next = dateRe.exec(after);
    const endIdx =
      next && typeof next.index === "number"
        ? cur.idx + next.index
        : Math.min(section.length, cur.idx + 12000);

    const htmlChunk = section.slice(startIdx, endIdx);
    chunks.push({ viewUrl: cur.url, htmlChunk });
  }

  // De-dupe by viewUrl.
  const seen = new Set<string>();
  return chunks.filter((c) => {
    if (seen.has(c.viewUrl)) return false;
    seen.add(c.viewUrl);
    return true;
  });
}

function parseChunk(chunk: RawChunk): Omit<WorkshopEvent, "cityId"> | null {
  const lines = htmlToTextLines(chunk.htmlChunk);
  const joined = lines.join("\n");

  const dateLine =
    joined.match(/\b(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),\s+[A-Za-z]+\s+\d{1,2},\s+\d{4}\b/)?.[0] ??
    "";
  if (!dateLine) return null;

  const timeLine =
    joined.match(/\bAll Day\b|\b\d{1,2}:\d{2}\s*(?:am|pm)\b(?:\s*-\s*\d{1,2}:\d{2}\s*(?:am|pm)\b)?/i)?.[0] ??
    "";
  if (!timeLine) return null;

  const dateIdx = lines.findIndex((l) => l === dateLine);
  const timeIdx =
    lines.findIndex((l) => l.toLowerCase() === timeLine.toLowerCase()) ??
    lines.findIndex((l) => l.toLowerCase().includes(timeLine.toLowerCase()));
  const venue = (() => {
    const start = Math.max(dateIdx, timeIdx) + 1;
    return lines.slice(start, start + 6).find((l) => {
      if (!l) return false;
      if (/^(Facebook|Twitter|Linkedin|Email)$/i.test(l)) return false;
      if (/^(Get Tickets Now|View Event)$/i.test(l)) return false;
      if (/\bBuffalo,\s*(?:NY|New York)\s+\d{5}\b/i.test(l)) return false;
      return true;
    });
  })();

  const title =
    firstMeaningfulTitleAfter(lines, (venue ? lines.indexOf(venue) + 1 : Math.max(dateIdx, timeIdx) + 1)) ??
    "Just Buffalo event";

  const desc =
    extractEventDescription(lines, title) ||
    toShortOverview(stripHtmlAndDecode(chunk.htmlChunk), 520) ||
    title;
  const category = categoryFromText(title, desc);
  const addressLine = (() => {
    // Prefer an address close to the event (after the venue line), since chunks may include adjacent events.
    const startAt = venue ? Math.max(0, lines.indexOf(venue)) : 0;
    const window = lines.slice(startAt, startAt + 18).join("\n");
    const streetish =
      window.match(
        /\b\d{1,6}\s+[^,\n]{3,120}\s+Buffalo,?\s*(?:NY|New York)\s+\d{5}\b/i,
      )?.[0] ?? null;
    if (streetish) return streetish;
    return (
      window.match(/\bBuffalo,?\s*(?:NY|New York)\s+\d{5}\b/i)?.[0] ??
      ""
    );
  })();
  const format = formatFromVenueAndText(venue ?? "", desc);

  if (/All Day/i.test(timeLine)) {
    // Use noon local for all-day items so they render on the day.
    const base = DateTime.fromFormat(dateLine, "cccc, LLLL d, yyyy", { zone: TZ, locale: "en" });
    if (!base.isValid) return null;
    const start = base.set({ hour: 12, minute: 0, second: 0, millisecond: 0 });
    const end = start.plus({ hours: 8 });
    return {
      id: stableId(chunk.viewUrl, start),
      title,
      tagline: venue ? toShortOverview(venue, 140) : "Buffalo, NY",
      description: desc,
      start: start.toISO() ?? start.toString(),
      end: end.toISO() ?? undefined,
      timeZone: TZ,
      format,
      price: "unknown",
      category,
      organizer: "Just Buffalo Literary Center",
      venue,
      address: addressLine || undefined,
      rsvpUrl: chunk.viewUrl,
      source: "Just Buffalo (justbuffalo.org)",
      sourceChannel: "literary_org",
      listingProvenance: "live",
    };
  }

  const [startTok, endTok] = timeLine.split("-").map((s) => s.trim());
  const start = parseDateTime(dateLine, startTok);
  if (!start || !start.isValid) return null;
  const end =
    endTok && endTok.length > 0
      ? (() => {
          const endTime = DateTime.fromFormat(normalizeTimeToken(endTok), "h:mm a", {
            zone: TZ,
            locale: "en",
          });
          return endTime.isValid
            ? start.set({ hour: endTime.hour, minute: endTime.minute, second: 0, millisecond: 0 })
            : start.plus({ hours: 1 });
        })()
      : start.plus({ hours: 1 });

  return {
    id: stableId(chunk.viewUrl, start),
    title,
    tagline: venue ? toShortOverview(venue, 140) : "Buffalo, NY",
    description: desc,
    start: start.toISO() ?? start.toString(),
    end: end.toISO() ?? undefined,
    timeZone: TZ,
    format,
    price: "unknown",
    category,
    organizer: "Just Buffalo Literary Center",
    venue,
    address: addressLine || undefined,
    rsvpUrl: chunk.viewUrl,
    source: "Just Buffalo (justbuffalo.org)",
    sourceChannel: "literary_org",
    listingProvenance: "live",
  };
}

export async function fetchJustBuffaloLiteraryEventsForMonth(
  year: number,
  monthIndex: number,
  signal?: AbortSignal,
): Promise<{ events: WorkshopEvent[]; meta: JustBuffaloParseMeta }> {
  const ua =
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

  const res = await fetch(SOURCE_URL, {
    signal,
    headers: {
      Accept: "text/html,application/xhtml+xml",
      "Accept-Language": "en-US,en;q=0.9",
      "User-Agent": ua,
      Referer: `${ORIGIN}/`,
    },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Just Buffalo page HTTP ${res.status}`);
  }
  const html = await res.text();

  const chunks = extractChunks(html);
  const parsed = chunks.map(parseChunk).filter((e): e is NonNullable<typeof e> => e != null);

  const inMonth = parsed.filter((e) => {
    const dt = DateTime.fromISO(e.start, { zone: TZ });
    return dt.isValid && dt.year === year && dt.month === monthIndex + 1;
  });

  const events: WorkshopEvent[] = inMonth.map((e) => ({ ...e, cityId: "nyc" }));
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

