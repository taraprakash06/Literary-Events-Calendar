import { DateTime } from "luxon";
import type { EventFormat, WorkshopEvent, WorkshopEventCategory } from "@/lib/workshop-types";
import { limitAboutToSentences, stripHtmlAndDecode, toShortOverview } from "@/lib/text";

const CLIENT_ID = 35133;
const API_ORIGIN = "https://web.ovationtix.com";
const API_ROOT = `${API_ORIGIN}/trs/api/rest`;
const FRONTEND_ORIGIN = "https://ci.ovationtix.com";
const TZ_FALLBACK = "America/New_York";
const BOWERY_SLAM_RSVP = "https://boweryslam.eventbrite.com";

type SeriesEnrichment = {
  match: RegExp;
  about: string;
  format?: EventFormat;
  price?: WorkshopEvent["price"];
  priceDetail?: string;
  rsvpUrl?: string;
  virtualLabel?: string;
  registrationRequired?: boolean;
  /** Override feed wall-clock times (venue-local) when ticketing uses doors/open. */
  clock?: {
    startHour: number;
    startMinute: number;
    endHour: number;
    endMinute: number;
  };
  skip?: boolean;
};

/**
 * Curated About / format / price for recurring Nuyorican series.
 * Matched against production title; first match wins.
 */
const NUYORICAN_SERIES: SeriesEnrichment[] = [
  {
    match: /\btest\b.*\bdisregard\b|\bdisregard\b.*\btest\b/i,
    about: "",
    skip: true,
  },
  {
    match: /bowery\s+slam/i,
    about:
      "During the cafe's Nuyorican-Struction, the famous Monday poetry slam moves to Bowery Poetry Club at 308 Bowery in Manhattan, welcomed by club founder Bob Holman—who started the Nuyorican Slam 35 years ago—and hosted by JRose & Luna Rosa. Line starts at 6 PM, doors open at 6:30, and the slam runs about 6:45–9:00; performers sign up at the stage first-come, first-served after doors open. Poets get three minutes for one original poem per round, judged by randomly chosen audience members across two rounds—the winner takes $20 and an invite to the monthly Final Friday Slam. Tickets are $20 in advance or at the door.",
    format: "in-person",
    price: "paid",
    priceDetail: "$20",
    rsvpUrl: BOWERY_SLAM_RSVP,
    registrationRequired: true,
  },
  {
    match: /final\s+friday\s+slam/i,
    about:
      "The Nuyorican Poets Cafe's Final Friday Slam lands on the last Friday of each month at the Loisaida Center on East 9th Street while the cafe building undergoes #Nuyoricanstruction. Doors open at 7 PM, with the slam and Twilight Hour Open Mic from 7:30–10:30 PM; seats for ticketholders are guaranteed only until 7:15. Competitors include weekly Bowery Slam winners, a lottery poet from the audience, and curated guests in a head-to-head bracket—the winner takes $100 and a Grand Slam nomination. Tickets are $25 in advance or at the door, and the slam is followed by an open mic anyone can join.",
    format: "in-person",
    price: "paid",
    priceDetail: "$25",
    // Feed lists doors (7:00); site program time is 7:30–10:30 PM.
    clock: { startHour: 19, startMinute: 30, endHour: 22, endMinute: 30 },
    registrationRequired: true,
  },
  {
    match: /w\.?o\.?w\.?\s+open\s+mic|womxn\s+orator/i,
    about:
      "On the first Wednesday of each month, Womxn Orator Wednesday (WOW) brings an open mic hosted by 2024 Grand Slam Champion Sumbodies Mama—plus a featured performer—to the Loisaida Center during #Nuyoricanstruction. Doors open at 6 PM and the mic runs 6:30–8:30 PM, with 15 in-person signup spots at the ticket table for early arrivals. Poetry, stories, comedy, monologues, and original songs are welcome (3–5 minutes); these nights are no longer streamed or filmed to keep the space intimate. Tickets are $10 for performers and audience, in advance or at the door.",
    format: "in-person",
    price: "paid",
    priceDetail: "$10",
    registrationRequired: true,
  },
  {
    match: /open\s+mic\s+hosted\s+by\s+brian|brian\s+acosta/i,
    about:
      "Join the Nuyorican Poets Cafe for its off-site Wednesday open mic hosted by Brian Acosta Arya at the Loisaida Center (710 East 9th Street) during the cafe's #Nuyoricanstruction. Doors open at 6 PM and the open mic runs 6:30–8:30 PM every Wednesday except the first of the month; sign up at the welcome table after you enter. All art forms are welcome—poetry, short stories, comedy, monologues, and original songs—with a three-minute max per performer. Tickets are $10 in advance or at the door for audience and performers alike.",
    format: "in-person",
    price: "paid",
    priceDetail: "$10",
    registrationRequired: true,
  },
  {
    match: /online\s+open\s+mic|hosted\s+by\s+elemen/i,
    about:
      "Join The Online Open Mic (#TOOM), a free weekly Zoom open mic every Thursday at 8 PM ET hosted by Elemen2al the Poet. Sign up to perform one poem, song, or comedy bit (4 minutes or less) by ordering an Artist RSVP ticket—20 spots open Wednesdays at 8 PM ET, with a good-luck round if the list fills. Watch live on Zoom or via the Nuyorican Poets Cafe YouTube stream. The night is free for performers and audiences; donations help keep the series going.",
    format: "virtual",
    price: "free",
    virtualLabel: "Zoom",
    registrationRequired: true,
  },
  {
    match: /slam\s+workshop/i,
    about:
      "The Nuyorican's Slam Workshop: Theory in Practice is a free monthly Zoom series led by 2015 Grand Slam Champion and MFA holder Joel Francois. Each multi-part unit pairs a Theory and Works session with a practicum, drawing on proven methods to expand writing technique and personal narrative. Drop-ins are welcome even if you miss earlier classes, and participants get ongoing access to notes, example poems, and vocabulary. Held online the second Tuesday of each month; RSVP required for the Zoom link.",
    format: "virtual",
    price: "free",
    virtualLabel: "Zoom",
    registrationRequired: true,
  },
];

