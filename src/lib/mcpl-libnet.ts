import type { WorkshopEvent, WorkshopEventCategory } from "@/lib/workshop-types";
import type { DcplLibnetRawEvent } from "@/lib/dcpl-libnet";
import { DCPL_DEFAULT_EVENT_TYPE, mapLibNetAttendanceFormat } from "@/lib/dcpl-libnet";
import { DateTime } from "luxon";

export const MCPL_LIBNET_ORIGIN = "https://mcpl.libnet.info";

/** MCPL uses the same Communico/LibNet `event_type` pattern as DCPL in practice. */
export const MCPL_DEFAULT_EVENT_TYPE = DCPL_DEFAULT_EVENT_TYPE;

export type McplLibnetRawEvent = DcplLibnetRawEvent;

export function mcplEeventCalUrl(
  req: Record<string, unknown>,
  eventType: string = MCPL_DEFAULT_EVENT_TYPE,
): string {
  const q = encodeURIComponent(JSON.stringify(req));
  return `${MCPL_LIBNET_ORIGIN}/eeventcaldata?event_type=${encodeURIComponent(eventType)}&req=${q}`;
}

function normalizeMcplUrl(url: string): string {
  return url
    .replace(/^https:\/\/mcpl\.libnet\.info\/\/+/i, "https://mcpl.libnet.info/")
    .replace(/([^:])\/\//g, "$1/");
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function mapCategory(tags: string[] | undefined): WorkshopEventCategory {
  const t = new Set((tags ?? []).map((x) => x.toLowerCase()));
  if (t.has("book club")) return "book-club";
  if (t.has("open mic") || t.has("open mic / spoken word")) return "open-mic";
  if (t.has("festival")) return "festival";
  if (t.has("theater") || t.has("theatre")) return "theater";
  if (
    t.has("poetry") ||
    t.has("author talk") ||
    t.has("meet the author") ||
    t.has("lectures and discussions")
  ) {
    return "reading";
  }
  if (t.has("writers group") || t.has("workshop")) return "workshop";
  return "other";
}

function venueLine(raw: McplLibnetRawEvent): string | undefined {
  const parts = [raw.library ?? raw.location, raw.venues].filter(
    (x): x is string => Boolean(x && String(x).trim()),
  );
  if (parts.length === 0) return undefined;
  return parts.join(" · ");
}

/**
 * Keeps MCPL events that are clearly about books, authors, poetry, or writing—
 * and drops routine programs (storytimes, jobs, games, wellness, etc.).
 */
export function isMcplLiteraryWritingEvent(raw: McplLibnetRawEvent): boolean {
  const title = (raw.title ?? "").trim();
  const sub = (raw.sub_title ?? "").trim();
  const desc = (raw.description ?? "").trim().slice(0, 500);
  const blob = `${title} ${sub} ${desc}`.toLowerCase();
  const tags = raw.tagsArray ?? [];
  const tagsLower = tags.map((t) => t.toLowerCase());

  const titleLower = title.toLowerCase();

  // Routine early-literacy / play programs (not the “literary events” slice).
  if (
    /\bstorytime\b/i.test(title) ||
    /^baby\b/i.test(title) ||
    /^toddler\b/i.test(title) ||
    /^preschool\b/i.test(title) ||
    /^family storytime/i.test(title) ||
    /\bplaytime\b/i.test(title) ||
    /\bplay group\b/i.test(title) ||
    /\bblock party\b/i.test(title)
  ) {
    return false;
  }

  const excludePhrases = [
    "mahjong",
    "resume",
    "job fair",
    "job club",
    "job search",
    "cowork",
    "coworking",
    "quiet study",
    "study hall",
    "teen lounge",
    "tax preparation",
    "tax-aide",
    "aarp foundation tax",
    "yoga",
    "meditation",
    "chess",
    "game night",
    "board game",
    "tabletop",
    "gaming tournament",
    "escape room",
    "knitting",
    "crochet",
    "yarn group",
    "bone builders",
    "line dancing",
    "social security",
    "medicare",
    "excel ",
    "microsoft word",
    "powerpoint",
    "linkedin",
    "computer basics",
    "open lab",
    "english conversation",
    "esl conversation",
    "conversation club",
    "citizenship",
    "cursive club",
    "phonics",
    "information table",
    "college fair",
    "read to a dog",
    "read to pet",
    "therapy dog",
    "paws to read",
    "financial literacy",
    "credit repair",
    "notary",
  ];
  for (const p of excludePhrases) {
    if (blob.includes(p)) return false;
  }

  if (
    tags.some((t) =>
      /workforce|job seeker|personal finance|health and wellness|disability interest/i.test(
        t,
      ),
    )
  ) {
    return false;
  }

  // “Games and play” alone is almost never our literary slice.
  const hasGamesOnly =
    tags.length > 0 &&
    tags.every((t) =>
      /games and play|arts, crafts and hobbies|stem/i.test(t),
    );
  if (hasGamesOnly && !/\b(poetry|writer|writing|author|book)\b/i.test(blob)) {
    return false;
  }

  const strongTag = tags.some((t) =>
    /writers group|meet the author|author talk|creative writing|writing workshop/i.test(
      t,
    ),
  );

  const poetryOrBookTag = tags.some((t) =>
    /^poetry$/i.test(t) || /book club/i.test(t),
  );

  const readingProgramsOk =
    tags.some((t) => /^reading programs$/i.test(t)) &&
    /\b(book|novel|readers|reading group|writer|writing|poetry|story contest|haiku|zine)\b/i.test(
      blob,
    );

  const lecturesOk =
    tags.some((t) => /lectures and discussions/i.test(t)) &&
    /\b(book|novel|author|fiction|nonfiction|non-fiction|memoir|poetry|poet|essay|literary|readers|discussion|writers|writing|short story|zine|publishing)\b/i.test(
      blob,
    );

  const titleSignal =
    /\b(author|book club|poetry|poet|writer'?s|writers\b|writing|novel|memoir|fiction|non-?fiction|literary|essay|zine|publishing|spoken word|open mic|book discussion|book talk|reads\b|reading group|haiku|short story|story contest|national poetry month)\b/i.test(
      `${titleLower} ${sub.toLowerCase()}`,
    );

  const descSignal =
    /\b(author talk|book discussion|writers group|creative writing|poetry reading|fiction workshop|memoir)\b/i.test(
      desc.toLowerCase(),
    );

  return (
    strongTag ||
    poetryOrBookTag ||
    readingProgramsOk ||
    lecturesOk ||
    titleSignal ||
    descSignal
  );
}

export function mapMcplLibnetRowToWorkshopEvent(
  raw: McplLibnetRawEvent,
  cityId: string,
): WorkshopEvent {
  const startRaw = raw.event_start ?? raw.raw_start_time ?? "";
  const endRaw = raw.event_end ?? raw.raw_end_time;
  const tz = "America/New_York";
  const startLocal = startRaw.includes("T") ? startRaw : startRaw.replace(" ", "T");
  const startDt = DateTime.fromISO(startLocal, { zone: tz });
  const start = (startDt.isValid ? startDt.toISO() : null) ?? startLocal;
  const endLocal =
    endRaw && !endRaw.startsWith("0000-00-00")
      ? (endRaw.includes("T") ? endRaw : endRaw.replace(" ", "T"))
      : undefined;
  const end =
    endLocal
      ? (DateTime.fromISO(endLocal, { zone: tz }).toISO() ?? endLocal)
      : undefined;

  const plainDesc = (raw.description ?? "").trim();
  const longHtml = (raw.long_description ?? "").trim();
  const description =
    plainDesc ||
    (longHtml ? stripHtml(longHtml).slice(0, 2000) : "") ||
    "Details on the library event page.";

  const listUrl = raw.url ? normalizeMcplUrl(raw.url) : "";
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
    id: `mcpl-${raw.id}`,
    cityId,
    title: raw.title.trim(),
    tagline,
    description,
    start,
    end,
    timeZone: tz,
    format,
    price,
    category: mapCategory(raw.tagsArray),
    organizer: "Montgomery County Public Libraries",
    venue: venueLine(raw),
    virtualLabel,
    source: "Montgomery County Public Libraries (LibNet)",
    sourceChannel: "library",
    listingProvenance: "live",
    rsvpUrl,
  };
}
