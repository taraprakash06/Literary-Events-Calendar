import { DateTime } from "luxon";
import type {
  EventFormat,
  WorkshopEvent,
  WorkshopEventCategory,
} from "@/lib/workshop-types";

const LAPL_ORIGIN = "https://www.lapl.org";

export type LaplParseMeta = {
  pagesFetched: number;
  rowsParsed: number;
  rowsAfterLiteraryFilter: number;
};

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function buildCalendarUrl(year: number, monthIndex: number, page: number): string {
  void year;
  void monthIndex;
  const u = new URL(`${LAPL_ORIGIN}/whats-on/calendar`);
  u.searchParams.set("items_per_page", "100");
  if (page > 0) u.searchParams.set("page", String(page));
  return u.toString();
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

function stripTags(html: string): string {
  return decodeHtmlEntities(
    html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(),
  );
}

function extractCalendarTbody(html: string): string | null {
  const marker = "view-id-whats_on_upcoming_calendar";
  const idx = html.indexOf(marker);
  if (idx === -1) return null;
  const slice = html.slice(idx, idx + 400000);
  const tb = slice.indexOf("<tbody>");
  const te = slice.indexOf("</tbody>", tb);
  if (tb === -1 || te === -1) return null;
  return slice.slice(tb + "<tbody>".length, te);
}

function hasNextCalendarPage(html: string): boolean {
  return /pager-next/i.test(html) && /Go to next page|next\s+›/i.test(html);
}

type LaplRawRow = {
  dateLine: string;
  timeStart?: string;
  timeEnd?: string;
  eventPath: string;
  title: string;
  description: string;
  branchTd: string;
  categoryTd: string;
};

function parseRowsFromTbody(tbody: string): LaplRawRow[] {
  const rows: LaplRawRow[] = [];
  const re = /<tr class="(?:odd|even)[^"]*"[^>]*>([\s\S]*?)<\/tr>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(tbody))) {
    const tr = m[1];
    const tds = [...tr.matchAll(/<td class="([^"]*)"[^>]*>([\s\S]*?)<\/td>/gi)];
    if (tds.length < 5) continue;

    const dateCell = tds[0][2];
    const bodyCell = tds[1][2];
    const branchCell = tds[2][2];
    const categoryCell = tds[4][2];

    const dateLineMatch = dateCell.match(
      /date-display-single">\s*([^<]+?)\s*<\/span>/i,
    );
    const dateLine = dateLineMatch?.[1]?.trim();
    if (!dateLine) continue;

    const timeStart = dateCell.match(
      /date-display-start">\s*([^<]+?)\s*<\/span>/i,
    )?.[1];
    const timeEnd = dateCell.match(/date-display-end">\s*([^<]+?)\s*<\/span>/i)?.[1];

    const linkMatch = bodyCell.match(
      /<a href="(\/whats-on\/events\/[^"]+)"[^>]*>([^<]*)<\/a>/i,
    );
    if (!linkMatch) continue;
    const eventPath = linkMatch[1].trim();
    const title = decodeHtmlEntities(linkMatch[2].trim());
    if (!title) continue;

    const afterLink = bodyCell.slice(bodyCell.indexOf(linkMatch[0]) + linkMatch[0].length);
    const descPart = afterLink.replace(/^\s*<br\s*\/?>\s*/i, "").trim();
    const description = stripTags(descPart).slice(0, 1200);

    rows.push({
      dateLine,
      timeStart: timeStart?.trim(),
      timeEnd: timeEnd?.trim(),
      eventPath,
      title,
      description,
      branchTd: branchCell,
      categoryTd: categoryCell,
    });
  }
  return rows;
}

function categoryLabels(categoryTd: string): string[] {
  const labels: string[] = [];
  const re = /<a[^>]+>([^<]*)<\/a>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(categoryTd))) {
    const t = decodeHtmlEntities(m[1]).trim();
    if (t) labels.push(t);
  }
  return labels;
}

