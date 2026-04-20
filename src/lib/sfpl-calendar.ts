import { DateTime } from "luxon";
import type { EventFormat, WorkshopEvent, WorkshopEventCategory } from "@/lib/workshop-types";

const SFPL_ORIGIN = "https://sfpl.org";

export type SfplParseMeta = {
  pagesFetched: number;
  rowsParsed: number;
  rowsAfterLiteraryFilter: number;
};

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function monthDateRange(year: number, monthIndex: number): { from: string; to: string } {
  const from = `${year}-${pad2(monthIndex + 1)}-01`;
  const last = new Date(year, monthIndex + 1, 0);
  const to = `${year}-${pad2(monthIndex + 1)}-${pad2(last.getDate())}`;
  return { from, to };
}

function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function decodeHtmlEntities(s: string): string {
  return s
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#039;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
}

function buildEventsUrl(year: number, monthIndex: number, page: number): string {
  const { from, to } = monthDateRange(year, monthIndex);
  const u = new URL(`${SFPL_ORIGIN}/events`);
  u.searchParams.set("items_per_page", "50");
  u.searchParams.set("date-from", from);
  u.searchParams.set("date-to", to);
  if (page > 0) u.searchParams.set("page", String(page));
  return u.toString();
}

function hasNext(html: string): boolean {
  return /rel="next"|class="pager__item--next"|aria-label="Next"/i.test(html);
}

type SfplRawTeaser = {
  path: string;
  title: string;
  dateRangeText: string;
  location: string;
  topics: string[];
  audiences: string[];
};

function parseTeasers(html: string): SfplRawTeaser[] {
  const out: SfplRawTeaser[] = [];
  const re = /<article[^>]+about="(\/events\/[^"]+)"[\s\S]*?<\/article>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const block = m[0];
    const path = m[1];

    const dateRangeText =
      block.match(/field-event-date-and-time[^>]*>[\s\S]*?<span[^>]*>([^<]+)<\/span>/i)?.[1] ??
      block.match(/date-display-range[^>]*>([^<]+)<\/span>/i)?.[1] ??
      "";

    const title =
      decodeHtmlEntities(
        (block.match(/class="event__title"[\s\S]*?<a[^>]*>[\s\S]*?<span>([^<]+)<\/span>/i)?.[1] ??
          block.match(/class="event__title"[\s\S]*?<a[^>]*>([^<]+)<\/a>/i)?.[1] ??
          "").trim(),
      );

    const location =
      decodeHtmlEntities(
        stripTags(
          block.match(/field--name-field-event-location[\s\S]*?<\/div>\s*<\/div>/i)?.[0] ?? "",
        ),
      ) || "";

    const topicMatches = [...block.matchAll(/field--name-field-event-topic[\s\S]*?<a[^>]*>([^<]+)<\/a>/gi)];
    const topics = topicMatches.map((x) => decodeHtmlEntities(x[1]).trim()).filter(Boolean);

    const audMatches = [...block.matchAll(/field--name-field-event-audience[\s\S]*?<a[^>]*>([^<]+)<\/a>/gi)];
    const audiences = audMatches.map((x) => decodeHtmlEntities(x[1]).trim()).filter(Boolean);

    if (!path || !title) continue;
    out.push({ path, title, dateRangeText: decodeHtmlEntities(dateRangeText).trim(), location, topics, audiences });
  }
  return out;
}

function parseDateRangeToUtc(dateRangeText: string): { start: string; end?: string } | null {
  // Example: "Monday, 4/13/2026, 10:15 - 10:45"
  const m = dateRangeText.match(
    /^\s*([A-Za-z]+),\s*(\d{1,2})\/(\d{1,2})\/(\d{4}),\s*(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})\s*$/,
  );
  if (!m) return null;
  const month = Number(m[2]);
  const day = Number(m[3]);
  const year = Number(m[4]);
  const startTime = m[5];
  const endTime = m[6];

  const start = DateTime.fromFormat(
    `${year}-${pad2(month)}-${pad2(day)} ${startTime}`,
    "yyyy-LL-dd H:mm",
    { zone: "America/Los_Angeles" },
  );
  if (!start.isValid) return null;
  const end = DateTime.fromFormat(
    `${year}-${pad2(month)}-${pad2(day)} ${endTime}`,
    "yyyy-LL-dd H:mm",
    { zone: "America/Los_Angeles" },
  );

  return {
    start: start.toUTC().toISO() ?? "",
    end: end.isValid && end > start ? end.toUTC().toISO() ?? undefined : undefined,
  };
}

