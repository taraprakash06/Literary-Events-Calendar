import { DateTime } from "luxon";
import type { EventFormat, WorkshopEvent, WorkshopEventCategory } from "@/lib/workshop-types";

const ORIGIN = "https://www.92ny.org";
const SOURCE_URL =
  "https://www.92ny.org/whats-on/events?hierarchicalMenu%5BEventMenu.lvl0%5D%5B0%5D=Literary%20Readings";
const TZ = "America/New_York";

export type Ny92ParseMeta = {
  pageFetched: boolean;
  rowsParsed: number;
  rowsInMonth: number;
  blockedByIncapsula?: boolean;
};

function isIncapsula(html: string): boolean {
  return (
    html.includes("_Incapsula_Resource") ||
    /Incapsula incident ID/i.test(html) ||
    /Request unsuccessful/i.test(html)
  );
}

function mapCategory(title: string): WorkshopEventCategory {
  const b = title.toLowerCase();
  if (/\bworkshop|writing\b/.test(b)) return "workshop";
  if (/\bpanel|conversation|talk\b/.test(b)) return "other";
  if (/\blaunch\b/.test(b)) return "reading";
  return "reading";
}

function stableId(url: string, start: DateTime): string {
  const slug = url
    .replace(ORIGIN, "")
    .replace(/^\/+/, "")
    .replace(/\/+$/, "")
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/-+/g, "-")
    .toLowerCase();
  return `92ny-${slug}-${start.toFormat("yyyyLLddHHmm")}`;
}

function parseMonthFromText(s: string): { month: number; day: number } | null {
  // Example fragments often include "Apr 21" or "April 21"
  const m = s.match(/\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\s+(\d{1,2})\b/i);
  if (!m) return null;
  const monthToken = m[1].toLowerCase();
  const day = Number(m[2]);
  const months: Record<string, number> = {
    jan: 1,
    feb: 2,
    mar: 3,
    apr: 4,
    may: 5,
    jun: 6,
    jul: 7,
    aug: 8,
    sep: 9,
    sept: 9,
    oct: 10,
    nov: 11,
    dec: 12,
  };
  const month = months[monthToken];
  if (!month || !Number.isFinite(day)) return null;
  return { month, day };
}

function parseTimeFromText(s: string): { hour: number; minute: number } | null {
  const m = s.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i);
  if (!m) return null;
  let hour = Number(m[1]);
  const minute = Number(m[2] ?? "0");
  const mer = m[3].toLowerCase();
  if (mer === "pm" && hour !== 12) hour += 12;
  if (mer === "am" && hour === 12) hour = 0;
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;
  return { hour, minute };
}

type Ny92Row = {
  title: string;
  url: string;
  dateText: string;
  locationText: string;
};

function parseRowsFromHtml(html: string): Ny92Row[] {
  // We can’t reliably fetch this page from all servers (Incapsula).
  // When it is fetchable, it tends to include normal <a href="/event/..."> links.
  const rows: Ny92Row[] = [];
  const re = /<a\b[^>]*href="(\/[^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const href = m[1];
    if (!href || !/^\/(event|whats-on)\//i.test(href)) continue;
    const title = m[2].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    if (!title || title.length < 8) continue;

    // Try to find a nearby date/time/location chunk.
    const window = html.slice(m.index, m.index + 1200).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
    const dateText =
      window.match(/\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\s+\d{1,2}[^.]{0,40}\b/i)?.[0] ??
      "";
    const locationText = window.match(/\b(92NY|Lexington Avenue|New York, NY)\b[^.]{0,80}/i)?.[0] ?? "";

    rows.push({
      title,
      url: href.startsWith("http") ? href : `${ORIGIN}${href}`,
      dateText,
      locationText,
    });
  }
  // De-dupe by url
  const seen = new Set<string>();
  return rows.filter((r) => {
    if (seen.has(r.url)) return false;
    seen.add(r.url);
    return true;
  });
}

export async function fetch92nyLiteraryReadingsForMonth(
  year: number,
  monthIndex: number,
  signal?: AbortSignal,
): Promise<{ events: WorkshopEvent[]; meta: Ny92ParseMeta }> {
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
  const html = await res.text();
  if (!res.ok) throw new Error(`92NY page HTTP ${res.status}`);
  if (isIncapsula(html)) {
    return {
      events: [],
      meta: { pageFetched: true, rowsParsed: 0, rowsInMonth: 0, blockedByIncapsula: true },
    };
  }

  const rows = parseRowsFromHtml(html);
  const mapped: WorkshopEvent[] = rows
    .map((r): WorkshopEvent | null => {
      const md = parseMonthFromText(r.dateText || r.title);
      if (!md) return null;
      const time = parseTimeFromText(r.dateText || r.title) ?? { hour: 19, minute: 0 };
      const start = DateTime.fromObject(
        { year, month: md.month, day: md.day, hour: time.hour, minute: time.minute },
        { zone: TZ },
      );
      if (!start.isValid) return null;

      const end = start.plus({ hours: 1 });
      const category = mapCategory(r.title);
      const format: EventFormat = /remote|online|zoom/i.test(`${r.title} ${r.locationText}`)
        ? "virtual"
        : "in-person";

      const ev: WorkshopEvent = {
        id: stableId(r.url, start),
        cityId: "nyc",
        title: r.title,
        tagline: r.locationText || "92NY",
        description: r.title,
        start: start.toISO() ?? start.toString(),
        end: end.toISO() ?? undefined,
        timeZone: TZ,
        format,
        price: "unknown",
        category,
        organizer: "92NY",
        venue: format === "virtual" ? undefined : "92NY",
        rsvpUrl: r.url,
        source: "92NY (92ny.org)",
        sourceChannel: "literary_org",
        listingProvenance: "live",
      };
      return ev;
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

