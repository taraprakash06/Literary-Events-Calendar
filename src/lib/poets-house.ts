import { DateTime } from "luxon";
import type { EventFormat, WorkshopEvent, WorkshopEventCategory } from "@/lib/workshop-types";
import { stripHtmlAndDecode, toShortOverview } from "@/lib/text";
import { parseIcsEvents } from "@/lib/ics";

const ORIGIN = "https://poetshouse.org";
const PROGRAMS_URL = `${ORIGIN}/programs-events/`;
const TZ = "America/New_York";

export type PoetsHouseParseMeta = {
  pageFetched: boolean;
  usedIcs?: boolean;
  cardsFound: number;
  cardsParsed: number;
  rowsInMonth: number;
};

type RawCard = {
  title: string;
  href?: string;
  blurb: string;
};

function mapCategory(title: string): WorkshopEventCategory {
  const b = title.toLowerCase();
  if (/\bworkshop|class\b/.test(b)) return "workshop";
  if (/\bpanel|talk|conversation|seminar\b/.test(b)) return "panel";
  if (/\blaunch\b/.test(b)) return "launch";
  if (/\bread|reading\b/.test(b)) return "reading";
  return "reading";
}

function mapFormat(title: string, blurb: string): EventFormat {
  const b = `${title}\n${blurb}`.toLowerCase();
  if (/\bremote\b|\bonline\b|\bzoom\b/.test(b)) return "virtual";
  return "in-person";
}

function stableId(href: string | undefined, title: string, start: DateTime): string {
  const key =
    (href ?? title)
      .replace(ORIGIN, "")
      .replace(/^\/+/, "")
      .replace(/\/+$/, "")
      .replace(/[^a-z0-9]+/gi, "-")
      .replace(/-+/g, "-")
      .toLowerCase() || "poetshouse";
  return `ph-${key}-${start.toFormat("yyyyLLddHHmm")}`;
}

function parseStartFromBlurb(year: number, blurb: string): DateTime | null {
  // Examples seen on page: "4/25: ..." or "5/6: ..."
  const m = blurb.match(/\b(\d{1,2})\/(\d{1,2})\b/);
  if (!m) return null;
  const month = Number(m[1]);
  const day = Number(m[2]);
  if (!Number.isFinite(month) || !Number.isFinite(day) || month < 1 || month > 12 || day < 1 || day > 31)
    return null;
  const dt = DateTime.fromObject({ year, month, day, hour: 19, minute: 0 }, { zone: TZ }).setLocale("en");
  return dt.isValid ? dt : null;
}

function extractUpcomingCards(html: string): RawCard[] {
  const out: RawCard[] = [];
  const sectionIdx = html.search(/Upcoming Events/i);
  const slice = sectionIdx === -1 ? html : html.slice(sectionIdx, sectionIdx + 300000);

  // Cards appear as headings "### Title" in the rendered markdown; in HTML it is typically <h3>.
  const h3Re = /<h3\b[^>]*>([\s\S]*?)<\/h3>/gi;
  let m: RegExpExecArray | null;
  while ((m = h3Re.exec(slice))) {
    const h3Html = m[1];
    const title = stripHtmlAndDecode(h3Html);
    if (!title) continue;

    // Try to capture a link if present in the heading.
    const href =
      h3Html.match(/href="([^"]+)"/i)?.[1] ??
      slice
        .slice(m.index, m.index + 800)
        .match(/href="([^"]+)"/i)?.[1] ??
      undefined;
    const absHref =
      href && href.startsWith("http") ? href : href ? `${ORIGIN}${href}` : undefined;

    // Blurb varies; capture everything until next <h3> and strip.
    const after = slice.slice(h3Re.lastIndex);
    const nextH3 = after.search(/<h3\b/i);
    const blockHtml = nextH3 === -1 ? after.slice(0, 2000) : after.slice(0, nextH3);
    const blurb = stripHtmlAndDecode(blockHtml);

    out.push({ title, href: absHref, blurb });
  }

  // Fallback: if no <h3>, use markdown-ish "### " (in case the site changes)
  if (out.length > 0) return out;
  const mdRe = /^###\s+(.+)$/gim;
  let mm: RegExpExecArray | null;
  while ((mm = mdRe.exec(stripHtmlAndDecode(slice)))) {
    out.push({ title: mm[1].trim(), blurb: "" });
  }
  return out;
}

