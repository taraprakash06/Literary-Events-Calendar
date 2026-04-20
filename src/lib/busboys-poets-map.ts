import type { BusboysEventsMoreRow } from "@/lib/busboys-poets-client";
import { BUSBOYS_POETS_TIMEZONE } from "@/lib/busboys-poets-client";
import type { EventFormat, WorkshopEvent, WorkshopEventCategory } from "@/lib/workshop-types";
import { DateTime } from "luxon";
import { decodeHtmlEntities, toShortOverview } from "@/lib/text";

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
  if (c.includes("panel") || c.includes("discussion")) return "panel";
  if (c.includes("workshop")) return "workshop";
  if (c.includes("festival")) return "festival";
  if (c.includes("launch") || c.includes("signing")) return "launch";
  if (c.includes("performance") || c.includes("theater") || c.includes("theatre"))
    return "theater";
  return "other";
}

function mapFormat(row: BusboysEventsMoreRow): EventFormat {
  const blob = `${row.name} ${row.category ?? ""} ${row.venue ?? ""}`.toLowerCase();
  if (/\bzoom\b|\bvirtual\b|\bonline only\b|\bwebinar\b/.test(blob)) return "virtual";
  return "in-person";
}

function shouldExclude(row: BusboysEventsMoreRow): boolean {
  const n = cleanTitle(row.name).toLowerCase();
  if (n.includes("cancelled")) return true;
  if (n.includes("private event")) return true;
  if (n.includes("admin staff")) return true;
  if (n.includes("staff retreat")) return true;
  return false;
}

export function mapBusboysRowToWorkshop(
  row: BusboysEventsMoreRow,
  opts: { monthStart: DateTime; monthEnd: DateTime },
): WorkshopEvent | null {
  if (shouldExclude(row)) return null;

  const start = parseStartLocal(row);
  if (!start) return null;
  if (start < opts.monthStart || start > opts.monthEnd) return null;

  const title = cleanTitle(row.name);
  if (!title) return null;

  const catLabel = (row.category ?? "").replace(/\|\s*$/g, "").trim();
  const venuePart = (row.venue ?? "").trim();
  const tagline = [catLabel, venuePart].filter(Boolean).join(" · ");

  const venue = venuePart
    ? `Busboys and Poets — ${venuePart}`
    : "Busboys and Poets";

  const category = mapCategory(catLabel);
  const format = mapFormat(row);

  const end = start.plus({ hours: 2 });

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
    end: end.toISO() ?? undefined,
    timeZone: BUSBOYS_POETS_TIMEZONE,
    format,
    price: "unknown",
    category,
    organizer: "Busboys and Poets",
    venue,
    virtualLabel: format === "virtual" ? "Online" : undefined,
    rsvpUrl: row.url?.trim() || undefined,
    source: "Busboys and Poets (busboysandpoets.com)",
    sourceChannel: "literary_org",
    listingProvenance: "live",
  };
}
