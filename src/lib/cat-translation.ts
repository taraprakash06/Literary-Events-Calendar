import { DateTime } from "luxon";
import type { EventFormat, WorkshopEvent, WorkshopEventCategory } from "@/lib/workshop-types";
import { decodeHtmlEntities, stripHtmlAndDecode, toShortOverview } from "@/lib/text";

const ORIGIN = "https://www.catranslation.org";
const EVENTS_URL = `${ORIGIN}/events/`;
const TZ = "America/Los_Angeles";

export type CatParseMeta = {
  pageFetched: boolean;
  rowsParsed: number;
  rowsInMonth: number;
};

type RawRow = {
  dateLine: string;
  title: string;
  url: string;
  description: string;
  locationBlock: string;
  programLine: string;
};

function htmlToTextLines(html: string): string[] {
  const withBreaks = html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|h1|h2|h3|h4|h5|h6|section|article)>/gi, "\n")
    .replace(/<li\b[^>]*>/gi, "\n");
  const withoutTags = withBreaks.replace(/<[^>]+>/g, " ");
  const decoded = decodeHtmlEntities(withoutTags);
  return decoded
    .replace(/\r/g, "")
    .split("\n")
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

function extractEventLinks(html: string): Array<{ title: string; url: string }> {
  const out: Array<{ title: string; url: string }> = [];
  const re = /<a\b[^>]*href="((?:https?:\/\/www\.)?catranslation\.org\/event\/[^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const href = m[1];
    const title = stripHtmlAndDecode(m[2]);
    if (!href || !title) continue;
    const url = href.startsWith("http") ? href : `https://${href.replace(/^\/+/, "")}`;
    out.push({ title, url });
  }
  const seen = new Set<string>();
  return out.filter((x) => {
    if (seen.has(x.url)) return false;
    seen.add(x.url);
    return true;
  });
}

function stableId(url: string, start: DateTime): string {
  const slug = url
    .replace(ORIGIN, "")
    .replace(/^\/+/, "")
    .replace(/\/+$/, "")
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/-+/g, "-")
    .toLowerCase();
  return `cat-${slug}-${start.toFormat("yyyyLLddHHmm")}`;
}

function mapCategory(title: string, program: string): WorkshopEventCategory {
  const b = `${title}\n${program}`.toLowerCase();
  if (/\bworkshop|class\b/.test(b)) return "workshop";
  if (/\bpanel|in conversation|talk\b/.test(b)) return "panel";
  if (/\blaunch\b|book tour/.test(b)) return "launch";
  return "reading";
}

function mapFormat(locationBlock: string): { format: EventFormat; virtualLabel?: string } {
  const b = locationBlock.toLowerCase();
  if (/\bzoom\b|\bonline\b|\bvirtual\b/.test(b)) return { format: "virtual", virtualLabel: "Online" };
  return { format: "in-person" };
}

function includesSanFrancisco(locationBlock: string): boolean {
  const b = locationBlock.toLowerCase();
  return /\bsan francisco,\s*ca\b/.test(b) || /\b599 valencia\b/i.test(locationBlock);
}

function parseDateLineToStartEnd(dateLine: string, year: number): { start: DateTime; end?: DateTime } | null {
  const s = dateLine.replace(/\s+/g, " ").trim();

  // "Apr 29, 2026|6:00–8:00 pm"
  const withTime = s.match(
    /\b([A-Za-z]{3,9})\s+(\d{1,2}),\s*(\d{4})\s*\|\s*(\d{1,2}:\d{2})\s*[–-]\s*(\d{1,2}:\d{2})\s*(am|pm)\b/i,
  );
  if (withTime) {
    const monthName = withTime[1];
    const day = Number(withTime[2]);
    const y = Number(withTime[3]);
    const startTime = withTime[4];
    const endTime = withTime[5];
    const mer = withTime[6].toUpperCase();

    const start = DateTime.fromFormat(
      `${monthName} ${day}, ${y} ${startTime} ${mer}`,
      "LLL d, yyyy h:mm a",
      { zone: TZ, locale: "en" },
    );
    if (!start.isValid) {
      const start2 = DateTime.fromFormat(
        `${monthName} ${day}, ${y} ${startTime} ${mer}`,
        "LLLL d, yyyy h:mm a",
        { zone: TZ, locale: "en" },
      );
      if (!start2.isValid) return null;
      const end = DateTime.fromFormat(
        `${monthName} ${day}, ${y} ${endTime} ${mer}`,
        "LLLL d, yyyy h:mm a",
        { zone: TZ, locale: "en" },
      );
      return { start: start2, end: end.isValid ? end : start2.plus({ hours: 2 }) };
    }
    const end = DateTime.fromFormat(
      `${monthName} ${day}, ${y} ${endTime} ${mer}`,
      "LLL d, yyyy h:mm a",
      { zone: TZ, locale: "en" },
    );
    return { start, end: end.isValid ? end : start.plus({ hours: 2 }) };
  }

  // "Apr 21–24, 2026" or "Apr 21-24, 2026"
  const range = s.match(/\b([A-Za-z]{3,9})\s+(\d{1,2})\s*[–-]\s*(\d{1,2}),\s*(\d{4})\b/);
  if (range) {
    const monthName = range[1];
    const d1 = Number(range[2]);
    const d2 = Number(range[3]);
    const y = Number(range[4]);
    const start = DateTime.fromFormat(`${monthName} ${d1}, ${y} 12:00 PM`, "LLL d, yyyy h:mm a", {
      zone: TZ,
      locale: "en",
    });
    if (!start.isValid) return null;
    const end = DateTime.fromFormat(`${monthName} ${d2}, ${y} 5:00 PM`, "LLL d, yyyy h:mm a", {
      zone: TZ,
      locale: "en",
    });
    return { start, end: end.isValid ? end : undefined };
  }

  // "Apr 29, 2026"
  const single = s.match(/\b([A-Za-z]{3,9})\s+(\d{1,2}),\s*(\d{4})\b/);
  if (single) {
    const monthName = single[1];
    const day = Number(single[2]);
    const y = Number(single[3]) || year;
    const start = DateTime.fromFormat(`${monthName} ${day}, ${y} 7:00 PM`, "LLL d, yyyy h:mm a", {
      zone: TZ,
      locale: "en",
    });
    if (!start.isValid) return null;
    return { start, end: start.plus({ hours: 1 }) };
  }

  return null;
}

