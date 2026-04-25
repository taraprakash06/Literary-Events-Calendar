import { DateTime } from "luxon";
import type { PriceKind, WorkshopEvent, WorkshopEventCategory } from "@/lib/workshop-types";
import { decodeHtmlEntities, stripHtmlAndDecode, toShortOverview } from "@/lib/text";

const ORIGIN = "https://www.strandbooks.com";
// Strand’s own events pages appear to block some server fetches; their public Eventbrite organizer page is accessible.
const EVENTBRITE_ORG_URL = "https://www.eventbrite.com/o/the-strand-book-store-30058841244";
const TZ = "America/New_York";

export type StrandParseMeta = {
  pageFetched: boolean;
  blocksFound: number;
  blocksParsed: number;
  rowsInMonth: number;
};

type ParsedBlock = {
  title: string;
  whenLine: string;
  venueLine: string;
  priceLine: string;
};

function cleanEventTitle(input: string): string {
  return input
    .replace(/\s+/g, " ")
    .trim()
    // urgency / availability badges
    .replace(/^(Almost full|Going fast|Sold Out)\s+/i, "")
    .replace(/^SOLD OUT\s*-\s*/i, "")
    // sometimes our loose capture starts at a time or venue/price token
    .replace(/^\d{1,2}:\d{2}\s*(?:AM|PM)\s+/i, "")
    .replace(/^(Strand Book Store|The Strand|The Strand Building)\s+/i, "")
    .replace(/^From\s+\$\d+(?:\.\d{2})?\s+/i, "")
    .replace(/^Sold Out\s+/i, "")
    .replace(/^Free\s+/i, "")
    .trim();
}

function htmlToTextLines(html: string): string[] {
  const withBreaks = html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|h1|h2|h3|h4|h5|h6|section|article|header|footer|main|nav)>/gi, "\n")
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

