import { DateTime } from "luxon";
import type { EventFormat, WorkshopEvent, WorkshopEventCategory, PriceKind } from "@/lib/workshop-types";
import { stripHtmlAndDecode, toShortOverview } from "@/lib/text";

const ORIGIN = "https://www.writersgrotto.org";
export const WRITERS_GROTTO_EVENT_URL =
  "https://www.writersgrotto.org/classes-and-events/april-25-litquake-telegraph-hill-arts-larua-dave";

const TZ = "America/Los_Angeles";

export type WritersGrottoMeta = {
  pageFetched: boolean;
  parsed: boolean;
};

function mapCategory(title: string): WorkshopEventCategory {
  const b = title.toLowerCase();
  if (/\bworkshop|class\b/.test(b)) return "workshop";
  if (/\bin conversation\b|\bpanel\b|\btalk\b/.test(b)) return "panel";
  return "reading";
}

function parsePrice(text: string): PriceKind {
  const m = text.match(/\$\s*(\d+(?:\.\d{2})?)/);
  if (m) return "paid";
  return "unknown";
}

function parseStartEnd(text: string): { start: DateTime; end: DateTime } | null {
  // "Saturday April 25, 2026. Noon to 1:30 PM PT"
  const m = text.match(
    /\b(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\s+([A-Za-z]+)\s+(\d{1,2}),\s*(\d{4})\.\s*([A-Za-z0-9: ]+?)\s+to\s+([A-Za-z0-9: ]+?)\s+PT\b/i,
  );
  if (!m) return null;
  const monthName = m[1];
  const day = Number(m[2]);
  const year = Number(m[3]);
  const startTok = m[4].trim();
  const endTok = m[5].trim();

  const normalize = (t: string) => {
    const s = t.toLowerCase().trim();
    if (s === "noon") return "12:00 PM";
    if (s === "midnight") return "12:00 AM";
    if (/\d{1,2}:\d{2}\s*(am|pm)/i.test(s)) return s.toUpperCase();
    if (/^\d{1,2}\s*(am|pm)$/i.test(s)) return s.replace(/^(\d{1,2})\s*(am|pm)$/i, "$1:00 $2").toUpperCase();
    return s.toUpperCase();
  };

  const sTok = normalize(startTok);
  const eTok = normalize(endTok);

  const start = DateTime.fromFormat(`${monthName} ${day}, ${year} ${sTok}`, "LLLL d, yyyy h:mm a", {
    zone: TZ,
    locale: "en",
  });
  if (!start.isValid) return null;
  const end = DateTime.fromFormat(`${monthName} ${day}, ${year} ${eTok}`, "LLLL d, yyyy h:mm a", {
    zone: TZ,
    locale: "en",
  });
  return { start, end: end.isValid ? end : start.plus({ minutes: 90 }) };
}

function detectFormat(htmlText: string): EventFormat {
  const b = htmlText.toLowerCase();
  const hasZoom = /\(via zoom\)|\bzoom\b/.test(b);
  const hasVenue = /\bSan Francisco,\s*CA\b/i.test(htmlText) || /\bTelegraph Hill Books\b/i.test(htmlText);
  if (hasZoom && hasVenue) return "hybrid";
  if (hasZoom) return "virtual";
  return "in-person";
}

export async function fetchWritersGrottoEventsForMonth(
  year: number,
  monthIndex: number,
  signal?: AbortSignal,
): Promise<{ events: WorkshopEvent[]; meta: WritersGrottoMeta }> {
  const ua =
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";
  const res = await fetch(WRITERS_GROTTO_EVENT_URL, {
    signal,
    headers: {
      Accept: "text/html,application/xhtml+xml",
      "Accept-Language": "en-US,en;q=0.9",
      "User-Agent": ua,
      Referer: ORIGIN,
    },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Writers Grotto page HTTP ${res.status}`);
  const html = await res.text();
  const text = stripHtmlAndDecode(html);

  const canonicalText = stripHtmlAndDecode(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " "),
  );

  const title =
    text.match(/#\s*Litquake[\s\S]*?An Afternoon with Laura Dave/i)?.[0]?.replace(/^#\s*/,"").trim() ||
    "An Afternoon with Laura Dave";

  const timeBlock =
    text.match(
      /\b(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\s+[A-Za-z]+\s+\d{1,2},\s*\d{4}\.\s*[^.]*?\bPT\b/i,
    )?.[0] ?? "";
  const when = parseStartEnd(timeBlock);
  if (!when) {
    return { events: [], meta: { pageFetched: true, parsed: false } };
  }

  const format = detectFormat(text);
  const venue =
    text.match(/\bTelegraph Hill Books\b[^\n]*/i)?.[0]?.trim() ??
    (format === "virtual" ? undefined : "The Writers Grotto");
  const address =
    text.match(/\b\d{3,5}\s+[^,\n]+,\s*San Francisco,\s*CA\s*\d{5}\b/i)?.[0]?.trim() ?? undefined;

  const price: PriceKind = parsePrice(text);
  const category: WorkshopEventCategory = mapCategory(title);

  const narrative =
    canonicalText.match(
      /Litquake,\s+the Writers Grotto,[\s\S]*?(?=About the Book:|About Laura Dave:|About Pia Chatterjee:|Register Now|Follow us on social media|$)/i,
    )?.[0] ?? "";

  const description = toShortOverview(
    narrative ||
      canonicalText
        .replace(/\s*Course Fee:[\s\S]*?Dates, Times & Instructors:[\s\S]*/i, "")
        .trim(),
    240,
  );

  const ev: WorkshopEvent = {
    id: `writers-grotto-laura-dave-${when.start.toFormat("yyyyLLddHHmm")}`,
    cityId: "sf",
    title: "An Afternoon with Laura Dave (in conversation with Pia Chatterjee)",
    tagline: venue ?? "The Writers Grotto",
    description: description || "An Afternoon with Laura Dave, in conversation with Pia Chatterjee.",
    start: when.start.toISO() ?? when.start.toString(),
    end: when.end.toISO() ?? undefined,
    timeZone: TZ,
    format,
    price,
    category,
    organizer: "The Writers Grotto",
    venue,
    address,
    virtualLabel: format !== "in-person" ? "Zoom" : undefined,
    rsvpUrl: WRITERS_GROTTO_EVENT_URL,
    source: "The Writers Grotto (writersgrotto.org)",
    sourceChannel: "literary_org",
    listingProvenance: "live",
  };

  const inMonth =
    when.start.year === year && when.start.month === monthIndex + 1 ? [ev] : [];
  return { events: inMonth, meta: { pageFetched: true, parsed: true } };
}

