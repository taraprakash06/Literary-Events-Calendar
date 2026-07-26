import { DateTime } from "luxon";
import type { WorkshopEvent, WorkshopEventCategory } from "@/lib/workshop-types";
import { stripHtmlAndDecode, toShortOverview } from "@/lib/text";

const TZ = "America/Chicago";
const LIBRARY_SUBDOMAIN = "omaha";
const GATEWAY = "https://gateway.bibliocommons.com/v2";
const PUBLIC_ORIGIN = "https://omaha.bibliocommons.com";

/**
 * Author Visit, Book Clubs, Writers & Storytelling, Reading —
 * same filters as the OPL BiblioCommons literary events view.
 */
export const OPL_LITERARY_TYPE_IDS = [
  "579a63ae088ca2de7101bea9", // Author Visit
  "579a63be088ca2de7101beaa", // Book Clubs
  "5877db554e5fc23400933eda", // Writers & Storytelling
  "582a2ae4dc485501008818d7", // Reading
] as const;

const PAGE_LIMIT = 50;
const MAX_PAGES = 8;

type OplAddress = {
  country?: string;
  zip?: string;
  state?: string;
  city?: string;
  street?: string;
  number?: string;
};

type OplLocation = {
  id: string;
  name: string;
  address?: OplAddress;
};

type OplEventType = {
  id: string;
  name: string;
};

type OplEventDefinition = {
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

type OplEventEntity = {
  id: string;
  definition: OplEventDefinition;
};

type OplSearchResponse = {
  events?: {
    results?: string[];
    pagination?: { count?: number; page?: number; pages?: number; limit?: number };
  };
  entities?: {
    events?: Record<string, OplEventEntity>;
    eventTypes?: Record<string, OplEventType>;
    locations?: Record<string, OplLocation>;
  };
};

export type OmahaPublicLibraryMeta = {
  fetchedPages: number;
  rawCount: number;
  keptCount: number;
  rowsInMonth: number;
};

function formatAddress(loc: OplLocation | undefined): string | undefined {
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
  if (/\bopen\s*mic\b|\bpoetry\s*slam\b|\bslam\b/.test(blob)) return "open-mic";
  if (/\bworkshop\b|\bwriting club\b|\bwriters?\s+group\b/.test(blob)) return "workshop";
  if (typeNames.includes("Author Visit") || /\bauthor\b|\breading\b|\bpoetry\b/.test(blob)) {
    if (/\bbook club\b/.test(blob)) return "other";
    if (typeNames.includes("Author Visit") || /\bauthor visit\b|\bauthor\b/.test(blob)) {
      return "reading";
    }
  }
  if (typeNames.includes("Writers & Storytelling") && !/\bbook club\b/.test(blob)) {
    return "workshop";
  }
  return "other";
}

/** Drop crafting, D&D, storytimes, and other non-literary programming. */
export function isLiteraryOplListing(title: string, typeNames: string[]): boolean {
  const t = title.toLowerCase();
  if (
    /\bd\s*&\s*d\b|\bdungeons\b|\bpen and the sword\b|\bcraft(ing|s)?\b|\bstorytime\b|\bescape room\b|\bseed library\b|\bgaming\b|\bpuppet|\bplushie\b|\bmurder mystery party\b|\bghosts?\b/.test(
      t,
    )
  ) {
    return false;
  }

  if (typeNames.includes("Book Clubs") || typeNames.includes("Author Visit")) {
    return true;
  }

  if (typeNames.includes("Reading")) {
    // Keep reading parties / literacy readings; drop crafts already handled above.
    return /\bread|\bbook|\blitera|\bauthor|\bpoet/.test(t);
  }

  if (typeNames.includes("Writers & Storytelling")) {
    return /\b(writers?\s+workshop|writing\s+club|writers?\s+club|writer'?s?\s+workshop|open\s*mic|poetry|memoir|fiction|novel|author|creative writing|writing your|workshop for kids|storytell|\bstories\b)/.test(
      t,
    );
  }

  return false;
}

function parseLocalDateTime(local: string): DateTime | null {
  // "2026-07-27T18:30" or "2026-07-27T18:30:00"
  const dt = DateTime.fromISO(local, { zone: TZ });
  return dt.isValid ? dt : null;
}

function mapEvent(
  entity: OplEventEntity,
  locations: Record<string, OplLocation>,
  eventTypes: Record<string, OplEventType>,
): WorkshopEvent | null {
  const def = entity.definition;
  if (def.isCancelled) return null;

  const typeNames = (def.typeIds ?? [])
    .map((id) => eventTypes[id]?.name)
    .filter((n): n is string => Boolean(n));

  if (!isLiteraryOplListing(def.title, typeNames)) return null;

  const start = parseLocalDateTime(def.start);
  if (!start) return null;
  const end = def.end ? parseLocalDateTime(def.end) : null;

  const locId = def.branchLocationId ?? def.nonBranchLocationId ?? undefined;
  const loc = locId ? locations[String(locId)] : undefined;
  const venue = loc?.name ?? "Omaha Public Library";
  const address = formatAddress(loc);
  const description = def.description
    ? toShortOverview(stripHtmlAndDecode(def.description), 600)
    : `${def.title} at ${venue}.`;

  const category = categoryFor(def.title, typeNames);
  const typeLabel = typeNames[0] ?? "Library event";
  const isVirtual = Boolean(def.isVirtual);

  return {
    id: `ne-opl-${entity.id}`,
    cityId: "ne",
    title: stripHtmlAndDecode(def.title).trim(),
    tagline: `Omaha Public Library · ${venue} · ${typeLabel} · Free`,
    description,
    start: start.toISO()!,
    end: (end ?? start.plus({ hours: 1 })).toISO()!,
    timeZone: TZ,
    format: isVirtual ? "virtual" : "in-person",
    price: "free",
    category,
    organizer: "Omaha Public Library",
    venue,
    address,
    neighborhood: loc?.address?.city?.trim() || "Omaha",
    rsvpUrl: `${PUBLIC_ORIGIN}/events/${entity.id}`,
    source: "Omaha Public Library",
    sourceChannel: "library",
    listingProvenance: "live",
  };
}

async function fetchSearchPage(
  year: number,
  monthIndex: number,
  page: number,
): Promise<OplSearchResponse> {
  const start = DateTime.fromObject(
    { year, month: monthIndex + 1, day: 1 },
    { zone: TZ },
  );
  const end = start.endOf("month");
  const params = new URLSearchParams();
  for (const t of OPL_LITERARY_TYPE_IDS) params.append("types", t);
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
    throw new Error(`OPL events search failed: HTTP ${res.status}`);
  }
  return (await res.json()) as OplSearchResponse;
}

export async function fetchOmahaPublicLibraryEventsForMonth(
  year: number,
  monthIndex: number,
): Promise<{ events: WorkshopEvent[]; meta: OmahaPublicLibraryMeta }> {
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
      // Ensure month match (API date filter is inclusive but timezone-safe here).
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
