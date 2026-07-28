import { DateTime } from "luxon";
import type { EventFormat, WorkshopEvent, WorkshopEventCategory } from "@/lib/workshop-types";
import {
  decodeHtmlEntities,
  limitAboutToSentences,
  stripHtmlAndDecode,
  toShortOverview,
} from "@/lib/text";

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

const MONTH_NAMES =
  "January|February|March|April|May|June|July|August|September|October|November|December";

function htmlToPlainText(html: string): string {
  return stripHtmlAndDecode(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(p|div|li|h[1-6]|tr|td)>/gi, "\n"),
  )
    .replace(/\u00a0/g, " ")
    .replace(/[–—]/g, "-")
    .replace(/[ \t]+/g, " ")
    .replace(/\n+/g, "\n")
    .trim();
}

function parseClock(token: string): { hour: number; minute: number } | null {
  const t = normalizeTimeToken(token);
  const dt = DateTime.fromFormat(t, "h:mm a", { zone: TZ, locale: "en" });
  if (!dt.isValid) return null;
  return { hour: dt.hour, minute: dt.minute };
}

/** e.g. "5:00 p.m.-6:30 p.m." or "5:00 pm - 6:30 pm" */
function parseSessionClockRange(
  text: string,
): { start: { hour: number; minute: number }; end: { hour: number; minute: number } } | null {
  const m = text.match(
    /\b(\d{1,2}(?::\d{2})?\s*(?:a\.?m\.?|p\.?m\.?))\s*-\s*(\d{1,2}(?::\d{2})?\s*(?:a\.?m\.?|p\.?m\.?))\b/i,
  );
  if (!m) return null;
  const start = parseClock(m[1]);
  const end = parseClock(m[2]);
  if (!start || !end) return null;
  return { start, end };
}

/**
 * Parse multi-session day lists from Just Buffalo detail copy, e.g.
 * "July 21 / July 28 / August 4 / August 11" and "+ Monday, August 17".
 */
function parseSessionDaysFromDetailText(text: string, year: number): DateTime[] {
  const days: DateTime[] = [];
  const seen = new Set<string>();

  const pushDay = (monthName: string, dayNum: number, y: number) => {
    const dt = DateTime.fromFormat(`${monthName} ${dayNum} ${y}`, "LLLL d yyyy", {
      zone: TZ,
      locale: "en",
    });
    if (!dt.isValid) return;
    const key = dt.toFormat("yyyyLLdd");
    if (seen.has(key)) return;
    seen.add(key);
    days.push(dt.startOf("day"));
  };

  const slashRe = new RegExp(
    `\\b((?:${MONTH_NAMES})\\s+\\d{1,2}(?:\\s*/\\s*(?:(?:${MONTH_NAMES})\\s+)?\\d{1,2})+)\\b`,
    "gi",
  );
  for (const m of text.matchAll(slashRe)) {
    let carryMonth: string | null = null;
    const parts = m[1].split(/\s*\/\s*/);
    for (const part of parts) {
      const pm = part.match(new RegExp(`^(?:(${MONTH_NAMES})\\s+)?(\\d{1,2})$`, "i"));
      if (!pm) continue;
      if (pm[1]) carryMonth = pm[1];
      if (!carryMonth) continue;
      pushDay(carryMonth, Number(pm[2]), year);
    }
  }

  const namedRe = new RegExp(
    `\\b(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),?\\s+(${MONTH_NAMES})\\s+(\\d{1,2})(?:,\\s*(\\d{4}))?\\b`,
    "gi",
  );
  for (const m of text.matchAll(namedRe)) {
    pushDay(m[1], Number(m[2]), m[3] ? Number(m[3]) : year);
  }

  days.sort((a, b) => a.toMillis() - b.toMillis());
  return days;
}

