import { DateTime } from "luxon";
import type { WorkshopEvent, WorkshopEventCategory } from "@/lib/workshop-types";
import { stripHtmlAndDecode, toShortOverview } from "@/lib/text";

const TZ = "America/Los_Angeles";
const LIBRARY_SUBDOMAIN = "sdcl";
const GATEWAY = "https://gateway.bibliocommons.com/v2";
const PUBLIC_ORIGIN = "https://sdcl.bibliocommons.com";

/**
 * Filters matching the SDCL BiblioCommons literary events view:
 * Book Club, Friends of the Library, Writing & Poetry
 * (+ audiences / English from the shared calendar URL).
 */
export const SDCL_TYPE_IDS = [
  "60916848428df5450012dac9", // Book Club
  "62633f46e501383d004f7fa6", // Friends of the Library
  "60d4ba089880a342007ce7b1", // Writing & Poetry
] as const;

export const SDCL_AUDIENCE_IDS = [
  "609168518910133a0055837f",
  "6514b4bbc0db8d2800d29458",
  "60a3e3b58761ed3a00effdd0",
] as const;

export const SDCL_LANGUAGE_IDS = ["6091687b428df5450012daca"] as const;

const PAGE_LIMIT = 50;
const MAX_PAGES = 8;

type SdclAddress = {
  country?: string;
  zip?: string;
  state?: string;
  city?: string;
  street?: string;
  number?: string;
};

type SdclLocation = {
  id: string;
  name: string;
  address?: SdclAddress;
};

type SdclEventType = {
  id: string;
  name: string;
};

type SdclEventDefinition = {
  start: string;
  end?: string | null;
  title: string;
  description?: string | null;
  branchLocationId?: string | null;
  nonBranchLocationId?: string | null;
  locationDetails?: string | null;
  typeIds?: string[];
  isCancelled?: boolean;
  isVirtual?: boolean;
};

type SdclEventEntity = {
  id: string;
  definition: SdclEventDefinition;
};

type SdclSearchResponse = {
  events?: {
    results?: string[];
    pagination?: { count?: number; page?: number; pages?: number; limit?: number };
  };
  entities?: {
    events?: Record<string, SdclEventEntity>;
    eventTypes?: Record<string, SdclEventType>;
    locations?: Record<string, SdclLocation>;
  };
};

export type SdclLibraryMeta = {
  fetchedPages: number;
  rawCount: number;
  keptCount: number;
  rowsInMonth: number;
};

function formatAddress(loc: SdclLocation | undefined): string | undefined {
  if (!loc) return undefined;
  const a = loc.address;
  if (!a) return loc.name;
  const line1 = [a.number, a.street].filter(Boolean).join(" ").trim();
  const cityStateZip = [a.city, [a.state, a.zip].filter(Boolean).join(" ")]
    .filter(Boolean)
    .join(", ");
  return [line1, cityStateZip].filter(Boolean).join(", ") || loc.name;
}

function categoryFor(
  title: string,
  typeNames: string[],
): WorkshopEventCategory {
  const blob = `${title}\n${typeNames.join("\n")}`.toLowerCase();
  if (/\bopen\s*mic\b|\bpoetry\s*slam\b/.test(blob)) return "open-mic";
  if (
    /\bworkshop\b|\bwriters?\s+group\b|\bwriting\s+(?:club|group|workshop)\b|\bpoet/.test(
      blob,
    )
  ) {
    return "workshop";
  }
  if (typeNames.includes("Author Visit") || /\bauthor\b/.test(blob)) {
    return "reading";
  }
  if (typeNames.includes("Book Club") || /\bbook club\b/.test(blob)) {
    return "reading";
  }
  if (typeNames.includes("Writing & Poetry")) return "workshop";
  return "other";
}

/**
 * Keep book clubs, writing groups/workshops, author talks / literary programs.
 * Drop book sales, FOL admin meetings, storytimes, and non-literary FOL events.
 */
export function isLiterarySdclListing(
  title: string,
  typeNames: string[],
): boolean {
  const t = title.toLowerCase().trim();

  if (
    /\bbook\s*sale\b|\bbooksale\b|\bbag o['’]? books\b|\bbuck-a-bag\b|\bencore bookstore\b|\bhalf-?off\b/.test(
      t,
    )
  ) {
    return false;
  }

  if (
    /\bfriends of the .+ meeting\b|\bfol meeting\b/.test(t) &&
    !/\bbook club\b/.test(t)
  ) {
    return false;
  }

  // Pure storytime / non-literary performance readings for toddlers etc.
  if (
    typeNames.includes("Storytime") &&
    !/\bbook club\b|\bwriter|\bwriting\b|\bauthor\b|\bpoet/.test(t)
  ) {
    return false;
  }

  if (
    typeNames.includes("Book Club") ||
    typeNames.includes("Writing & Poetry") ||
    typeNames.includes("Author Visit")
  ) {
    return true;
  }

  // FOL-hosted literary programs (e.g. author visits tagged Friends)
  if (typeNames.includes("Friends of the Library")) {
    return /\b(book club|author|poet|writer|writing|literary|reading)\b/.test(t);
  }

  return /\b(book club|writers?\s+group|writing\s+(?:club|group|workshop)|author|poet|memoir)\b/.test(
    t,
  );
}

function parseLocalDateTime(local: string): DateTime | null {
  const dt = DateTime.fromISO(local, { zone: TZ });
  return dt.isValid ? dt : null;
}