function parseBranch(
  branchTd: string,
): { venue: string; format: EventFormat; virtualLabel?: string } {
  const onlineItalic = /<i>\s*Online\s*<\/i>/i.test(branchTd);
  const venue = stripTags(branchTd);
  if (onlineItalic && /library|branch|central|regional/i.test(venue)) {
    return {
      venue,
      format: "hybrid",
      virtualLabel: "Hybrid (online + branch)",
    };
  }
  if (onlineItalic || /^online\b/i.test(venue)) {
    return { venue: venue || "Online", format: "virtual", virtualLabel: "Online (LAPL)" };
  }
  return { venue: venue || "Los Angeles Public Library", format: "in-person" };
}

function inferCategory(
  cats: string[],
  title: string,
  description: string,
): WorkshopEventCategory {
  const catHay = cats.join(" ").toLowerCase();
  const blob = `${title}\n${description}`.toLowerCase();

  if (catHay.includes("book clubs") || /\bbook club\b/.test(blob)) return "book-club";
  if (catHay.includes("writing") || /\b(creative writing|writing workshop|writers)\b/.test(blob))
    return "workshop";
  if (
    catHay.includes("authors") ||
    /\b(author talk|author reading|meet the author|poetry|spoken word|aloud)\b/.test(blob)
  ) {
    return "reading";
  }
  if (catHay.includes("music & performances") && /\b(poetry|spoken word|reading)\b/.test(blob)) {
    return "reading";
  }
  if (/\b(panel|conversation)\b/.test(blob)) return "panel";
  if (/\b(festival)\b/.test(blob)) return "festival";
  if (/\b(book launch|launch party)\b/.test(blob)) return "launch";
  if (/\bopen mic\b/.test(blob)) return "open-mic";
  return "other";
}

function isLaplLiteraryRow(row: LaplRawRow, cats: string[]): boolean {
  const catHay = cats.join(" ").toLowerCase();
  const blob = `${row.title}\n${row.description}`.toLowerCase();

  const allowedCategory =
    catHay.includes("authors") ||
    catHay.includes("book clubs") ||
    catHay.includes("writing") ||
    (catHay.includes("music & performances") &&
      /\b(poetry|spoken word|reading|literary)\b/.test(blob));

  const keywordOverride =
    /\b(book club|author talk|author reading|creative writing|writing workshop|writers group|poetry|spoken word|memoir|fiction workshop|literary|novel craft|zine)\b/i.test(
      blob,
    );

  if (!allowedCategory && !keywordOverride) return false;

  const excludeBlob = `${catHay}\n${blob}`;
  if (
    /\b(storytime|story time|toddler time|baby bounce|preschool|kids club|homework help|student zone|tax preparation|tax-aide|income tax|yoga|meditation|mahjong|chess|gaming|resume|job fair)\b/i.test(
      excludeBlob,
    )
  ) {
    if (!keywordOverride) return false;
  }

  if (catHay.includes("storytimes") && !keywordOverride) return false;

  return true;
}

function parseLaDateTime(dateLine: string, timePart: string | undefined): DateTime | null {
  const t = (timePart ?? "").trim();
  if (!t) {
    const d = DateTime.fromFormat(dateLine.trim(), "EEE, MMM d, yyyy", {
      locale: "en",
      zone: "America/Los_Angeles",
    });
    return d.isValid ? d.set({ hour: 12, minute: 0, second: 0, millisecond: 0 }) : null;
  }
  const dt = DateTime.fromFormat(`${dateLine.trim()} ${t}`, "EEE, MMM d, yyyy h:mm a", {
    locale: "en",
    zone: "America/Los_Angeles",
  });
  return dt.isValid ? dt : null;
}