function isWhenLine(s: string): boolean {
  return (
    /\bToday\b/i.test(s) ||
    /\bTomorrow\b/i.test(s) ||
    /\b(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun),\s*(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\b/i.test(
      s,
    )
  );
}

function parseStartFromWhenLine(
  now: DateTime,
  whenLine: string,
  contextYear: number,
  contextMonthIndex: number,
): DateTime | null {
  const cleaned = whenLine.replace(/\s+/g, " ").trim();

  // "Today • 6:30 PM"
  const rel = cleaned.match(/\b(Today|Tomorrow)\b\s*•\s*(\d{1,2}(?::\d{2})?\s*(?:AM|PM))\b/i);
  if (rel) {
    // Only include "Today/Tomorrow" rows when the requested month matches "now".
    if (now.year !== contextYear || now.month !== contextMonthIndex + 1) return null;
    const base = rel[1].toLowerCase() === "tomorrow" ? now.plus({ days: 1 }) : now;
    const t = rel[2].toUpperCase().replace(/^(\d{1,2})\s*(AM|PM)$/i, "$1:00 $2");
    const time = DateTime.fromFormat(t, "h:mm a", { zone: TZ, locale: "en" });
    if (!time.isValid) return null;
    const dt = base.set({ hour: time.hour, minute: time.minute, second: 0, millisecond: 0 });
    return dt.isValid ? dt : null;
  }

  // "Mon, Apr 27 • 7:00 PM"
  const abs = cleaned.match(
    /\b(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun),\s*(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{1,2})\s*•\s*(\d{1,2}(?::\d{2})?\s*(?:AM|PM))\b/i,
  );
  if (abs) {
    const t = abs[3].toUpperCase().replace(/^(\d{1,2})\s*(AM|PM)$/i, "$1:00 $2");
    const dt = DateTime.fromFormat(`${abs[1]} ${abs[2]} ${contextYear} ${t}`, "LLL d yyyy h:mm a", {
      zone: TZ,
      locale: "en",
    });
    return dt.isValid ? dt : null;
  }

  return null;
}

function priceFromLine(priceLine: string): PriceKind {
  const s = priceLine.toLowerCase();
  if (/\bfree\b/.test(s)) return "free";
  if (/\$/.test(s) || /\bfrom\b/.test(s) || /\b\d+\.\d{2}\b/.test(s)) return "paid";
  return "unknown";
}

function categoryFromTitle(title: string): WorkshopEventCategory {
  const b = title.toLowerCase();
  if (/\bstorytime\b/.test(b)) return "reading";
  if (/\bpanel\b|\bin conversation\b|\bconversation\b/.test(b)) return "panel";
  if (/\bworkshop\b/.test(b)) return "workshop";
  if (/\blaunch\b/.test(b)) return "launch";
  return "reading";
}

function stableId(title: string, start: DateTime): string {
  const slug = title
    .trim()
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return `strand-${slug}-${start.toFormat("yyyyLLddHHmm")}`;
}

function extractUpcomingTextBlocks(html: string): ParsedBlock[] {
  // Eventbrite organizer pages often hydrate event cards client-side; however, the
  // event names and date strings are usually present in the HTML as plain text.
  // Using a regex over the normalized text is more reliable than relying on
  // preserved line breaks.
  const text = stripHtmlAndDecode(html).replace(/\s+/g, " ").trim();
  const startAt = text.search(/\bUpcoming\b/i);
  const slice = startAt === -1 ? text : text.slice(startAt);

  const blocks: ParsedBlock[] = [];

  const re = new RegExp(
    [
      // title (keep reasonably bounded)
      "([A-Z0-9][^•]{6,160}?)",
      // when (Today/Tomorrow or weekday + month + day)
      "\\s+((?:Today|Tomorrow|(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun),\\s*(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\\s+\\d{1,2}))",
      "\\s*•\\s*",
      // time
      "(\\d{1,2}(?::\\d{2})?\\s*(?:AM|PM))",
      "\\s+",
      // venue-ish (up to price token)
      "([^$]{3,80}?)",
      "\\s+",
      // price token
      "(From\\s+\\$\\d+(?:\\.\\d{2})?|Free|Sold Out)",
    ].join(""),
    "gi",
  );

  for (const m of slice.matchAll(re)) {
    const rawTitle = (m[1] ?? "").trim();
    const dayPart = (m[2] ?? "").trim();
    const timePart = (m[3] ?? "").trim().toUpperCase();
    const venueLine = (m[4] ?? "").trim();
    const priceLine = (m[5] ?? "").trim();

    if (!rawTitle || !dayPart || !timePart) continue;
    if (/\bsold out\b/i.test(rawTitle) || /\bsold out\b/i.test(priceLine)) continue;
    const title = cleanEventTitle(rawTitle.replace(/\bShare\b.*$/i, "").trim());
    const whenLine = `${dayPart} • ${timePart}`;

    if (!isWhenLine(whenLine)) continue;
    if (!venueLine) continue;
    if (/^The Strand Book Store$/i.test(title)) continue;

    blocks.push({ title, whenLine, venueLine, priceLine });
    if (blocks.length >= 80) break;
  }

  // Dedupe identical titles+when combos.
  const seen = new Set<string>();
  return blocks.filter((b) => {
    const k = `${b.title}@@${b.whenLine}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

function tryExtractRsvpUrlsByTitle(html: string): Map<string, string> {
  const map = new Map<string, string>();
  const seenIds = new Set<string>();

  // Anchor wraps the image; the <img alt="... primary image"> contains the event title.
  const re =
    /<a\b[^>]*href="(\/e\/[^"]+)"[^>]*data-event-id="(\d+)"[^>]*>[\s\S]*?<img\b[^>]*alt="([^"]+?)\s*primary image"[^>]*>[\s\S]*?<\/a>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const hrefRel = m[1];
    const id = m[2];
    const titleRaw = m[3] ?? "";
    if (!hrefRel || !id) continue;
    if (seenIds.has(id)) continue;
    seenIds.add(id);

    const title = cleanEventTitle(stripHtmlAndDecode(titleRaw));
    if (!title || title.length < 6) continue;
    const href = `https://www.eventbrite.com${hrefRel}`;
    if (!map.has(title)) map.set(title, href);
  }
  return map;
}

function findRsvpUrlForTitle(html: string, title: string): string | null {
  const tokens = normalizeTitleTokens(cleanEventTitle(title));
  if (tokens.length === 0) return null;

  const hrefRe = /href="(\/e\/[^"]+tickets-\d+[^"]*)"/gi;
  const hrefs: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = hrefRe.exec(html))) {
    hrefs.push(m[1]);
    if (hrefs.length > 400) break;
  }
  if (hrefs.length === 0) return null;

  let best: { score: number; href: string } | null = null;
  for (const href of hrefs) {
    const h = href.toLowerCase();
    let score = 0;
    for (const t of tokens) {
      if (h.includes(t)) score += 1;
    }
    // Prefer links that contain more title tokens.
    if (!best || score > best.score) best = { score, href };
  }

  if (!best || best.score < 2) return null;
  return `https://www.eventbrite.com${best.href}`;
}

