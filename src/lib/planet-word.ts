import { DateTime } from "luxon";
import type { EventFormat, WorkshopEvent, WorkshopEventCategory } from "@/lib/workshop-types";
import { decodeHtmlEntities, stripHtmlAndDecode, toShortOverview } from "@/lib/text";

const ORIGIN = "https://planetwordmuseum.org";
const SOURCE_URL = `${ORIGIN}/events/`;
const TZ = "America/New_York";

export type PlanetWordMeta = {
  pageFetched: boolean;
  cardsFound: number;
  cardsParsed: number;
  rowsInMonth: number;
};

type Card = {
  kind?: string;
  title: string;
  url: string;
  date: string;
  time: string;
  price?: string;
  location?: string;
  blurb?: string;
};

function isValidEventUrl(u: string): boolean {
  const s = u.trim();
  return /^https:\/\/planetwordmuseum\.org\/events\/[^/]+\/?$/i.test(s);
}

function stableId(url: string, start: DateTime): string {
  const slug = url
    .replace(ORIGIN, "")
    .replace(/^\/+/, "")
    .replace(/\/+$/, "")
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/-+/g, "-")
    .toLowerCase()
    .slice(0, 80);
  return `planet-word-${slug}-${start.toFormat("yyyyLLddHHmm")}`;
}

function categoryFrom(kind: string | undefined, title: string): WorkshopEventCategory {
  const b = `${kind ?? ""}\n${title}`.toLowerCase();
  if (/\b(workshop|classroom practice)\b/.test(b)) return "workshop";
  if (/\b(poetry|reading)\b/.test(b)) return "reading";
  if (/\b(festival)\b/.test(b)) return "festival";
  if (/\b(conversation|discourse|series)\b/.test(b)) return "panel";
  return "other";
}

function formatFromText(text: string): EventFormat {
  const b = text.toLowerCase();
  if (/\bzoom\b|\bvirtual\b|\bonline\b/.test(b)) return "virtual";
  return "in-person";
}

function parseDateTime(date: string, timeRange: string): { start: DateTime; end?: DateTime } | null {
  // date: "May 7, 2026"
  // time: "6:00 p.m. - 8:00 p.m." OR "10:00 a.m.- 11:30 a.m."
  const cleanTime = decodeHtmlEntities(timeRange)
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const m = cleanTime.match(
    /(\d{1,2}:\d{2})\s*(a\.m\.|p\.m\.)\s*-\s*(\d{1,2}:\d{2})\s*(a\.m\.|p\.m\.)/i,
  );
  const m2 = cleanTime.match(
    /(\d{1,2}:\d{2})\s*(a\.m\.|p\.m\.)\s*-\s*(\d{1,2}:\d{2})\s*(a\.m\.|p\.m\.)/i,
  );
  const mm = m ?? m2;
  if (!mm) {
    // Try single time like "2:00 p.m."
    const s = cleanTime.match(/(\d{1,2}:\d{2})\s*(a\.m\.|p\.m\.)/i);
    if (!s) return null;
    const start = DateTime.fromFormat(
      `${date} ${s[1]} ${s[2]}`,
      "LLLL d, yyyy h:mm a",
      { zone: TZ, locale: "en" },
    );
    if (!start.isValid) return null;
    return { start, end: start.plus({ hours: 1 }) };
  }

  const startTok = `${mm[1]} ${mm[2].toLowerCase().includes("p") ? "PM" : "AM"}`;
  const endTok = `${mm[3]} ${mm[4].toLowerCase().includes("p") ? "PM" : "AM"}`;

  const start = DateTime.fromFormat(`${date} ${startTok}`, "LLLL d, yyyy h:mm a", {
    zone: TZ,
    locale: "en",
  });
  if (!start.isValid) return null;
  const end = DateTime.fromFormat(`${date} ${endTok}`, "LLLL d, yyyy h:mm a", {
    zone: TZ,
    locale: "en",
  });
  return { start, end: end.isValid ? end : start.plus({ hours: 1 }) };
}

