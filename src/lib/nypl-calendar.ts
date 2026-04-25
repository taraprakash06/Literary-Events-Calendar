/**
 * New York Public Library — public events calendar (Drupal).
 * Source: https://www.nypl.org/events/calendar
 *
 * Note: NYPL sits behind Imperva/Incapsula; some hosting IPs may receive a
 * challenge page instead of HTML. When that happens, the fetch throws a clear error.
 */

import { DateTime } from "luxon";

export const NYPL_ORIGIN = "https://www.nypl.org";
export const NYPL_EVENTS_CALENDAR = `${NYPL_ORIGIN}/events/calendar`;

const TZ = "America/New_York";

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function monthRangeForQuery(year: number, monthIndex: number): {
  isoMin: string;
  isoMax: string;
  slashMin: string;
  slashMax: string;
} {
  const first = `${year}-${pad2(monthIndex + 1)}-01`;
  const lastD = new Date(year, monthIndex + 1, 0).getDate();
  const last = `${year}-${pad2(monthIndex + 1)}-${pad2(lastD)}`;
  const slashMin = `${pad2(monthIndex + 1)}/01/${year}`;
  const slashMax = `${pad2(monthIndex + 1)}/${pad2(lastD)}/${year}`;
  return { isoMin: first, isoMax: last, slashMin, slashMax };
}