function parseRowsFromHtml(html: string): RawRow[] {
  const links = extractEventLinks(html);
  const lines = htmlToTextLines(html);

  const rows: RawRow[] = [];
  const byTitle = new Map(links.map((l) => [l.title, l.url] as const));
  const titles = new Set(byTitle.keys());

  const isDateLine = (s: string) =>
    /\b20\d{2}\b/.test(s) && /\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)\b/i.test(s);

  for (let i = 0; i < lines.length; i++) {
    const titleLine = lines[i];
    if (!titles.has(titleLine)) continue;

    // Find nearest date line above this title.
    let dateLine = "";
    for (let k = i - 1; k >= 0 && k >= i - 4; k--) {
      if (isDateLine(lines[k])) {
        dateLine = lines[k];
        break;
      }
    }
    if (!dateLine) continue;

    const url = byTitle.get(titleLine);
    if (!url) continue;

    const description = lines[i + 1] ?? "";
    const locationLines: string[] = [];
    for (let j = i + 2; j < Math.min(lines.length, i + 12); j++) {
      const l = lines[j];
      if (/^View all of our past events/i.test(l)) break;
      if (isDateLine(l)) break;
      locationLines.push(l);
    }
    const locationBlock = locationLines.join(" · ");
    const programLine = locationLines.find((l) => /Two Lines Press/i.test(l)) ?? "";
    rows.push({ dateLine, title: titleLine, url, description, locationBlock, programLine });
  }

  const seen = new Set<string>();
  return rows.filter((r) => (seen.has(r.url) ? false : (seen.add(r.url), true)));
}

export async function fetchCatEventsForMonth(
  year: number,
  monthIndex: number,
  signal?: AbortSignal,
): Promise<{ events: WorkshopEvent[]; meta: CatParseMeta }> {
  const ua =
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

  const res = await fetch(EVENTS_URL, {
    signal,
    headers: {
      Accept: "text/html,application/xhtml+xml",
      "Accept-Language": "en-US,en;q=0.9",
      "User-Agent": ua,
      Referer: ORIGIN,
    },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`CAT events HTTP ${res.status}`);
  const html = await res.text();
  const rows = parseRowsFromHtml(html);

  const mapped = rows
    .map((r): WorkshopEvent | null => {
      // Only include SF-relevant rows.
      if (!includesSanFrancisco(r.locationBlock) && !/Multiple Cities/i.test(r.locationBlock)) return null;
      if (/Multiple Cities/i.test(r.locationBlock) && !/San Francisco,\s*CA/i.test(r.locationBlock)) return null;

      const dt = parseDateLineToStartEnd(r.dateLine, year);
      if (!dt) return null;

      const { format, virtualLabel } = mapFormat(r.locationBlock);
      const category = mapCategory(r.title, r.programLine);

      let venue: string | undefined = undefined;
      let address: string | undefined = undefined;
      if (format !== "virtual") {
        const locLine =
          r.locationBlock.split(" · ").find((l) => /San Francisco,\s*CA/i.test(l)) ??
          r.locationBlock;
        const m = locLine.match(/^([^,]+),\s*(.+San Francisco,\s*CA.*)$/i);
        if (m) {
          venue = m[1].trim();
          address = m[2].trim();
        } else {
          venue = "Center for the Art of Translation";
          address = /San Francisco,\s*CA/i.test(locLine) ? locLine.trim() : "San Francisco, CA";
        }
      }

      const start = dt.start;
      const end = dt.end;
      const desc = toShortOverview(r.description, 700) || r.description || r.title;

      return {
        id: stableId(r.url, start),
        cityId: "sf",
        title: r.title,
        tagline: venue ?? "Center for the Art of Translation",
        description: desc,
        start: start.toISO() ?? start.toString(),
        end: end?.toISO() ?? undefined,
        timeZone: TZ,
        format,
        price: "unknown",
        category,
        organizer: "Center for the Art of Translation",
        venue,
        address,
        virtualLabel,
        rsvpUrl: r.url,
        source: "CAT (catranslation.org)",
        sourceChannel: "literary_org",
        listingProvenance: "live",
      };
    })
    .filter((e): e is WorkshopEvent => e != null)
    .filter((e) => {
      const dt = DateTime.fromISO(e.start, { zone: TZ });
      return dt.isValid && dt.year === year && dt.month === monthIndex + 1;
    });

  return {
    events: mapped,
    meta: { pageFetched: true, rowsParsed: rows.length, rowsInMonth: mapped.length },
  };
}