function slugFromPath(path: string): string {
  return path.replace(/^\/whats-on\/events\//, "").replace(/[^\w-]+/g, "-");
}

function monthEndLa(year: number, monthIndex: number): DateTime {
  return DateTime.fromObject(
    { year, month: monthIndex + 1, day: 1 },
    { zone: "America/Los_Angeles" },
  )
    .endOf("month")
    .set({ hour: 23, minute: 59, second: 59, millisecond: 999 });
}

export function mapLaplRowToWorkshop(row: LaplRawRow): WorkshopEvent | null {
  const cats = categoryLabels(row.categoryTd);
  if (!isLaplLiteraryRow(row, cats)) return null;

  const start = parseLaDateTime(row.dateLine, row.timeStart);
  if (!start) return null;

  let endIso: string | undefined;
  if (row.timeEnd) {
    const end = parseLaDateTime(row.dateLine, row.timeEnd);
    if (end && end > start) {
      endIso = end.toUTC().toISO() ?? undefined;
    }
  }

  const { venue, format, virtualLabel } = parseBranch(row.branchTd);
  const neighborhood = venue.includes("Branch") ? venue.replace(/\s*Branch Library/i, "").trim() : undefined;

  const category = inferCategory(cats, row.title, row.description);
  const rsvpUrl = `${LAPL_ORIGIN}${row.eventPath}`;

  return {
    id: `lapl-${slugFromPath(row.eventPath)}-${start.toFormat("yyyyLLddHHmm")}`,
    cityId: "la",
    title: row.title,
    tagline: cats.slice(0, 3).join(" · "),
    description:
      row.description ||
      "Program details on the Los Angeles Public Library website.",
    start: start.toUTC().toISO() ?? start.toISO() ?? "",
    end: endIso,
    timeZone: "America/Los_Angeles",
    format,
    price: "free",
    category,
    organizer: "Los Angeles Public Library",
    venue,
    neighborhood: neighborhood && neighborhood.length > 0 ? neighborhood : undefined,
    virtualLabel,
    rsvpUrl,
    source: "Los Angeles Public Library — Events calendar",
    sourceChannel: "library",
    listingProvenance: "live",
  };
}

export async function fetchLaplLiteraryEventsForMonth(
  year: number,
  monthIndex: number,
): Promise<{ events: WorkshopEvent[]; meta: LaplParseMeta }> {
  const headers = { "User-Agent": "LiteraryEventsCalendar/1.0 (educational; contact repo owner)" };
  let page = 0;
  const seen = new Set<string>();
  const events: WorkshopEvent[] = [];
  let rowsParsed = 0;
  let pagesFetched = 0;
  const endOfTarget = monthEndLa(year, monthIndex);

  for (; page < 12; page++) {
    const url = buildCalendarUrl(year, monthIndex, page);
    const res = await fetch(url, { headers, cache: "no-store" });
    if (!res.ok) break;
    const html = await res.text();
    pagesFetched += 1;

    const tbody = extractCalendarTbody(html);
    if (!tbody) break;

    const rows = parseRowsFromTbody(tbody);
    rowsParsed += rows.length;
    let maxRowDt: DateTime | null = null;
    for (const row of rows) {
      const dt = parseLaDateTime(row.dateLine, row.timeStart);
      if (dt && (maxRowDt === null || dt > maxRowDt)) maxRowDt = dt;
      const key = row.eventPath;
      if (seen.has(key)) continue;
      seen.add(key);
      const mapped = mapLaplRowToWorkshop(row);
      if (mapped) events.push(mapped);
    }

    if (!hasNextCalendarPage(html)) break;
    if (rows.length === 0) break;

    const inMonthSoFar = events.some((e) => {
      const dt = DateTime.fromISO(e.start, { zone: "utc" }).setZone(
        "America/Los_Angeles",
      );
      return dt.isValid && dt.year === year && dt.month === monthIndex + 1;
    });
    if (inMonthSoFar && maxRowDt && maxRowDt > endOfTarget.plus({ days: 7 })) {
      break;
    }
  }

  events.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
  const inMonth = events.filter((e) => {
    const dt = DateTime.fromISO(e.start, { zone: "utc" }).setZone(
      "America/Los_Angeles",
    );
    return dt.isValid && dt.year === year && dt.month === monthIndex + 1;
  });

  return {
    events: inMonth,
    meta: {
      pagesFetched,
      rowsParsed,
      rowsAfterLiteraryFilter: inMonth.length,
    },
  };
}