function decodeHtmlEntities(s: string): string {
  return s
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#0*39;/g, "'")
    .replace(/&#8217;/g, "'")
    .replace(/&#8211;/g, "-")
    .replace(/&#8230;/g, "…")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_, n) => {
      const code = Number(n);
      if (!Number.isFinite(code) || code <= 0) return "";
      try {
        return String.fromCodePoint(code);
      } catch {
        return "";
      }
    });
}

function stripTags(html: string): string {
  return decodeHtmlEntities(html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
}

export type NyplRawRow = {
  programPath: string;
  /** Title text from the listing link (may be truncated). */
  title: string;
  /** Raw first-column date/time cell */
  whenCell: string;
  locationCell: string;
};

function isIncapsulaChallenge(html: string): boolean {
  return (
    html.includes("_Incapsula_Resource") ||
    html.includes("Request unsuccessful") ||
    /Incapsula incident ID/i.test(html)
  );
}

async function fetchHtmlCandidates(
  year: number,
  monthIndex: number,
  signal?: AbortSignal,
): Promise<string> {
  const { isoMin, isoMax, slashMin, slashMax } = monthRangeForQuery(year, monthIndex);
  const candidates = [
    `${NYPL_EVENTS_CALENDAR}?field_event_date_value%5Bmin%5D%5Bdate%5D=${encodeURIComponent(isoMin)}&field_event_date_value%5Bmax%5D%5Bdate%5D=${encodeURIComponent(isoMax)}`,
    `${NYPL_EVENTS_CALENDAR}?date%5Bmin%5D%5Bdate%5D=${encodeURIComponent(slashMin)}&date%5Bmax%5D%5Bdate%5D=${encodeURIComponent(slashMax)}`,
    `${NYPL_EVENTS_CALENDAR}?date%5Bvalue%5D%5Bdate%5D=${encodeURIComponent(slashMin)}`,
    NYPL_EVENTS_CALENDAR,
  ];

  let lastErr: Error | null = null;
  for (const url of candidates) {
    if (signal?.aborted) {
      const e = new Error("Aborted");
      e.name = "AbortError";
      throw e;
    }
    try {
      const res = await fetch(url, {
        signal,
        headers: {
          Accept: "text/html,application/xhtml+xml",
          "Accept-Language": "en-US,en;q=0.9",
          "User-Agent": UA,
          Referer: `${NYPL_ORIGIN}/`,
        },
        cache: "no-store",
      });
      const html = await res.text();
      if (!res.ok) {
        lastErr = new Error(`NYPL calendar HTTP ${res.status}`);
        continue;
      }
      if (isIncapsulaChallenge(html)) {
        lastErr = new Error(
          "NYPL returned an Incapsula bot challenge for this server IP. Try deploying from a different network or contact NYPL for a data feed.",
        );
        continue;
      }
      if (html.length < 8000 || !/\/events\/programs\/\d{4}\/\d{2}\/\d{2}\//i.test(html)) {
        lastErr = new Error("NYPL calendar HTML did not contain expected program listings.");
        continue;
      }
      return html;
    } catch (e) {
      lastErr = e instanceof Error ? e : new Error(String(e));
    }
  }
  throw lastErr ?? new Error("NYPL calendar fetch failed");
}

const PROGRAM_PATH_RE =
  /\/events\/programs\/(\d{4})\/(\d{2})\/(\d{2})\/([^"'#?]+)/gi;

function parseRowsFromCalendarHtml(html: string): NyplRawRow[] {
  const rows: NyplRawRow[] = [];
  const trRe = /<tr\b[^>]*>([\s\S]*?)<\/tr>/gi;
  let trM: RegExpExecArray | null;
  while ((trM = trRe.exec(html))) {
    const tr = trM[1];
    const linkM = tr.match(
      /href="(?:https:\/\/www\.nypl\.org)?(\/events\/programs\/\d{4}\/\d{2}\/\d{2}\/[^"#?]+)"/i,
    );
    if (!linkM) continue;
    const programPath = linkM[1].trim();
    const titleRaw =
      tr.match(/<a[^>]+href="[^"]*\/events\/programs\/[^"]+"[^>]*>([\s\S]*?)<\/a>/i)?.[1] ??
      "";
    const title = stripTags(titleRaw);
    if (!title) continue;

    const tds = [...tr.matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map((x) => x[1]);
    if (tds.length < 3) continue;
    const whenCell = stripTags(tds[0]);
    const locationCell = stripTags(tds[2]);
    rows.push({ programPath, title, whenCell, locationCell });
  }

  if (rows.length > 0) return rows;

  /** Fallback: harvest program links without table structure. */
  const seen = new Set<string>();
  let m: RegExpExecArray | null;
  PROGRAM_PATH_RE.lastIndex = 0;
  while ((m = PROGRAM_PATH_RE.exec(html))) {
    const path = `/events/programs/${m[1]}/${m[2]}/${m[3]}/${m[4]}`;
    if (seen.has(path)) continue;
    seen.add(path);
    const slug = m[4];
    const title = slugTitleFromSlug(slug);
    rows.push({
      programPath: path,
      title,
      whenCell: "",
      locationCell: "",
    });
  }
  return rows;
}

function slugTitleFromSlug(slug: string): string {
  try {
    slug = decodeURIComponent(slug);
  } catch {
    /* ignore */
  }
  return decodeHtmlEntities(
    slug
      .replace(/^clone-+/i, "")
      .replace(/-+0$/i, "")
      .replace(/-/g, " ")
      .replace(/\s+/g, " ")
      .trim(),
  );
}

export function slugFromProgramPath(path: string): string {
  const m = path.match(/\/events\/programs\/\d{4}\/\d{2}\/\d{2}\/([^/?#]+)/i);
  return (m?.[1] ?? path).trim();
}

export function datePartsFromPath(path: string): { y: number; m: number; d: number } | null {
  const m = path.match(/\/events\/programs\/(\d{4})\/(\d{2})\/(\d{2})\//i);
  if (!m) return null;
  return { y: Number(m[1]), m: Number(m[2]), d: Number(m[3]) };
}

function isNyplLiteraryRow(row: NyplRawRow): boolean {
  const slug = slugFromProgramPath(row.programPath).toLowerCase();
  const blob = `${row.title}\n${row.locationCell}\n${slug}`.toLowerCase();

  // Exclude obvious non-literary training/career/tech events.
  const negative =
    /\b(excel|google sheets|photoshop|illustrator|adobe|premiere|after effects|linkedin learning|resume|job search|career|taxes|investing|crypto|medicare|health insurance|citizenship|computer basics|coding|python (?:for )?beginners|techconnect|3d printing)\b/i.test(
      blob,
    );

  // Strong literary / creative-writing intent.
  const strong =
    /\b(creative writing|writing workshop|writing group|writers(?:\s+group)?|writing circle|workshop)\b/i.test(
      blob,
    ) ||
    /\b(author talk|in conversation|book talk|book launch|reading(?:\s+and\s+signing)?|poetry reading|poetry|open mic|spoken word|zine|publishing)\b/i.test(
      blob,
    ) ||
    /\b(book club|book discussion|reading group|one book|banned books)\b/i.test(blob);

  // Weaker signals: allow only if not negative and still clearly bookish.
  const weakBookish =
    /\b(book|novel|fiction|nonfiction|memoir|short story|storytelling|literary)\b/i.test(
      blob,
    ) &&
    !/\bstorytime\b/i.test(blob);

  if (negative && !strong) return false;
  return strong || weakBookish;
}

export type NyplParseMeta = {
  rowsParsed: number;
  rowsAfterLiteraryFilter: number;
};

function normalizeNyplTimeToken(t: string): string {
  const s = t.trim();
  if (/\d{1,2}:\d{2}/i.test(s)) return s;
  return s.replace(/^(\d{1,2})\s*(am|pm)$/i, "$1:00 $2");
}

export function parseNyplWhenToStart(
  row: NyplRawRow,
  parts: { y: number; m: number; d: number },
): DateTime | null {
  const when = row.whenCell.trim();
  const base = DateTime.fromObject(
    { year: parts.y, month: parts.m, day: parts.d },
    { zone: TZ },
  ).startOf("day");
  if (!base.isValid) return null;

  if (!when) {
    return base.set({ hour: 12, minute: 0, second: 0, millisecond: 0 });
  }

  // "April 21, 2026 @ 5:00 pm" or "Apr 21, 2026 @ 5:00 pm"
  const abs = when.match(
    /([A-Za-z]{3,9}\s+\d{1,2},\s+\d{4})\s+@\s*(\d{1,2}:\d{2}\s*(?:am|pm)|\d{1,2}\s*(?:am|pm))/i,
  );
  if (abs) {
    const timeTok = normalizeNyplTimeToken(abs[2]);
    const dt = DateTime.fromFormat(
      `${abs[1]} ${timeTok}`,
      "LLLL d, yyyy h:mm a",
      { zone: TZ, locale: "en" },
    );
    if (dt.isValid) return dt;
    const dt2 = DateTime.fromFormat(
      `${abs[1]} ${timeTok}`,
      "LLL d, yyyy h:mm a",
      { zone: TZ, locale: "en" },
    );
    if (dt2.isValid) return dt2;
  }

  // "Today @ 10 AM" / "Today @ 10:15 AM"
  const today = when.match(/Today\s+@\s*(\d{1,2}:\d{2}\s*(?:am|pm)|\d{1,2}\s*(?:am|pm))/i);
  if (today) {
    const t = normalizeNyplTimeToken(today[1]);
    const dt = DateTime.fromFormat(
      `${parts.y}-${pad2(parts.m)}-${pad2(parts.d)} ${t}`,
      "yyyy-LL-dd h:mm a",
      { zone: TZ, locale: "en" },
    );
    if (dt.isValid) return dt;
  }

  // "Tuesday, April 21, 2026 @ 5:00 pm"
  const long = when.match(
    /[A-Za-z]+,\s*([A-Za-z]+\s+\d{1,2},\s+\d{4})\s+@\s*(\d{1,2}:\d{2}\s*(?:am|pm)|\d{1,2}\s*(?:am|pm))/i,
  );
  if (long) {
    const piece = `${long[1]} ${normalizeNyplTimeToken(long[2])}`;
    const dt = DateTime.fromFormat(piece, "LLLL d, yyyy h:mm a", { zone: TZ, locale: "en" });
    if (dt.isValid) return dt;
    const dt2 = DateTime.fromFormat(piece, "LLL d, yyyy h:mm a", { zone: TZ, locale: "en" });
    if (dt2.isValid) return dt2;
  }

  return base.set({ hour: 12, minute: 0, second: 0, millisecond: 0 });
}

export async function fetchNyplLiteraryRowsForMonth(
  year: number,
  monthIndex: number,
  signal?: AbortSignal,
): Promise<{ rows: NyplRawRow[]; meta: NyplParseMeta }> {
  const html = await fetchHtmlCandidates(year, monthIndex, signal);
  const parsed = parseRowsFromCalendarHtml(html);
  const inMonth = parsed.filter((r) => {
    const p = datePartsFromPath(r.programPath);
    if (!p) return false;
    return p.y === year && p.m === monthIndex + 1;
  });
  const literary = inMonth.filter(isNyplLiteraryRow);
  return {
    rows: literary,
    meta: {
      rowsParsed: parsed.length,
      rowsAfterLiteraryFilter: literary.length,
    },
  };
}
