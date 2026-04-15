import type {
  EventFormat,
  WorkshopEvent,
  WorkshopEventCategory,
} from "@/lib/workshop-types";

/** Public LibNet origin used by the DCPL events widget (same host as `eeventcaldata`). */
export const DCPL_LIBNET_ORIGIN = "https://dclibrary.libnet.info";

/** Default Communico / LibNet `event_type` for the main DCPL events catalog. */
export const DCPL_DEFAULT_EVENT_TYPE = "0";

/** Matches the default “Author Talk” filter on the DCPL events URL the app mirrors. */
export const DCPL_DEFAULT_TYPE_FILTERS = ["Author Talk"] as const;

export type DcplLibnetRawEvent = {
  id: string;
  recurring_id?: string;
  title: string;
  sub_title?: string;
  description?: string;
  long_description?: string;
  event_start?: string;
  event_end?: string;
  raw_start_time?: string;
  raw_end_time?: string;
  library?: string;
  location?: string;
  venues?: string | null;
  url?: string;
  reg_url?: string;
  third_party_reg?: string;
  event_type?: string;
  tagsArray?: string[];
  registration_cost?: string;
  time_string?: string;
};

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

/** First calendar day of month as YYYY-MM-DD (local). */
export function firstDayOfMonthISO(year: number, monthIndex: number): string {
  return `${year}-${pad2(monthIndex + 1)}-01`;
}

/**
 * Inclusive day count for that month (28–31). The LibNet widget sends `days` after an
 * internal +1 adjustment; this value is the payload `days` field the server expects.
 */
export function libnetMonthDaySpan(year: number, monthIndex: number): number {
  const last = new Date(year, monthIndex + 1, 0).getDate();
  return last;
}

export function buildDcplEeventCalReq(options: {
  date: string;
  daySpan: number;
  types?: string[];
  private?: boolean;
}): Record<string, unknown> {
  const req: Record<string, unknown> = {
    private: options.private ?? false,
    date: options.date,
    days: options.daySpan,
  };
  if (options.types?.length) {
    req.types = options.types.map((t) => encodeURIComponent(t));
  }
  return req;
}

export function dcplEeventCalUrl(
  req: Record<string, unknown>,
  eventType: string = DCPL_DEFAULT_EVENT_TYPE,
): string {
  const q = encodeURIComponent(JSON.stringify(req));
  return `${DCPL_LIBNET_ORIGIN}/eeventcaldata?event_type=${encodeURIComponent(eventType)}&req=${q}`;
}

function normalizeListUrl(url: string): string {
  return url
    .replace(/^https:\/\/dclibrary\.libnet\.info\/\/+/i, "https://dclibrary.libnet.info/")
    .replace(/([^:])\/\//g, "$1/");
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function libNetAttendanceBlob(raw: DcplLibnetRawEvent): string {
  return [
    raw.event_type,
    raw.library,
    raw.location,
    raw.venues,
    raw.title,
    raw.sub_title,
    raw.description,
    raw.long_description,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

/** LibNet / Communico rows: infer in-person vs virtual vs hybrid for filter accuracy. */
export function mapLibNetAttendanceFormat(raw: DcplLibnetRawEvent): EventFormat {
  const u = (raw.event_type ?? "").trim().toUpperCase();
  if (u === "VIRTUAL" || u === "ONLINE" || u === "WEBINAR") return "virtual";
  if (u === "HYBRID") return "hybrid";

  const hay = libNetAttendanceBlob(raw);
  if (/\bhybrid\b/.test(hay)) return "hybrid";
  if (
    /\b(virtual|online only|via zoom|on zoom|zoom link|webex|teams meeting|google meet|live-?stream|livestream)\b/.test(
      hay,
    )
  ) {
    if (/\b(in-?person|at the library|library branch|community room|meeting room)\b/.test(hay)) {
      return "hybrid";
    }
    return "virtual";
  }
  return "in-person";
}

function mapCategory(tags: string[] | undefined): WorkshopEventCategory {
  const t = new Set((tags ?? []).map((x) => x.toLowerCase()));
  if (t.has("book club")) return "book-club";
  if (t.has("open mic") || t.has("open mic / spoken word")) return "open-mic";
  if (t.has("festival")) return "festival";
  if (t.has("theater") || t.has("theatre")) return "theater";
  if (t.has("author talk") || t.has("poetry month") || t.has("lecture"))
    return "reading";
  if (t.has("workshop") || t.has("educational program")) return "workshop";
  return "other";
}

function venueLine(raw: DcplLibnetRawEvent): string | undefined {
  const parts = [raw.library ?? raw.location, raw.venues].filter(
    (x): x is string => Boolean(x && String(x).trim()),
  );
  if (parts.length === 0) return undefined;
  return parts.join(" · ");
}

/**
 * Maps a LibNet `eeventcaldata` row to the app’s workshop event shape.
 */
export function mapDcplLibnetRowToWorkshopEvent(
  raw: DcplLibnetRawEvent,
  cityId: string,
): WorkshopEvent {
  const startRaw = raw.event_start ?? raw.raw_start_time ?? "";
  const endRaw = raw.event_end ?? raw.raw_end_time;
  const start = startRaw.includes("T")
    ? startRaw
    : startRaw.replace(" ", "T");
  const end =
    endRaw && !endRaw.startsWith("0000-00-00")
      ? endRaw.includes("T")
        ? endRaw
        : endRaw.replace(" ", "T")
      : undefined;

  const plainDesc = (raw.description ?? "").trim();
  const longHtml = (raw.long_description ?? "").trim();
  const description =
    plainDesc ||
    (longHtml ? stripHtml(longHtml).slice(0, 2000) : "") ||
    "Details on the library event page.";

  const listUrl = raw.url ? normalizeListUrl(raw.url) : "";
  const thirdParty = raw.third_party_reg === "1" && raw.reg_url?.trim();
  const rsvpUrl = thirdParty ? raw.reg_url!.trim() : listUrl || undefined;

  const regCost = raw.registration_cost?.trim();
  const price =
    regCost && regCost !== "0" && Number(regCost) > 0 ? "paid" : "free";

  const tagline =
    (raw.sub_title ?? "").trim() || (raw.time_string ?? "").trim() || "";

  const format = mapLibNetAttendanceFormat(raw);
  const virtualLabel =
    format === "hybrid"
      ? "Hybrid (online + in person)"
      : format === "virtual"
        ? "Online (library program)"
        : undefined;

  return {
    id: `dcpl-${raw.id}`,
    cityId,
    title: raw.title.trim(),
    tagline,
    description,
    start,
    end,
    format,
    price,
    category: mapCategory(raw.tagsArray),
    organizer: "DC Public Library",
    venue: venueLine(raw),
    virtualLabel,
    source: "DC Public Library (LibNet)",
    sourceChannel: "library",
    listingProvenance: "live",
    rsvpUrl,
  };
}
