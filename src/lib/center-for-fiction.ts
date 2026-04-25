import { DateTime } from "luxon";
import type {
  EventFormat,
  WorkshopEvent,
  WorkshopEventCategory,
} from "@/lib/workshop-types";
import { stripHtmlAndDecode, toShortOverview } from "@/lib/text";

const ORIGIN = "https://centerforfiction.org";
const TZ = "America/New_York";

const PAGES = [
  { kind: "events" as const, url: `${ORIGIN}/events/` },
  { kind: "reading-groups" as const, url: `${ORIGIN}/reading-groups/` },
  { kind: "writing-workshops" as const, url: `${ORIGIN}/writing-workshops/` },
];

export type CenterForFictionParseMeta = {
  pagesFetched: number;
  linksFound: number;
  linksParsed: number;
  rowsInMonth: number;
};

type CffKind = (typeof PAGES)[number]["kind"];

type CffRawLink = {
  kind: CffKind;
  href: string;
  text: string;
};

function normalizeTimeToken(t: string): string {
  const s = t.trim().toLowerCase();
  if (/\d{1,2}:\d{2}/.test(s)) return s.replace(/\s+/g, " ");
  return s.replace(/^(\d{1,2})\s*(am|pm)$/i, "$1:00 $2").replace(/\s+/g, " ");
}

function parseStartDateTimeFromLinkText(text: string): DateTime | null {
  const cleaned = text
    .replace(/\s+/g, " ")
    .replace(/\bEDT\b|\bEST\b/gi, "")
    .trim();

  // Typical: "... Tuesday, 7:00 pm EDT April 21, 2026 ..."
  const abs = cleaned.match(
    /\b([A-Za-z]+)\s+(\d{1,2}),\s*(\d{4})\b.*?\b(\d{1,2}(?::\d{2})?\s*(?:am|pm))\b/i,
  );
  if (abs) {
    const date = `${abs[1]} ${abs[2]}, ${abs[3]}`;
    const time = normalizeTimeToken(abs[4]);
    const dt1 = DateTime.fromFormat(`${date} ${time}`, "LLLL d, yyyy h:mm a", {
      zone: TZ,
      locale: "en",
    });
    if (dt1.isValid) return dt1;
    const dt2 = DateTime.fromFormat(`${date} ${time}`, "LLL d, yyyy h:mm a", {
      zone: TZ,
      locale: "en",
    });
    if (dt2.isValid) return dt2;
  }

  // Ranges: "April 21 to May 26, 2026 ..." (use first date + trailing year)
  const range = cleaned.match(
    /\b([A-Za-z]+)\s+(\d{1,2})\s+to\s+[A-Za-z]+\s+\d{1,2},\s*(\d{4})\b.*?\b(\d{1,2}(?::\d{2})?\s*(?:am|pm))\b/i,
  );
  if (range) {
    const date = `${range[1]} ${range[2]}, ${range[3]}`;
    const time = normalizeTimeToken(range[4]);
    const dt1 = DateTime.fromFormat(`${date} ${time}`, "LLLL d, yyyy h:mm a", {
      zone: TZ,
      locale: "en",
    });
    if (dt1.isValid) return dt1;
    const dt2 = DateTime.fromFormat(`${date} ${time}`, "LLL d, yyyy h:mm a", {
      zone: TZ,
      locale: "en",
    });
    if (dt2.isValid) return dt2;
  }

  return null;
}

function parseEndTimeFromLinkText(text: string, start: DateTime): DateTime | null {
  const cleaned = text
    .replace(/\s+/g, " ")
    .replace(/\bEDT\b|\bEST\b/gi, "")
    .trim();
  const endTok = cleaned.match(
    /\b(\d{1,2}(?::\d{2})?\s*(?:am|pm))\b\s*-\s*\b(\d{1,2}(?::\d{2})?\s*(?:am|pm))\b/i,
  );
  if (!endTok) return null;
  const endTime = normalizeTimeToken(endTok[2]);
  const parsed = DateTime.fromFormat(endTime, "h:mm a", { zone: TZ, locale: "en" });
  if (!parsed.isValid) return null;
  return start.set({ hour: parsed.hour, minute: parsed.minute, second: 0, millisecond: 0 });
}

function mapFormat(text: string): EventFormat {
  const b = text.toLowerCase();
  const online = /\bonline\b/.test(b);
  const inPerson = /\bin person\b|in-person/.test(b);
  if (online && inPerson) return "hybrid";
  if (online) return "virtual";
  return "in-person";
}