async function fetchDetailSessionStarts(
  viewUrl: string,
  year: number,
  fallbackStart: DateTime,
  fallbackEnd: DateTime,
  signal?: AbortSignal,
  title = "",
): Promise<{
  sessions: { start: DateTime; end: DateTime }[];
  priceFree: boolean;
  price?: WorkshopEvent["price"];
  priceDetail?: string;
  description?: string;
} | null> {
  const ua =
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";
  const res = await fetch(viewUrl, {
    signal,
    headers: {
      Accept: "text/html,application/xhtml+xml",
      "Accept-Language": "en-US,en;q=0.9",
      "User-Agent": ua,
      Referer: SOURCE_URL,
    },
    cache: "no-store",
  });
  if (!res.ok) return null;
  const text = htmlToPlainText(await res.text());
  const description = extractAboutFromDetailPlain(text, title);
  const priced = parseJustBuffaloTicketPrice(text);

  // Only expand when the page advertises a multi-week / multi-date series.
  const looksMulti =
    /\b(?:\d+|two|three|four|five|six|seven|eight)\s+weeks?\b/i.test(text) ||
    new RegExp(
      `\\b(?:${MONTH_NAMES})\\s+\\d{1,2}\\s*/\\s*(?:(?:${MONTH_NAMES})\\s+)?\\d{1,2}\\b`,
      "i",
    ).test(text);
  if (!looksMulti) {
    return description || priced.price || priced.priceFree
      ? {
          sessions: [],
          priceFree: priced.priceFree,
          price: priced.price,
          priceDetail: priced.priceDetail,
          description,
        }
      : null;
  }

  const days = parseSessionDaysFromDetailText(text, year);
  if (days.length < 2) {
    return description || priced.price || priced.priceFree
      ? {
          sessions: [],
          priceFree: priced.priceFree,
          price: priced.price,
          priceDetail: priced.priceDetail,
          description,
        }
      : null;
  }

  const clocks = parseSessionClockRange(text);
  const startClock = clocks?.start ?? {
    hour: fallbackStart.hour,
    minute: fallbackStart.minute,
  };
  const endClock = clocks?.end ?? {
    hour: fallbackEnd.hour,
    minute: fallbackEnd.minute,
  };

  const sessions = days.map((day) => {
    const start = day.set({
      hour: startClock.hour,
      minute: startClock.minute,
      second: 0,
      millisecond: 0,
    });
    let end = day.set({
      hour: endClock.hour,
      minute: endClock.minute,
      second: 0,
      millisecond: 0,
    });
    if (end <= start) end = end.plus({ days: 1 });
    return { start, end };
  });

  return {
    sessions,
    priceFree: priced.priceFree,
    price: priced.price,
    priceDetail: priced.priceDetail,
    description,
  };
}

/** Pull the event-page About, including audience notes like “aimed at teachers.” */
function extractAboutFromDetailPlain(text: string, title = ""): string | undefined {
  const silo = synthesizeSiloCityAbout(text, title);
  if (silo) return silo;

  const joinAt = text.search(/\bJoin us\b/i);
  if (joinAt < 0) return undefined;
  let slice = text.slice(joinAt);
  slice =
    slice.split(
      /\bBPS teachers\b|\bNon-BPS teachers\b|\bTags:\b|\bTeacher & Educator\b|\bCreative Writing Programs for Teachers\b|\b(?:Mondays?|Tuesdays?|Wednesdays?|Thursdays?|Fridays?|Saturdays?|Sundays?)\s*@/i,
    )[0] ?? slice;
  let about = limitAboutToSentences(slice, 4);
  if (!about) return undefined;

  const audience =
    text.match(/\bThis workshop is FREE and aimed at teachers\.?/i)?.[0] ??
    text.match(/\bThis workshop is aimed at teachers\.?/i)?.[0];
  if (audience && !/\baimed at teachers\b/i.test(about)) {
    about = `${about} ${audience.replace(/\.*$/, ".")}`;
  }
  return about;
}

/**
 * Silo City pages bury useful details in pipe-separated ticket lines and sale banners.
 * Rebuild a concise About so the modal stands alone before RSVP.
 */
function synthesizeSiloCityAbout(text: string, title: string): string | undefined {
  if (!/silo\s+city/i.test(`${title}\n${text}`)) return undefined;
  if (/season\s+subscription/i.test(title)) return undefined;

  const joinAt = text.search(/\bJoin us for the\b/i);
  if (joinAt < 0) return undefined;
  let featureSlice = text.slice(joinAt);
  featureSlice =
    featureSlice.split(
      /\*{0,3}\s*TICKETS ON SALE|\*{0,3}\s*ON SALE|\bGuaranteed Seat\b|\bSEASON TICKETS\b/i,
    )[0] ?? featureSlice;
  const cleanFeature = featureSlice
    .replace(/\s+/g, " ")
    .replace(/\s+,/g, ",")
    .replace(/\s+\./g, ".")
    .trim()
    .replace(/[.\s]+$/, ".");
  if (cleanFeature.length < 40) return undefined;

  const doors = text.match(/Doors at\s+(\d{1,2}(?::\d{2})?\s*[ap]\.?m\.?)/i)?.[1];
  const begins = text.match(
    /Reading begins at\s+(\d{1,2}(?::\d{2})?\s*[ap]\.?m\.?)/i,
  )?.[1];
  const seat = text.match(/Guaranteed Seat\s*\$\s*(\d+)/i)?.[1];
  const standing = text.match(
    /(?:GA\s+)?Standing Room(?: Only)?\s*\$\s*(\d+)/i,
  )?.[1];

  const parts: string[] = [cleanFeature];

  const scheduleBits: string[] = [];
  if (doors && begins) {
    scheduleBits.push(
      `Doors open at ${normalizeClockLabel(doors)} and the reading begins at ${normalizeClockLabel(begins)}`,
    );
  } else if (begins) {
    scheduleBits.push(`The reading begins at ${normalizeClockLabel(begins)}`);
  }
  if (seat && standing) {
    scheduleBits.push(
      `tickets are $${seat} for a guaranteed seat or $${standing} for GA standing room`,
    );
  } else if (seat) {
    scheduleBits.push(`tickets are $${seat} for a guaranteed seat`);
  } else if (standing) {
    scheduleBits.push(`tickets are $${standing} for GA standing room`);
  }
  if (scheduleBits.length) {
    parts.push(`${scheduleBits.join("; ")}.`);
  }

  if (/\bFitz Books\b/i.test(text)) {
    parts.push("Books will be available for purchase from Fitz Books.");
  }
  if (/\bASL interpretation\b/i.test(text)) {
    parts.push(
      "Request ASL interpretation in advance by emailing info@justbuffalo.org.",
    );
  }

  return parts.slice(0, 4).join(" ");
}

