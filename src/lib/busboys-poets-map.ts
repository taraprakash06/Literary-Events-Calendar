import type { BusboysEventsMoreRow } from "@/lib/busboys-poets-client";
import { BUSBOYS_POETS_TIMEZONE } from "@/lib/busboys-poets-client";
import type { EventFormat, WorkshopEvent, WorkshopEventCategory } from "@/lib/workshop-types";
import { DateTime } from "luxon";
import { decodeHtmlEntities, toShortOverview } from "@/lib/text";

/** Venue codes from busboysandpoets.com/events (see /contactus/). */
const BUSBOYS_VENUE_ADDRESSES: Record<string, string> = {
  "14th & V": "2021 14th Street NW, Washington, District of Columbia, 20009",
  "450K": "450 K St NW, Washington, District of Columbia, 20001",
  Anacostia: "2004 Martin Luther King Jr Ave SE, Washington, District of Columbia, 20020",
  Brookland: "625 Monroe St NE, Washington, District of Columbia, 20017",
  Columbia: "6251 Mango Tree Road, Columbia, Maryland, 21044",
  Hyattsville: "5331 Baltimore Avenue, Hyattsville, Maryland, 20781",
  Shirlington: "4251 Campbell Avenue, Arlington, Virginia, 22206",
  Takoma: "235 Carroll St NW, Washington, District of Columbia, 20012",
  Baltimore: "3224 St. Paul Street, Baltimore, Maryland, 21218",
};

function busboysVenueAddress(venueCode: string): string | undefined {
  const key = venueCode.trim();
  if (!key) return undefined;
  return BUSBOYS_VENUE_ADDRESSES[key];
}

function cleanTitle(raw: string): string {
  return decodeHtmlEntities(raw).replace(/\s+/g, " ").trim();
}

function parseStartLocal(row: BusboysEventsMoreRow): DateTime | null {
  const raw = (row.date ?? "").trim();
  if (!raw) return null;
  const dt = DateTime.fromFormat(raw, "LLL d, yyyy h:mm a", {
    zone: BUSBOYS_POETS_TIMEZONE,
  });
  return dt.isValid ? dt : null;
}

function mapCategory(catRaw: string | undefined): WorkshopEventCategory {
  const c = (catRaw ?? "").toLowerCase();
  if (c.includes("book") || c.includes("author")) return "reading";
  if (c.includes("open mic") || c.includes("poetry")) return "open-mic";
  if (c.includes("panel") || c.includes("discussion")) return "other";
  if (c.includes("workshop")) return "workshop";
  if (c.includes("festival")) return "other";
  if (c.includes("launch") || c.includes("signing")) return "reading";
  if (c.includes("performance") || c.includes("theater") || c.includes("theatre"))
    return "other";
  return "other";
}

function mapFormat(row: BusboysEventsMoreRow): EventFormat {
  const blob = `${row.name} ${row.category ?? ""} ${row.venue ?? ""}`.toLowerCase();
  if (/\bzoom\b|\bvirtual\b|\bonline only\b|\bwebinar\b/.test(blob)) return "virtual";
  return "in-person";
}

function shouldExclude(row: BusboysEventsMoreRow): boolean {
  const n = cleanTitle(row.name).toLowerCase();
  const c = (row.category ?? "").toLowerCase();
  const blob = `${n} ${c}`;

  if (n.includes("cancelled")) return true;
  if (n.includes("private event")) return true;
  if (n.includes("admin staff")) return true;
  if (n.includes("staff retreat")) return true;
  if (
    c.includes("performance") ||
    c.includes("theater") ||
    c.includes("theatre")
  ) {
    return true;
  }

  const literaryCue =
    /\b(book|author|poet|poetry|reading|writer|writing|literary|open\s*mic|memoir|novel|essay|storytime|story\s*time|publish|manuscript|workshop)\b/.test(
      blob,
    );

  // Career / school recruiting and networking nights are common at Busboys
  // but are not literary programming.
  if (
    /\b(law\s+school|graduate\s+school|grad\s+school|law\s+&\s+graduate|admissions|career\s+fair|job\s+fair|recruiting|info\s+session)\b/.test(
      blob,
    ) &&
    !literaryCue
  ) {
    return true;
  }
  if (
    (/\bmeet\s*and\s*greet\b/.test(blob) || /\bnetworking\b/.test(blob)) &&
    !literaryCue
  ) {
    return true;
  }

  return false;
}

export function mapBusboysRowToWorkshop(
  row: BusboysEventsMoreRow,
  opts: {
    monthStart: DateTime;
    monthEnd: DateTime;
    /** Full title from event page when API name is truncated with &hellip; */
    titleOverride?: string;
    /**
     * End time only when confirmed (flyer override or page copy). Omit the
     * former invented +2h default — Busboys CMS ends are often inaccurate.
     */
    endISO?: string;
  },
): WorkshopEvent | null {
  if (shouldExclude(row)) return null;

  const start = parseStartLocal(row);
  if (!start) return null;
  if (start < opts.monthStart || start > opts.monthEnd) return null;

  const title = cleanTitle(opts.titleOverride ?? row.name).replace(/\u2026\s*$/g, "").trim();
  if (!title) return null;

  const catLabel = (row.category ?? "").replace(/\|\s*$/g, "").trim();
  const venuePart = (row.venue ?? "").trim();
  const tagline = [catLabel, venuePart].filter(Boolean).join(" · ");

  const venue = venuePart
    ? `Busboys and Poets — ${venuePart}`
    : "Busboys and Poets";

  const category = mapCategory(catLabel);
  const format = mapFormat(row);

  return {
    id: `busboys-poets-${row.ID}`,
    cityId: "dmv",
    title,
    tagline: tagline ? toShortOverview(tagline, 200) : "",
    description:
      toShortOverview(
        tagline ? `${title}. ${tagline}.` : title,
        360,
      ) || "Details on the Busboys and Poets website.",
    start: start.toISO() ?? start.toUTC().toISO() ?? start.toString(),
    end: opts.endISO,
    timeZone: BUSBOYS_POETS_TIMEZONE,
    format,
    price: "unknown",
    category,
    organizer: "Busboys and Poets",
    venue,
    address: busboysVenueAddress(venuePart),
    virtualLabel: format === "virtual" ? "Online" : undefined,
    rsvpUrl: row.url?.trim() || undefined,
    source: "Busboys and Poets (busboysandpoets.com)",
    sourceChannel: "literary_org",
    listingProvenance: "live",
  };
}