function seriesEnrichmentForTitle(title: string): SeriesEnrichment | undefined {
  return NUYORICAN_SERIES.find((s) => s.match.test(title));
}

type CalendarProduction = {
  date?: string;
  productions?: {
    productionId: number;
    name?: string;
    supertitle?: string;
    subtitle?: string;
    allDayEvent?: boolean;
    hidden?: boolean;
    showtimes?: {
      productionId: number;
      performanceId: number;
      performanceStartTime?: string; // "2026-04-25 19:00"
      performanceEndTime?: string; // "2026-04-25 21:00"
      moreInfo?: string;
      isCancelled?: boolean;
      isVisible?: boolean;
    }[];
  }[];
};

type ProductionDetail = {
  id?: number;
  productionName?: string;
  supertitle?: string;
  subtitle?: string;
  description?: string;
  venue?: {
    name?: string;
    address?: {
      line1?: string;
      line2?: string;
      city?: string;
      stateAbbrev?: string;
      zipcode?: string;
      empty?: boolean;
    } | null;
  } | null;
};

export type NuyoricanParseMeta = {
  contextFetched: boolean;
  calendarFetched: boolean;
  productionsFetched: number;
  showtimesParsed: number;
  rowsInMonth: number;
};

function headers(): Record<string, string> {
  // Mirrors the web client defaults (see AudienceView bundles).
  return {
    Accept: "application/json",
    "Content-Type": "application/json",
    clientId: String(CLIENT_ID),
    newCIRequest: "true",
  };
}