function normalizeTitleTokens(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .split(" ")
    .map((t) => t.trim())
    .filter((t) => t.length >= 3 && !/^\d+$/.test(t));
}

function bestUrlForTitle(title: string, urlByTitle: Map<string, string>): string | null {
  const want = new Set(normalizeTitleTokens(cleanEventTitle(title)));
  if (want.size === 0) return null;

  let best: { score: number; url: string } | null = null;
  for (const [k, url] of urlByTitle.entries()) {
    const have = normalizeTitleTokens(k);
    let score = 0;
    for (const t of have) {
      if (want.has(t)) score += 1;
    }
    // slight boost if one contains the other (common for sold-out prefixes)
    const a = cleanEventTitle(title).toLowerCase();
    const b = k.toLowerCase();
    if (a.includes(b) || b.includes(a)) score += 2;

    if (!best || score > best.score) best = { score, url };
  }

  // Require a minimal overlap to avoid random mismatches.
  if (!best || best.score < 2) return null;
  return best.url;
}

export async function fetchStrandEventsForMonth(
  year: number,
  monthIndex: number,
  signal?: AbortSignal,
): Promise<{ events: WorkshopEvent[]; meta: StrandParseMeta }> {
  const ua =
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

  const res = await fetch(EVENTBRITE_ORG_URL, {
    signal,
    headers: {
      Accept: "text/html,application/xhtml+xml",
      "Accept-Language": "en-US,en;q=0.9",
      "User-Agent": ua,
      Referer: "https://www.eventbrite.com/",
    },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Strand Eventbrite organizer page HTTP ${res.status}`);
  const html = await res.text();

  const blocks = extractUpcomingTextBlocks(html);
  const now = DateTime.now().setZone(TZ);

  const mapped: WorkshopEvent[] = blocks
    .map((b): WorkshopEvent | null => {
      const start = parseStartFromWhenLine(now, b.whenLine, year, monthIndex);
      if (!start) return null;
      const end = start.plus({ hours: 1 });
      const price = priceFromLine(b.priceLine);
      const category = categoryFromTitle(b.title);

      const rsvpUrl = findRsvpUrlForTitle(html, b.title) ?? EVENTBRITE_ORG_URL;
      const desc = toShortOverview(`${b.whenLine} ${b.venueLine} ${b.priceLine}`, 260);

      const ev: WorkshopEvent = {
        id: stableId(b.title, start),
        cityId: "nyc",
        title: b.title,
        tagline: b.venueLine,
        description: desc || b.title,
        start: start.toISO() ?? start.toString(),
        end: end.toISO() ?? undefined,
        timeZone: TZ,
        format: "in-person",
        price,
        category,
        organizer: "Strand Book Store",
        venue: b.venueLine,
        rsvpUrl,
        source: "Strand Book Store (strandbooks.com via Eventbrite)",
        sourceChannel: "bookstore",
        listingProvenance: "live",
      };
      return ev;
    })
    .filter((e): e is WorkshopEvent => e != null);

  const inMonth = mapped.filter((e) => {
    const dt = DateTime.fromISO(e.start, { zone: TZ });
    return dt.isValid && dt.year === year && dt.month === monthIndex + 1;
  });

  return {
    events: inMonth,
    meta: {
      pageFetched: true,
      blocksFound: blocks.length,
      blocksParsed: mapped.length,
      rowsInMonth: inMonth.length,
    },
  };
}

