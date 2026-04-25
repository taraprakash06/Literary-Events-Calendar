import type { NyplRawRow } from "@/lib/nypl-calendar";
import {
  NYPL_ORIGIN,
  datePartsFromPath,
  parseNyplWhenToStart,
  slugFromProgramPath,
} from "@/lib/nypl-calendar";
import type { EventFormat, WorkshopEvent, WorkshopEventCategory } from "@/lib/workshop-types";
import { stripHtmlAndDecode, toShortOverview } from "@/lib/text";

function mapCategory(row: NyplRawRow): WorkshopEventCategory {
  const b = `${row.title} ${slugFromProgramPath(row.programPath)}`.toLowerCase();
  if (/\bopen mic\b/.test(b)) return "open-mic";
  if (/\b(book club|book discussion|reading|author|novel|memoir|storytime|story time)\b/.test(b))
    return "book-club";
  if (/\b(workshop|writing)\b/.test(b)) return "workshop";
  if (/\b(panel|lecture|conversation|seminar|conference)\b/.test(b)) return "panel";
  if (/\b(festival|bookfest|history day)\b/.test(b)) return "festival";
  return "reading";
}

function mapFormat(row: NyplRawRow): EventFormat {
  const b = `${row.title}\n${row.locationCell}`.toLowerCase();
  if (/\bonline only\b|\bvia zoom\b|\bonline via\b|\bvirtual\b/.test(b)) {
    if (/\bin-person\b|\bbranch\b|\blibrary\b/.test(b) && !/\bonline only\b/.test(b)) return "hybrid";
    return "virtual";
  }
  return "in-person";
}

export function mapNyplRowToWorkshop(row: NyplRawRow): WorkshopEvent | null {
  const parts = datePartsFromPath(row.programPath);
  if (!parts) return null;

  const start = parseNyplWhenToStart(row, parts);
  if (!start || !start.isValid) return null;

  const end = start.plus({ hours: 1 });

  const venue = row.locationCell?.trim() || "The New York Public Library";
  const format = mapFormat(row);
  const rsvpUrl = `${NYPL_ORIGIN}${row.programPath}`;

  const desc = toShortOverview(row.title, 280) || row.title;
  const slugTitle = slugFromProgramPath(row.programPath).replace(/-/g, " ");
  const title =
    row.title.trim().length >= 12 ? row.title.trim() : stripHtmlAndDecode(slugTitle);

  return {
    id: `nypl-${slugFromProgramPath(row.programPath)}-${start.toFormat("yyyyLLddHHmm")}`,
    cityId: "nyc",
    title,
    tagline: row.locationCell ? toShortOverview(row.locationCell, 200) : "",
    description: desc,
    start: start.toISO() ?? start.toUTC().toISO() ?? start.toString(),
    end: end.toISO() ?? undefined,
    timeZone: "America/New_York",
    format,
    price: "free",
    category: mapCategory(row),
    organizer: "The New York Public Library",
    venue,
    virtualLabel:
      format === "virtual" ? "Online" : format === "hybrid" ? "Hybrid" : undefined,
    rsvpUrl,
    source: "The New York Public Library (nypl.org)",
    sourceChannel: "library",
    listingProvenance: "live",
  };
}