function parseLocal(ts: string | undefined, zone: string): DateTime | null {
  const s = (ts ?? "").trim();
  if (!s) return null;
  const dt = DateTime.fromFormat(s, "yyyy-MM-dd HH:mm", { zone, locale: "en" });
  return dt.isValid ? dt : null;
}

/**
 * OvationTix often returns "EST"/"EDT" (fixed offsets). Luxon treats those as
 * no-DST zones, which shifts summer NYC times by an hour. Prefer IANA zones.
 */
function resolveOvationTimeZone(raw: string | undefined): string {
  const t = (raw ?? "").trim();
  if (!t) return TZ_FALLBACK;
  if (/^(EST|EDT|ET|Eastern)$/i.test(t)) return "America/New_York";
  if (/^(CST|CDT|CT|Central)$/i.test(t)) return "America/Chicago";
  if (/^(MST|MDT|MT|Mountain)$/i.test(t)) return "America/Denver";
  if (/^(PST|PDT|PT|Pacific)$/i.test(t)) return "America/Los_Angeles";
  if (t.includes("/")) return t;
  return TZ_FALLBACK;
}

function applySeriesClock(
  start: DateTime,
  end: DateTime | null,
  clock: NonNullable<SeriesEnrichment["clock"]>,
): { start: DateTime; end: DateTime } {
  const nextStart = start.set({
    hour: clock.startHour,
    minute: clock.startMinute,
    second: 0,
    millisecond: 0,
  });
  let nextEnd = start.set({
    hour: clock.endHour,
    minute: clock.endMinute,
    second: 0,
    millisecond: 0,
  });
  if (nextEnd <= nextStart) nextEnd = nextEnd.plus({ days: 1 });
  return { start: nextStart, end: nextEnd };
}

function inferCategory(title: string, description: string): WorkshopEventCategory {
  const b = `${title}\n${description}`.toLowerCase();
  if (/\b(open mic|open-mic|slam)\b/.test(b)) return "open-mic";
  if (/\b(workshop|class)\b/.test(b)) return "workshop";
  if (/\b(panel|in conversation|talk|lecture)\b/.test(b)) return "other";
  if (/\b(festival|conference)\b/.test(b)) return "other";
  if (/\b(book club|reading group)\b/.test(b)) return "other";
  if (/\b(reading|poetry|poet|spoken word)\b/.test(b)) return "reading";
  return "other";
}

function inferFormat(title: string, description: string): EventFormat {
  const b = `${title}\n${description}`.toLowerCase();
  if (/\bonline\s+open\s+mic\b|\bvia zoom\b|\bon zoom\b|\bzoom meeting\b/.test(b)) {
    return "virtual";
  }
  // Explicit in-person beats ticket copy that says “buy online”.
  if (/\b(in[- ]person|doors open|at the door|bowery poetry club|loisaida)\b/.test(b)) {
    return "in-person";
  }
  if (
    /\b(zoom|virtual event|livestream|live stream|online only|streaming online|held online)\b/.test(
      b,
    )
  ) {
    return "virtual";
  }
  if (/\bvirtual\b/.test(b) || /\bonline\b/.test(title.toLowerCase())) return "virtual";
  return "in-person";
}

function cleanNuyoricanDescription(text: string): string {
  return text
    .replace(
      /^\s*Tickets:\s*.*?(?:same price\)\.?|\.)\s*/i,
      "",
    )
    .replace(
      /\*\*\s*Purchase your ticket at\s+https?:\/\/\S+\s*\*\*/gi,
      "",
    )
    .replace(
      /\*{0,2}\s*NOTICE\s*:?\s*By attending[\s\S]*?(?=\s*(?:\*{0,2}\s*After|\*{0,2}\s*Our |\*{0,2}\s*Please |$))/gi,
      " ",
    )
    .replace(
      /\bAfter the show, fill out this survey[\s\S]*$/i,
      "",
    )
    .replace(
      /\bThanks to Bloomberg Philanthropies[\s\S]*$/i,
      "",
    )
    .replace(
      /\bOur WOW open mic events are made possible[\s\S]*$/i,
      "",
    )
    .replace(
      /\bPlease keep your camera and mic on[\s\S]*$/i,
      "",
    )
    .replace(/\s+/g, " ")
    .trim();
}

