import { DateTime } from "luxon";
import type { WorkshopEvent, WorkshopEventCategory } from "@/lib/workshop-types";
import { decodeHtmlEntities, stripHtmlAndDecode, toShortOverview } from "@/lib/text";

const SOURCE_URL = "https://losangelesliterature.com/annual-events/";
const TZ = "America/Los_Angeles";

export type LaLiteratureAnnualMeta = {
  pageFetched: boolean;
  rowsParsed: number;
  rowsInMonth: number;
  skipped: number;
};

type AnnualRow = {
  name: string;
  about: string;
  where: string;
  when: string;
  time: string;
  admission: string;
  website: string;
};

function cleanText(s: string): string {
  return decodeHtmlEntities(s).replace(/\s+/g, " ").trim();
}

function normalizeWhere(where: string): { venue?: string; address?: string; neighborhood?: string } {
  const w = cleanText(where);
  if (!w) return {};
  // Usually "Venue, City" — keep as venue and optionally set neighborhood for LA-ish things.
  const venue = w;
  const neighborhood =
    /\bPasadena\b/i.test(w) ? "Pasadena" :
    /\bAltadena\b/i.test(w) ? "Altadena" :
    /\bCulver City\b/i.test(w) ? "Culver City" :
    /\bLincoln Heights\b/i.test(w) ? "Lincoln Heights" :
    undefined;
  return { venue, address: undefined, neighborhood };
}

function inferCategory(name: string, about: string): WorkshopEventCategory {
  const b = `${name}\n${about}`.toLowerCase();
  if (/\b(zine)\b/.test(b)) return "festival";
  if (/\b(book festival|book fair|litfest|literary festival|festival)\b/.test(b)) return "festival";
  if (/\b(conference|writers conference)\b/.test(b)) return "festival";
  if (/\b(workshop|retreat)\b/.test(b)) return "workshop";
  if (/\b(panel|conversation|talk)\b/.test(b)) return "panel";
  if (/\bpoetry\b/.test(b)) return "reading";
  return "other";
}

function monthIndexFromWhen(whenRaw: string): number | null {
  const w = cleanText(whenRaw).toLowerCase();
  if (!w || w === "tba") return null;
  const months: Record<string, number> = {
    january: 0,
    february: 1,
    march: 2,
    april: 3,
    may: 4,
    june: 5,
    july: 6,
    august: 7,
    september: 8,
    october: 9,
    november: 10,
    december: 11,
  };
  for (const [m, idx] of Object.entries(months)) {
    if (w.includes(m)) return idx;
  }
  if (w.includes("first quarter")) return 1; // approx: February
  if (w.includes("first half of may")) return 4;
  return null;
}

function approximateDayFromWhen(whenRaw: string): number {
  const w = cleanText(whenRaw).toLowerCase();
  if (w.includes("first") && w.includes("half")) return 8;
  if (w.includes("mid-") || w.includes("mid ")) return 15;
  if (w.includes("end of")) return 24;
  if (w.includes("first quarter")) return 15;
  // Default: mid-month so it’s visible but not pretending to be exact.
  return 15;
}

function stableId(name: string, year: number, monthIndex: number): string {
  const slug = name
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 70);
  return `la-lit-annual-${slug}-${year}${String(monthIndex + 1).padStart(2, "0")}`;
}

