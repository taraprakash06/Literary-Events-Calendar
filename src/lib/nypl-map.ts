import type { NyplRawRow } from "@/lib/nypl-calendar";
import {
  NYPL_ORIGIN,
  datePartsFromPath,
  parseNyplClassWhenCell,
  parseNyplWhenToStart,
  slugFromProgramPath,
} from "@/lib/nypl-calendar";
import type { EventFormat, WorkshopEvent, WorkshopEventCategory } from "@/lib/workshop-types";
import { stripHtmlAndDecode, toShortOverview } from "@/lib/text";

function mapCategory(row: NyplRawRow): WorkshopEventCategory {
  const b = `${row.title} ${slugFromProgramPath(row.programPath)}`.toLowerCase();
  if (/\bopen mic\b/.test(b)) return "open-mic";
  if (/\b(workshop|writing|writers?|poetry class|memoir)\b/.test(b)) return "workshop";
  if (/\b(reading|author|novel|storytime|story time|poets?\s+out)\b/.test(b)) {
    return "reading";
  }
  if (/\b(book club|book discussion)\b/.test(b)) return "other";
  return "other";
}

function mapFormat(row: NyplRawRow): EventFormat {
  const b = `${row.title}\n${row.locationCell}\n${row.description ?? ""}`.toLowerCase();
  if (
    /\bonline only\b|\bvia zoom\b|\bonline via\b|\bvirtual\b|\btake place virtually\b/.test(
      b,
    )
  ) {
    if (/\bin-person\b|\bbranch\b|\blibrary\b/.test(b) && !/\bonline only\b/.test(b)) {
      return "hybrid";
    }
    return "virtual";
  }
  if (/\bauditorium online\b/.test(b)) return "hybrid";
  return "in-person";
}

/** Year hint for class when-cells that omit the year. */
function dateTimeHintYear(row: NyplRawRow): number {
  const p = datePartsFromPath(row.programPath);
  if (p?.y) return p.y;
  return new Date().getFullYear();
}

export function mapNyplRowToWorkshop(
  row: NyplRawRow,
  yearHint?: number,
): WorkshopEvent | null {
  if (row.canceled) return null;

  const year = yearHint ?? dateTimeHintYear(row);
  // Prefer occurrence date from classes calendar "Mon, July 27 @ 2 PM" cells.
  const classStart = parseNyplClassWhenCell(row.whenCell, year);
  const parts = datePartsFromPath(row.programPath);
  const start = classStart?.isValid
    ? classStart
    : parts
      ? parseNyplWhenToStart(row, parts)
      : null;
  if (!start || !start.isValid) return null;

  const end = start.plus({ hours: 1 });

  const venue = row.locationCell?.trim() || "The New York Public Library";
  const format = mapFormat(row);
  const rsvpUrl = `${NYPL_ORIGIN}${row.programPath}`;

  const descSource = row.description?.trim() || row.title;
  const desc = toShortOverview(descSource, 420) || row.title;
  const slugTitle = slugFromProgramPath(row.programPath).replace(/-/g, " ");
  const title =
    row.title.trim().length >= 8 ? row.title.trim() : stripHtmlAndDecode(slugTitle);

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