function extractCards(html: string): Card[] {
  const cards: Card[] = [];

  // Primary feed cards ("New & Upcoming") are <article ...> blocks.
  const re = /<article\b[\s\S]*?<\/article>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const block = m[0];
    const titleLink = block.match(
      /<a href="(https:\/\/planetwordmuseum\.org\/events\/[^"]+\/?)"[^>]*>\s*<h4>([\s\S]*?)<\/h4>\s*<\/a>/i,
    );
    const url =
      titleLink?.[1] ??
      block.match(
        /<a href="(https:\/\/planetwordmuseum\.org\/events\/[^"]+\/?)"/i,
      )?.[1];
    const title = titleLink?.[2] ?? block.match(/<h4>([\s\S]*?)<\/h4>/i)?.[1];
    const date = block.match(/class="event-start-date">([^<]+)</i)?.[1];
    const time = block.match(/class="event-start-time">([\s\S]*?)<\/span>/i)?.[1];
    if (!url || !isValidEventUrl(url) || !title || !date || !time) continue;

    const kind = block.match(/<div class="slug">([^<]+)<\/div>/i)?.[1];
    cards.push({
      kind: kind ? stripHtmlAndDecode(kind) : undefined,
      title: stripHtmlAndDecode(title),
      url,
      date: stripHtmlAndDecode(date),
      time: stripHtmlAndDecode(time),
    });
  }

  // Also pick up the featured/hero event section at top (slug + h2 + time + price/location + blurb + Learn More link).
  const hero = html.match(/class="aucoyote-module event-hero[\s\S]*?<\/section>/i)?.[0];
  if (hero) {
    const url = hero.match(/<a href="(https:\/\/planetwordmuseum\.org\/events\/[^"]+\/?)">Learn More<\/a>/i)?.[1]
      ?? hero.match(/<a href="(https:\/\/planetwordmuseum\.org\/events\/[^"]+\/?)"[^>]*>Learn More<\/a>/i)?.[1];
    const title = hero.match(/<h2>([\s\S]*?)<\/h2>/i)?.[1];
    const timeBlock = hero.match(/class="event-time">([\s\S]*?)<\/h4>/i)?.[1] ?? "";
    const date = stripHtmlAndDecode(timeBlock).split("\n")[0]?.trim() ?? "";
    const time = stripHtmlAndDecode(timeBlock).split("\n").slice(1).join(" ").trim();
    const price = hero.match(/class="price-range">([^<]+)</i)?.[1];
    const location = hero.match(/class="event-location">([^<]+)</i)?.[1];
    const blurb = hero.match(/class="module-copy">([\s\S]*?)<\/div>/i)?.[1];
    const kind = hero.match(/class="slug">([^<]+)<\/div>/i)?.[1];
    if (url && isValidEventUrl(url) && title && date && time) {
      cards.push({
        kind: kind ? stripHtmlAndDecode(kind) : undefined,
        title: stripHtmlAndDecode(title),
        url,
        date: stripHtmlAndDecode(date),
        time: stripHtmlAndDecode(time),
        price: price ? stripHtmlAndDecode(price) : undefined,
        location: location ? stripHtmlAndDecode(location) : undefined,
        blurb: blurb ? toShortOverview(stripHtmlAndDecode(blurb), 520) : undefined,
      });
    }
  }

  const seen = new Set<string>();
  return cards.filter((c) => {
    const k = `${c.url}::${c.date}::${c.time}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

export async function fetchPlanetWordEventsForMonth(
  year: number,
  monthIndex: number,
  signal?: AbortSignal,
): Promise<{ events: WorkshopEvent[]; meta: PlanetWordMeta }> {
  const res = await fetch(SOURCE_URL, {
    signal,
    headers: {
      Accept: "text/html,application/xhtml+xml",
      "Accept-Language": "en-US,en;q=0.9",
      "User-Agent": "LiteraryEventsCalendar/1.0 (educational; contact repo owner)",
      Referer: ORIGIN,
    },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Planet Word page HTTP ${res.status}`);
  const html = await res.text();

  const cards = extractCards(html);
  const parsed: WorkshopEvent[] = [];

  for (const c of cards) {
    const when = parseDateTime(c.date, c.time);
    if (!when) continue;
    if (when.start.year !== year || when.start.month !== monthIndex + 1) continue;

    const desc = [
      c.blurb ? cleanLine(c.blurb) : "",
      c.price ? `Price: ${cleanLine(c.price)}` : "",
      c.location ? `Location: ${cleanLine(c.location)}` : "",
    ]
      .filter(Boolean)
      .join("\n");

    const blob = `${c.kind ?? ""}\n${c.title}\n${desc}`.trim();

    parsed.push({
      id: stableId(c.url, when.start),
      cityId: "dmv",
      title: c.title,
      tagline: c.kind ? `${c.kind} · Planet Word` : "Planet Word",
      description: desc || "See Planet Word for program details.",
      start: when.start.toISO() ?? when.start.toString(),
      end: when.end?.toISO() ?? undefined,
      timeZone: TZ,
      format: formatFromText(blob),
      price: c.price && /\$\s*\d/.test(c.price) ? "paid" : "unknown",
      category: categoryFrom(c.kind, c.title),
      organizer: "Planet Word Museum",
      venue: c.location ? cleanLine(c.location) : "Planet Word Museum",
      address: "925 13th St. NW, Washington, DC 20005",
      neighborhood: "Downtown DC",
      rsvpUrl: c.url,
      source: "Planet Word — Events & Public Programs",
      sourceChannel: "literary_org",
      listingProvenance: "live",
    });
  }

  parsed.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());

  return {
    events: parsed,
    meta: {
      pageFetched: true,
      cardsFound: cards.length,
      cardsParsed: parsed.length,
      rowsInMonth: parsed.length,
    },
  };
}

function cleanLine(s: string): string {
  return stripHtmlAndDecode(s).replace(/\s+/g, " ").trim();
}