function parseTicketPrice(
  text: string,
): { price: WorkshopEvent["price"]; priceDetail?: string } {
  if (/\bfree\b/i.test(text) && !/\$\s*\d/.test(text)) {
    return { price: "free" };
  }
  const m = text.match(
    /\$\s*(\d+(?:\.\d{2})?)\s*(?:in advance|at the door|tickets?\b|\(|plus online)/i,
  );
  if (m) return { price: "paid", priceDetail: `$${m[1]}` };
  const tickets = text.match(/\bTickets?:\s*\$\s*(\d+(?:\.\d{2})?)/i);
  if (tickets) return { price: "paid", priceDetail: `$${tickets[1]}` };
  if (/\bfree\b/i.test(text)) return { price: "free" };
  return { price: "unknown" };
}

function fallbackAbout(rawDesc: string, rawMore: string, title: string): string {
  const cleaned = cleanNuyoricanDescription(
    [rawDesc, rawMore].filter(Boolean).join(" "),
  );
  return (
    limitAboutToSentences(cleaned, 4) ||
    toShortOverview(cleaned, 520) ||
    title
  );
}

function addressLine(addr: ProductionDetail["venue"] extends infer V ? any : any): string | undefined {
  const a = addr?.address;
  if (!a || a.empty) return undefined;
  const parts = [
    a.line1,
    a.line2,
    [a.city, a.stateAbbrev, a.zipcode].filter(Boolean).join(" "),
  ]
    .filter((p: string | undefined) => !!p && p.trim().length > 0)
    .map((p: string) => p.trim());
  const out = parts.join(", ").replace(/\s+/g, " ").trim();
  return out || undefined;
}

function stableId(productionId: number, performanceId: number, start: DateTime): string {
  return `nuyorican-${productionId}-${performanceId}-${start.toFormat("yyyyLLddHHmm")}`;
}

export async function fetchNuyoricanEventsForMonth(
  year: number,
  monthIndex: number,
  signal?: AbortSignal,
): Promise<{ events: WorkshopEvent[]; meta: NuyoricanParseMeta }> {
  // Grab timezone (and prove the tenant is reachable).
  let timeZone = TZ_FALLBACK;
  let contextFetched = false;
  try {
    const ctxRes = await fetch(`${API_ROOT}/Context`, {
      signal,
      headers: headers(),
      cache: "no-store",
    });
    if (ctxRes.ok) {
      const ctx = (await ctxRes.json()) as any;
      const tz = ctx?.clientContext?.timeZone;
      if (typeof tz === "string" && tz.trim()) {
        timeZone = resolveOvationTimeZone(tz);
      }
      contextFetched = true;
    }
  } catch {
    // proceed with fallback TZ
  }

  const calRes = await fetch(`${API_ROOT}/CalendarProductions`, {
    signal,
    headers: headers(),
    cache: "no-store",
  });
  if (!calRes.ok) throw new Error(`OvationTix calendar HTTP ${calRes.status}`);
  const calendar = (await calRes.json()) as CalendarProduction[];

  // Collect showtimes in the requested month.
  const showtimes: {
    productionId: number;
    performanceId: number;
    productionName: string;
    moreInfo: string;
    start: DateTime;
    end: DateTime | null;
  }[] = [];

  for (const day of calendar) {
    for (const prod of day.productions ?? []) {
      if (prod.hidden) continue;
      for (const st of prod.showtimes ?? []) {
        if (st.isCancelled) continue;
        if (st.isVisible === false) continue;
        const start = parseLocal(st.performanceStartTime, timeZone);
        if (!start) continue;
        if (start.year !== year || start.month !== monthIndex + 1) continue;
        const end = parseLocal(st.performanceEndTime, timeZone);
        showtimes.push({
          productionId: prod.productionId,
          performanceId: st.performanceId,
          productionName: (prod.name ?? "").trim() || `Production ${prod.productionId}`,
          moreInfo: (st.moreInfo ?? "").trim(),
          start,
          end,
        });
      }
    }
  }

  // Fetch production details for the month’s items to enrich venue/description.
  const uniqueProdIds = [...new Set(showtimes.map((s) => s.productionId))];
  const detailsById = new Map<number, ProductionDetail>();
  for (const pid of uniqueProdIds) {
    try {
      const res = await fetch(`${API_ROOT}/Production(${pid})`, {
        signal,
        headers: headers(),
        cache: "no-store",
      });
      if (!res.ok) continue;
      const d = (await res.json()) as ProductionDetail;
      detailsById.set(pid, d);
    } catch {
      // ignore per-production failures
    }
  }

  const events: WorkshopEvent[] = showtimes.flatMap((s) => {
    const detail = detailsById.get(s.productionId);
    const title =
      (detail?.productionName ?? s.productionName).replace(/\s+/g, " ").trim();
    const series = seriesEnrichmentForTitle(title);
    if (series?.skip) return [];

    const venueName =
      detail?.venue?.name?.trim() || "NuYorican Poets Cafe";
    const addr = addressLine(detail?.venue) ?? undefined;

    const rawDesc = stripHtmlAndDecode(detail?.description ?? "");
    const rawMore = stripHtmlAndDecode(s.moreInfo);
    const description =
      series?.about?.trim() || fallbackAbout(rawDesc, rawMore, title);

    const category = inferCategory(title, `${rawDesc}\n${description}`);
    const format =
      series?.format ?? inferFormat(title, `${rawDesc}\n${description}`);
    const priced = series?.price
      ? { price: series.price, priceDetail: series.priceDetail }
      : parseTicketPrice(`${rawDesc}\n${rawMore}\n${description}`);

    const timed = series?.clock
      ? applySeriesClock(s.start, s.end, series.clock)
      : { start: s.start, end: s.end };

    const virtualLabel =
      series?.virtualLabel ??
      (format === "virtual" && /\bzoom\b/i.test(`${title}\n${rawDesc}\n${description}`)
        ? "Zoom"
        : format === "virtual"
          ? "Online Program"
          : undefined);

    const neighborhood = addr?.includes("10012")
      ? "Bowery / East Village"
      : addr?.includes("10009")
        ? "Lower East Side / Loisaida"
        : addr?.includes("10013")
          ? "SoHo / Chinatown"
          : undefined;

    const event: WorkshopEvent = {
      id: stableId(s.productionId, s.performanceId, timed.start),
      cityId: "nyc",
      title,
      tagline: venueName,
      description,
      start: timed.start.toISO() ?? timed.start.toString(),
      end:
        (timed.end && timed.end.isValid
          ? timed.end.toISO()
          : timed.start.plus({ hours: 1 }).toISO()) ?? undefined,
      timeZone,
      format,
      price: priced.price,
      priceDetail: priced.priceDetail,
      category,
      organizer: "NuYorican Poets Cafe",
      venue: venueName,
      address: addr,
      neighborhood,
      virtualLabel,
      registrationRequired: series?.registrationRequired,
      rsvpUrl:
        series?.rsvpUrl ??
        `${FRONTEND_ORIGIN}/${CLIENT_ID}/production/${s.productionId}`,
      source: "NuYorican Poets Cafe — OvationTix calendar",
      sourceChannel: "literary_org",
      listingProvenance: "live",
    };
    return [event];
  });

  events.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());

  return {
    events,
    meta: {
      contextFetched,
      calendarFetched: true,
      productionsFetched: detailsById.size,
      showtimesParsed: showtimes.length,
      rowsInMonth: events.length,
    },
  };
}