function normalizeClockLabel(raw: string): string {
  const cleaned = raw.replace(/\./g, "").replace(/\s+/g, " ").trim();
  const dt = DateTime.fromFormat(normalizeTimeToken(cleaned), "h:mm a", {
    zone: TZ,
    locale: "en",
  });
  return dt.isValid ? dt.toFormat("h:mm a") : cleaned;
}

function parseJustBuffaloTicketPrice(text: string): {
  price?: WorkshopEvent["price"];
  priceDetail?: string;
  priceFree: boolean;
} {
  if (/\bthis workshop is free\b|\bfree and aimed at\b/i.test(text)) {
    return { price: "free", priceFree: true };
  }
  const seat = text.match(/Guaranteed Seat\s*\$\s*(\d+)/i)?.[1];
  const standing = text.match(
    /(?:GA\s+)?Standing Room(?: Only)?\s*\$\s*(\d+)/i,
  )?.[1];
  if (seat && standing) {
    return {
      price: "paid",
      priceDetail: `$${seat} guaranteed seat · $${standing} standing`,
      priceFree: false,
    };
  }
  if (seat) {
    return { price: "paid", priceDetail: `$${seat}`, priceFree: false };
  }
  if (standing) {
    return { price: "paid", priceDetail: `$${standing}`, priceFree: false };
  }
  const single = text.match(/\$\s*(\d+(?:\.\d{2})?)\s*(?:per|tickets?|in advance)/i);
  if (single) {
    return { price: "paid", priceDetail: `$${single[1]}`, priceFree: false };
  }
  return { priceFree: false };
}

function ensureTeacherAudienceNote(title: string, description: string): string {
  if (/\baimed at teachers\b/i.test(description)) return description;
  if (!/teachers?\s+are\s+writers/i.test(title)) return description;
  const note = "This workshop is aimed at teachers.";
  return description.trim() ? `${description.trim()} ${note}` : note;
}

function shouldSkipJustBuffaloListing(title: string, rsvpUrl?: string): boolean {
  if (/season\s+subscriptions?\s+sold\s+out/i.test(title)) return true;
  if (rsvpUrl && /season-subscriptions/i.test(rsvpUrl)) return true;
  return false;
}

function withSessionTimes(
  base: Omit<WorkshopEvent, "cityId">,
  start: DateTime,
  end: DateTime,
): Omit<WorkshopEvent, "cityId"> {
  return {
    ...base,
    id: stableId(base.rsvpUrl ?? base.id, start),
    start: start.toISO() ?? start.toString(),
    end: end.toISO() ?? undefined,
  };
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

  const expanded: Omit<WorkshopEvent, "cityId">[] = [];
  for (const ev of parsed) {
    if (shouldSkipJustBuffaloListing(ev.title, ev.rsvpUrl)) continue;

    const start = DateTime.fromISO(ev.start, { zone: TZ });
    const end = ev.end
      ? DateTime.fromISO(ev.end, { zone: TZ })
      : start.plus({ hours: 1 });
    if (!start.isValid || !ev.rsvpUrl) {
      expanded.push({
        ...ev,
        description: ensureTeacherAudienceNote(ev.title, ev.description),
      });
      continue;
    }

    try {
      const detail = await fetchDetailSessionStarts(
        ev.rsvpUrl,
        start.year,
        start,
        end.isValid ? end : start.plus({ hours: 1 }),
        signal,
        ev.title,
      );
      if (detail) {
        const withAbout = {
          ...ev,
          description: ensureTeacherAudienceNote(
            ev.title,
            detail.description?.trim() || ev.description,
          ),
          price: detail.priceFree
            ? ("free" as const)
            : detail.price ?? ev.price,
          priceDetail: detail.priceDetail ?? ev.priceDetail,
        };
        if (detail.sessions.length >= 2) {
          for (const sess of detail.sessions) {
            expanded.push(withSessionTimes(withAbout, sess.start, sess.end));
          }
          continue;
        }
        expanded.push(withAbout);
        continue;
      }
    } catch {
      // Detail-page expansion is best-effort; keep the listing date.
    }
    expanded.push({
      ...ev,
      description: ensureTeacherAudienceNote(ev.title, ev.description),
    });
  }

  const inMonth = expanded.filter((e) => {
    const dt = DateTime.fromISO(e.start, { zone: TZ });
    return dt.isValid && dt.year === year && dt.month === monthIndex + 1;
  });

  // De-dupe identical ids (listing + expanded overlap).
  const seen = new Set<string>();
  const events: WorkshopEvent[] = [];
  for (const e of inMonth) {
    if (seen.has(e.id)) continue;
    seen.add(e.id);
    events.push({ ...e, cityId: "nyc" });
  }
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