function extractAnnualRows(html: string): AnnualRow[] {
  const text = stripHtmlAndDecode(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " "),
  );

  const body = (() => {
    const afterIntro = text
      .split("Check them out and dive into the literature.")
      .slice(1)
      .join(" ");
    return (afterIntro.split("Share this:")[0] ?? afterIntro).trim();
  })();

  // Force field labels onto their own "lines" so we can parse robustly.
  const labeled = body.replace(
    /\b(About|Where|When|Time|Admission[^:]*|Website)\s*:\s*/gi,
    "\n$1: ",
  );
  const lines = labeled
    .split("\n")
    .map((l) => cleanText(l))
    .filter(Boolean);

  const rows: AnnualRow[] = [];
  let cur: Partial<AnnualRow> = {};

  const flush = () => {
    const name = cleanText(cur.name ?? "");
    const website = cleanText(cur.website ?? "");
    const about = cleanText(cur.about ?? "");
    const where = cleanText(cur.where ?? "");
    const when = cleanText(cur.when ?? "");
    const time = cleanText(cur.time ?? "");
    const admission = cleanText(cur.admission ?? "");

    if (!name || name.length < 3) return;
    if (!website || !/^https?:\/\//i.test(website)) return;

    rows.push({
      name,
      about,
      where,
      when,
      time,
      admission,
      website,
    });
    cur = {};
  };

  for (const l of lines) {
    const m = l.match(
      /^(About|Where|When|Time|Website|Admission[^:]*):\s*(.*)$/i,
    );
    if (!m) {
      // Likely a title line. Titles on this page are short-ish and don't include field labels.
      // If we already have a website, flush and start a new row.
      if (cur.website) flush();
      if (!cur.name && l.length <= 120) cur.name = l;
      continue;
    }
    const key = m[1].toLowerCase();
    const value = m[2] ?? "";
    if (key === "about") cur.about = value;
    else if (key === "where") cur.where = value;
    else if (key === "when") cur.when = value;
    else if (key === "time") cur.time = value;
    else if (key.startsWith("admission")) cur.admission = value;
    else if (key === "website") {
      const url = value.split(/\s+/)[0] ?? value;
      const rest = value.slice(url.length).trim();
      cur.website = url;
      flush();
      if (rest && rest.length <= 140) {
        cur.name = rest;
      }
    }
  }
  flush();

  const seen = new Set<string>();
  return rows.filter((r) => {
    const k = r.name.toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

export async function fetchLaLiteratureAnnualEventsForMonth(
  year: number,
  monthIndex: number,
  signal?: AbortSignal,
): Promise<{ events: WorkshopEvent[]; meta: LaLiteratureAnnualMeta }> {
  const res = await fetch(SOURCE_URL, {
    signal,
    headers: { "User-Agent": "LiteraryEventsCalendar/1.0 (educational; contact repo owner)" },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`LA Literature annual events HTTP ${res.status}`);
  const html = await res.text();

  const rows = extractAnnualRows(html);
  let skipped = 0;

  const events: WorkshopEvent[] = [];
  for (const r of rows) {
    const m = monthIndexFromWhen(r.when);
    if (m === null) {
      skipped += 1;
      continue;
    }
    if (m !== monthIndex) continue;

    const day = approximateDayFromWhen(r.when);
    const start = DateTime.fromObject(
      { year, month: monthIndex + 1, day, hour: 12, minute: 0 },
      { zone: TZ },
    );
    if (!start.isValid) continue;

    const { venue, address, neighborhood } = normalizeWhere(r.where);
    const description = [
      toShortOverview(r.about, 520),
      r.where ? `Where: ${cleanText(r.where)}` : "",
      r.when ? `When: ${cleanText(r.when)} (annual; exact date varies)` : "",
      r.time ? `Time: ${cleanText(r.time)}` : "",
      r.admission ? `Admission: ${cleanText(r.admission)}` : "",
    ]
      .filter(Boolean)
      .join("\n");

    events.push({
      id: stableId(r.name, year, monthIndex),
      cityId: "la",
      title: r.name,
      tagline: "Annual event (date varies) — see site",
      description,
      start: start.toISO() ?? start.toString(),
      end: start.plus({ hours: 8 }).toISO() ?? undefined,
      timeZone: TZ,
      format: "in-person",
      price: /free/i.test(r.admission) ? "free" : "unknown",
      category: inferCategory(r.name, r.about),
      organizer: "Los Angeles Literature (directory)",
      venue,
      address,
      neighborhood,
      rsvpUrl: r.website || SOURCE_URL,
      source: "Los Angeles Literature — Annual Events index",
      sourceChannel: "news_roundup",
      listingProvenance: "live",
    });
  }

  events.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());

  return {
    events,
    meta: {
      pageFetched: true,
      rowsParsed: rows.length,
      rowsInMonth: events.length,
      skipped,
    },
  };
}