function inferFormat(teaser: SfplRawTeaser): { format: EventFormat; virtualLabel?: string } {
  const blob = `${teaser.title}\n${teaser.location}\n${teaser.topics.join(" ")}\n${teaser.audiences.join(" ")}`.toLowerCase();
  const isVirtualLocation = /virtual library/i.test(teaser.location);
  const mentionsOnline = /\b(virtual|online|zoom|teams|google meet|webex)\b/i.test(blob);
  if (isVirtualLocation || mentionsOnline) {
    return { format: "virtual", virtualLabel: "Online (SFPL)" };
  }
  return { format: "in-person" };
}

function inferCategory(teaser: SfplRawTeaser): WorkshopEventCategory {
  const blob = `${teaser.title}\n${teaser.topics.join(" ")}\n${teaser.audiences.join(" ")}`.toLowerCase();
  if (/\bbook club|book discussion|reading group\b/.test(blob)) return "book-club";
  if (/\bworkshop|writing\b|creative writing|writers\b/.test(blob)) return "workshop";
  if (/\bpoetry\b|author\b|reading\b|lecture\b|talk\b/.test(blob)) return "reading";
  if (/\bopen mic\b|spoken word\b/.test(blob)) return "open-mic";
  return "other";
}

function isSfplLiterary(teaser: SfplRawTeaser): boolean {
  const blob = `${teaser.title}\n${teaser.topics.join(" ")}\n${teaser.audiences.join(" ")}`.toLowerCase();
  const include = /\b(book club|book discussion|reading group|poetry|author|writers|writing|creative writing|literary|zine|publishing|memoir)\b/.test(
    blob,
  );
  if (!include) return false;
  if (/\bstorytime\b|for babies|for toddlers|preschool|family storytime/.test(blob)) return false;
  return true;
}

export function mapSfplTeaserToWorkshop(teaser: SfplRawTeaser): WorkshopEvent | null {
  if (!isSfplLiterary(teaser)) return null;
  const dt = parseDateRangeToUtc(teaser.dateRangeText);
  if (!dt?.start) return null;
  const { format, virtualLabel } = inferFormat(teaser);
  const category = inferCategory(teaser);
  const rsvpUrl = `${SFPL_ORIGIN}${teaser.path}`;

  return {
    id: `sfpl-${teaser.path.replace(/[^a-z0-9]+/gi, "-")}`,
    cityId: "sf",
    title: teaser.title,
    tagline: teaser.topics.slice(0, 3).join(" · "),
    description: "Details on the San Francisco Public Library event page.",
    start: dt.start,
    end: dt.end,
    timeZone: "America/Los_Angeles",
    format,
    price: "free",
    category,
    organizer: "San Francisco Public Library",
    venue: teaser.location || "San Francisco Public Library",
    neighborhood: teaser.location || undefined,
    virtualLabel,
    rsvpUrl,
    source: "SFPL — Events",
    sourceChannel: "library",
    listingProvenance: "live",
  };
}

export async function fetchSfplLiteraryEventsForMonth(
  year: number,
  monthIndex: number,
): Promise<{ events: WorkshopEvent[]; meta: SfplParseMeta }> {
  const headers = { "User-Agent": "LiteraryEventsCalendar/1.0 (educational; contact repo owner)" };
  const seen = new Set<string>();
  const events: WorkshopEvent[] = [];
  let pagesFetched = 0;
  let rowsParsed = 0;

  for (let page = 0; page < 30; page++) {
    const url = buildEventsUrl(year, monthIndex, page);
    const res = await fetch(url, { headers, cache: "no-store" });
    if (!res.ok) break;
    const html = await res.text();
    pagesFetched += 1;

    const teasers = parseTeasers(html);
    rowsParsed += teasers.length;
    for (const t of teasers) {
      if (seen.has(t.path)) continue;
      seen.add(t.path);
      const mapped = mapSfplTeaserToWorkshop(t);
      if (mapped) events.push(mapped);
    }

    if (!hasNext(html)) break;
    if (teasers.length === 0) break;
  }

  const inMonth = events.filter((e) => {
    const dt = DateTime.fromISO(e.start, { zone: "utc" }).setZone("America/Los_Angeles");
    return dt.isValid && dt.year === year && dt.month === monthIndex + 1;
  });
  inMonth.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());

  return {
    events: inMonth,
    meta: {
      pagesFetched,
      rowsParsed,
      rowsAfterLiteraryFilter: inMonth.length,
    },
  };
}