export async function fetchPoetsHouseEventsForMonth(
  year: number,
  monthIndex: number,
  signal?: AbortSignal,
): Promise<{ events: WorkshopEvent[]; meta: PoetsHouseParseMeta }> {
  const icsUrl = process.env.POETSHOUSE_ICS_URL?.trim();
  const ua =
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

  if (icsUrl) {
    const res = await fetch(icsUrl, {
      signal,
      headers: {
        Accept: "text/calendar,text/plain,*/*",
        "User-Agent": ua,
      },
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`Poets House ICS HTTP ${res.status}`);
    const ics = await res.text();
    const evs = parseIcsEvents(ics, 800);
    const mapped: WorkshopEvent[] = evs
      .map((e): WorkshopEvent | null => {
        if (!e.dtstart || !e.summary) return null;
        const start = DateTime.fromISO(e.dtstart, { zone: TZ });
        const end = e.dtend ? DateTime.fromISO(e.dtend, { zone: TZ }) : null;
        if (!start.isValid) return null;
        const category = mapCategory(e.summary);
        const format = mapFormat(e.summary, e.location ?? "");
        const ev: WorkshopEvent = {
          id: stableId(e.url, e.summary, start),
          cityId: "nyc",
          title: e.summary,
          tagline: format === "virtual" ? "Remote (Poets House)" : "Poets House (NYC)",
          description: toShortOverview(e.description ?? "", 700) || e.summary,
          start: start.toISO() ?? start.toString(),
          end: end?.isValid ? end.toISO() ?? undefined : undefined,
          timeZone: TZ,
          format,
          price: "unknown",
          category,
          organizer: "Poets House",
          venue: format === "virtual" ? undefined : "Poets House",
          address: e.location ? toShortOverview(e.location, 220) : undefined,
          rsvpUrl: e.url ?? PROGRAMS_URL,
          source: "Poets House (poetshouse.org)",
          sourceChannel: "literary_org",
          listingProvenance: "live",
        };
        return ev;
      })
      .filter((x): x is WorkshopEvent => x != null)
      .filter((x) => {
        const dt = DateTime.fromISO(x.start, { zone: TZ });
        return dt.isValid && dt.year === year && dt.month === monthIndex + 1;
      });

    return {
      events: mapped,
      meta: {
        pageFetched: true,
        usedIcs: true,
        cardsFound: evs.length,
        cardsParsed: evs.length,
        rowsInMonth: mapped.length,
      },
    };
  }

  const res = await fetch(PROGRAMS_URL, {
    signal,
    headers: {
      Accept: "text/html,application/xhtml+xml",
      "Accept-Language": "en-US,en;q=0.9",
      "User-Agent": ua,
      Referer: `${ORIGIN}/`,
    },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Poets House page HTTP ${res.status}`);
  const html = await res.text();
  const cards = extractUpcomingCards(html);
  const mapped: WorkshopEvent[] = cards
    .map((c): WorkshopEvent | null => {
      const start = parseStartFromBlurb(year, c.blurb);
      if (!start) return null;
      const end = start.plus({ hours: 1 });
      const category = mapCategory(c.title);
      const format = mapFormat(c.title, c.blurb);
      const description = toShortOverview(c.blurb, 600) || c.title;
      const ev: WorkshopEvent = {
        id: stableId(c.href, c.title, start),
        cityId: "nyc",
        title: c.title,
        tagline:
          format === "virtual"
            ? "Remote (Poets House)"
            : "Poets House (NYC)",
        description,
        start: start.toISO() ?? start.toString(),
        end: end.toISO() ?? undefined,
        timeZone: TZ,
        format,
        price: "unknown",
        category,
        organizer: "Poets House",
        venue: format === "virtual" ? undefined : "Poets House",
        rsvpUrl: c.href ?? PROGRAMS_URL,
        source: "Poets House (poetshouse.org)",
        sourceChannel: "literary_org",
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
      usedIcs: false,
      cardsFound: cards.length,
      cardsParsed: mapped.length,
      rowsInMonth: inMonth.length,
    },
  };
}