function mapEvent(
  entity: SdclEventEntity,
  locations: Record<string, SdclLocation>,
  eventTypes: Record<string, SdclEventType>,
): WorkshopEvent | null {
  const def = entity.definition;
  if (def.isCancelled) return null;

  const typeNames = (def.typeIds ?? [])
    .map((id) => eventTypes[id]?.name)
    .filter((n): n is string => Boolean(n));

  if (!isLiterarySdclListing(def.title, typeNames)) return null;

  const start = parseLocalDateTime(def.start);
  if (!start) return null;
  const end = def.end ? parseLocalDateTime(def.end) : null;

  const locId = def.branchLocationId ?? def.nonBranchLocationId ?? undefined;
  const loc = locId ? locations[String(locId)] : undefined;
  const venue = loc?.name ?? "San Diego County Library";
  const address = formatAddress(loc);
  const description = def.description
    ? toShortOverview(
        stripHtmlAndDecode(def.description)
          // Fix ordinals split across tags: "7</strong><strong>th" → "7th"
          .replace(/(\d)\s*th\b/gi, "$1th")
          .replace(/(\d)\s*st\b/gi, "$1st")
          .replace(/(\d)\s*nd\b/gi, "$1nd")
          .replace(/(\d)\s*rd\b/gi, "$1rd")
          .replace(/\s+/g, " ")
          .trim(),
        600,
      )
    : `${stripHtmlAndDecode(def.title).trim()} at ${venue}.`;

  // Infer free when copy says so; SDCL literary programs are generally free.
  const aboutLower = description.toLowerCase();
  const mentionsPaid =
    /\$\s*\d+|admission\s*fee|ticket\s*price|cost\s*is|non-?member/i.test(
      description,
    );
  const mentionsFree = /\bfree\b/.test(aboutLower);
  const price: WorkshopEvent["price"] =
    mentionsPaid && !mentionsFree ? "paid" : "free";
  const priceDetail =
    mentionsFree && mentionsPaid
      ? undefined
      : mentionsPaid
        ? undefined
        : "Free";

  const category = categoryFor(def.title, typeNames);
  const typeLabel =
    typeNames.find((n) =>
      ["Book Club", "Writing & Poetry", "Author Visit"].includes(n),
    ) ??
    typeNames[0] ??
    "Library event";
  const isVirtual = Boolean(def.isVirtual);

  return {
    id: `sd-sdcl-${entity.id}`,
    cityId: "sd",
    title: stripHtmlAndDecode(def.title).trim(),
    tagline: `San Diego County Library · ${venue} · ${typeLabel} · ${
      price === "free" ? "Free" : "See listing"
    }`,
    description,
    start: start.toISO()!,
    end: (end ?? start.plus({ hours: 1 })).toISO()!,
    timeZone: TZ,
    format: isVirtual ? "virtual" : "in-person",
    price,
    priceDetail,
    category,
    organizer: "San Diego County Library",
    venue,
    address,
    neighborhood: loc?.address?.city?.trim() || "San Diego County",
    virtualLabel: isVirtual ? "Virtual (SDCL)" : undefined,
    rsvpUrl: `${PUBLIC_ORIGIN}/events/${entity.id}`,
    source: "San Diego County Library",
    sourceChannel: "library",
    listingProvenance: "live",
  };
}

async function fetchSearchPage(
  year: number,
  monthIndex: number,
  page: number,
): Promise<SdclSearchResponse> {
  const start = DateTime.fromObject(
    { year, month: monthIndex + 1, day: 1 },
    { zone: TZ },
  );
  const end = start.endOf("month");
  const params = new URLSearchParams();
  for (const t of SDCL_TYPE_IDS) params.append("types", t);
  for (const a of SDCL_AUDIENCE_IDS) params.append("audiences", a);
  for (const l of SDCL_LANGUAGE_IDS) params.append("languages", l);
  params.set("startDate", start.toFormat("yyyy-LL-dd"));
  params.set("endDate", end.toFormat("yyyy-LL-dd"));
  params.set("page", String(page));
  params.set("limit", String(PAGE_LIMIT));

  const url = `${GATEWAY}/libraries/${LIBRARY_SUBDOMAIN}/events/search?${params}`;
  const res = await fetch(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": "TheLitList/1.0 (+literary calendar aggregator)",
    },
    next: { revalidate: 600 },
  });
  if (!res.ok) {
    throw new Error(`SDCL events search failed: HTTP ${res.status}`);
  }
  return (await res.json()) as SdclSearchResponse;
}

export async function fetchSdclLibraryEventsForMonth(
  year: number,
  monthIndex: number,
): Promise<{ events: WorkshopEvent[]; meta: SdclLibraryMeta }> {
  const events: WorkshopEvent[] = [];
  let page = 1;
  let pages = 1;
  let rawCount = 0;
  let fetchedPages = 0;

  while (page <= pages && page <= MAX_PAGES) {
    const body = await fetchSearchPage(year, monthIndex, page);
    fetchedPages += 1;
    const ids = body.events?.results ?? [];
    const entities = body.entities?.events ?? {};
    const locations = body.entities?.locations ?? {};
    const eventTypes = body.entities?.eventTypes ?? {};
    const pag = body.events?.pagination;
    if (pag?.pages) pages = pag.pages;
    if (typeof pag?.count === "number") rawCount = pag.count;

    for (const id of ids) {
      const entity = entities[id];
      if (!entity) continue;
      const mapped = mapEvent(entity, locations, eventTypes);
      if (!mapped) continue;
      const start = DateTime.fromISO(mapped.start, { setZone: true });
      if (start.year !== year || start.month !== monthIndex + 1) continue;
      events.push(mapped);
    }

    if (!ids.length) break;
    page += 1;
  }

  events.sort((a, b) => a.start.localeCompare(b.start));
  return {
    events,
    meta: {
      fetchedPages,
      rawCount,
      keptCount: events.length,
      rowsInMonth: events.length,
    },
  };
}
