import { DateTime } from "luxon";
import type { EventFormat, WorkshopEvent, WorkshopEventCategory } from "@/lib/workshop-types";
import { stripHtmlAndDecode, toShortOverview } from "@/lib/text";

const CLIENT_ID = 35133;
const API_ORIGIN = "https://web.ovationtix.com";
const API_ROOT = `${API_ORIGIN}/trs/api/rest`;
const FRONTEND_ORIGIN = "https://ci.ovationtix.com";
const TZ_FALLBACK = "America/New_York";

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

function inferCategory(title: string, description: string): WorkshopEventCategory {
  const b = `${title}\n${description}`.toLowerCase();
  if (/\b(open mic|open-mic|slam)\b/.test(b)) return "open-mic";
  if (/\b(workshop|class)\b/.test(b)) return "workshop";
  if (/\b(panel|in conversation|talk|lecture)\b/.test(b)) return "panel";
  if (/\b(festival|conference)\b/.test(b)) return "festival";
  if (/\b(book club|reading group)\b/.test(b)) return "book-club";
  if (/\b(reading|poetry|poet|spoken word)\b/.test(b)) return "reading";
  return "other";
}

function inferFormat(description: string): EventFormat {
  const b = description.toLowerCase();
  if (/\b(zoom|virtual|online)\b/.test(b)) return "virtual";
  return "in-person";
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
      if (typeof tz === "string" && tz.trim()) timeZone = tz.trim();
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

  const events: WorkshopEvent[] = showtimes.map((s) => {
    const detail = detailsById.get(s.productionId);
    const title =
      (detail?.productionName ?? s.productionName).replace(/\s+/g, " ").trim();
    const venueName =
      detail?.venue?.name?.trim() || "NuYorican Poets Cafe";
    const addr = addressLine(detail?.venue) ?? undefined;

    const descParts = [
      toShortOverview(stripHtmlAndDecode(detail?.description ?? ""), 520),
      toShortOverview(stripHtmlAndDecode(s.moreInfo), 420),
    ].filter(Boolean);
    const description = descParts.join("\n\n").trim() || title;

    const category = inferCategory(title, description);
    const format = inferFormat(description);

    return {
      id: stableId(s.productionId, s.performanceId, s.start),
      cityId: "nyc",
      title,
      tagline: venueName,
      description,
      start: s.start.toISO() ?? s.start.toString(),
      end: (s.end && s.end.isValid ? s.end.toISO() : s.start.plus({ hours: 1 }).toISO()) ?? undefined,
      timeZone,
      format,
      price: "unknown",
      category,
      organizer: "NuYorican Poets Cafe",
      venue: venueName,
      address: addr,
      neighborhood: addr?.includes("10013") ? "SoHo / Chinatown" : undefined,
      rsvpUrl: `${FRONTEND_ORIGIN}/${CLIENT_ID}/production/${s.productionId}`,
      source: "NuYorican Poets Cafe — OvationTix calendar",
      sourceChannel: "literary_org",
      listingProvenance: "live",
    };
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