function mapCategory(kind: CffKind, title: string): WorkshopEventCategory {
  const b = `${kind} ${title}`.toLowerCase();
  if (kind === "reading-groups") return "book-club";
  if (kind === "writing-workshops") return "workshop";
  if (/\b(workshop|craft|bootcamp|writing)\b/.test(b)) return "workshop";
  if (/\b(panel|conversation|in conversation|talk|lecture)\b/.test(b)) return "panel";
  if (/\bfestival|crawl\b/.test(b)) return "festival";
  return "reading";
}

function stableIdFromHref(href: string, start: DateTime): string {
  const slug = href
    .replace(ORIGIN, "")
    .replace(/\/+$/g, "")
    .replace(/^\/+/g, "")
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/-+/g, "-")
    .toLowerCase();
  return `cff-${slug}-${start.toFormat("yyyyLLddHHmm")}`;
}

function extractRelevantLinks(html: string, kind: CffKind): CffRawLink[] {
  const out: CffRawLink[] = [];
  const aRe =
    /<a\b[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  let m: RegExpExecArray | null;
  while ((m = aRe.exec(html))) {
    const hrefRaw = m[1];
    const text = stripHtmlAndDecode(m[2]);
    if (!hrefRaw || !text) continue;
    const href = hrefRaw.startsWith("http") ? hrefRaw : `${ORIGIN}${hrefRaw}`;
    if (!href.startsWith(ORIGIN)) continue;
    if (!/\/(event|group-workshop)\//i.test(href)) continue;
    // Link text contains the calendar-like date/time line on these pages.
    if (!/\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\b/i.test(text)) {
      continue;
    }
    out.push({ kind, href, text });
  }
  return out;
}

function mapLinkToEvent(link: CffRawLink): WorkshopEvent | null {
  const start = parseStartDateTimeFromLinkText(link.text);
  if (!start || !start.isValid) return null;

  const end = parseEndTimeFromLinkText(link.text, start) ?? start.plus({ hours: 1 });
  const format = mapFormat(link.text);

  // The link text often begins with "Events ..." / "Groups+Workshops ...".
  // We derive a readable title from the href slug if needed.
  const titleFromText = link.text
    .replace(/^(Events|Groups\+Workshops)\s+/i, "")
    .replace(/\b(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)s?,?\b/i, "")
    .replace(/\s+\d{1,2}(?::\d{2})?\s*(?:am|pm)\b.*$/i, "")
    .trim();
  const title =
    titleFromText.length >= 10
      ? titleFromText
      : stripHtmlAndDecode(
          link.href
            .replace(ORIGIN, "")
            .replace(/\/+$/g, "")
            .split("/")
            .pop() ?? "Center for Fiction event",
        ).replace(/-/g, " ");

  const category = mapCategory(link.kind, title);
  const description = toShortOverview(link.text, 420) || title;

  return {
    id: stableIdFromHref(link.href, start),
    cityId: "nyc",
    title,
    tagline:
      format === "virtual"
        ? "Online"
        : "The Center for Fiction (Brooklyn)",
    description,
    start: start.toISO() ?? start.toString(),
    end: end.toISO() ?? undefined,
    timeZone: TZ,
    format,
    price: "unknown",
    category,
    organizer: "The Center for Fiction",
    venue: format === "in-person" || format === "hybrid" ? "The Center for Fiction" : undefined,
    rsvpUrl: link.href,
    source: "The Center for Fiction (centerforfiction.org)",
    sourceChannel: "literary_org",
    listingProvenance: "live",
  };
}

export async function fetchCenterForFictionEventsForMonth(
  year: number,
  monthIndex: number,
  signal?: AbortSignal,
): Promise<{ events: WorkshopEvent[]; meta: CenterForFictionParseMeta }> {
  const ua =
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

  const pagesFetched: string[] = [];
  const rawLinks: CffRawLink[] = [];

  for (const p of PAGES) {
    const res = await fetch(p.url, {
      signal,
      headers: {
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "en-US,en;q=0.9",
        "User-Agent": ua,
        Referer: `${ORIGIN}/`,
      },
      cache: "no-store",
    });
    if (!res.ok) continue;
    pagesFetched.push(p.url);
    const html = await res.text();
    rawLinks.push(...extractRelevantLinks(html, p.kind));
  }

  const mapped = rawLinks.map(mapLinkToEvent).filter((e): e is WorkshopEvent => e != null);
  const inMonth = mapped.filter((e) => {
    const dt = DateTime.fromISO(e.start, { zone: TZ });
    return dt.isValid && dt.year === year && dt.month === monthIndex + 1;
  });

  return {
    events: inMonth,
    meta: {
      pagesFetched: pagesFetched.length,
      linksFound: rawLinks.length,
      linksParsed: mapped.length,
      rowsInMonth: inMonth.length,
    },
  };
}

