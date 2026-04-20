import type {
  EventFilters,
  EventFormat,
  PriceKind,
  WorkshopEvent,
  WorkshopEventCategory,
} from "@/lib/workshop-types";
import { DateTime } from "luxon";

const ALL_FORMATS: EventFormat[] = ["in-person", "virtual", "hybrid"];
const ALL_PRICES: PriceKind[] = ["free", "paid", "unknown"];

function parseStart(ev: WorkshopEvent): number {
  const dt = DateTime.fromISO(ev.start, { setZone: true });
  const zoned = ev.timeZone ? dt.setZone(ev.timeZone) : dt.toLocal();
  return zoned.isValid ? zoned.toMillis() : new Date(ev.start).getTime();
}

function dayStartMs(isoDate: string, zone: string): number {
  const dt = DateTime.fromISO(isoDate, { zone }).startOf("day");
  return dt.isValid ? dt.toMillis() : new Date(isoDate + "T00:00:00").getTime();
}

function dayEndMs(isoDate: string, zone: string): number {
  const dt = DateTime.fromISO(isoDate, { zone }).endOf("day");
  return dt.isValid ? dt.toMillis() : new Date(isoDate + "T23:59:59.999").getTime();
}

export function eventOccursInRange(
  ev: WorkshopEvent,
  rangeStart: string,
  rangeEnd: string,
): boolean {
  const t = parseStart(ev);
  const zone = ev.timeZone ?? DateTime.local().zoneName;
  return t >= dayStartMs(rangeStart, zone) && t <= dayEndMs(rangeEnd, zone);
}

export function matchesSearch(ev: WorkshopEvent, q: string): boolean {
  if (!q.trim()) return true;
  const s = q.trim().toLowerCase();
  const hay = [
    ev.title,
    ev.tagline,
    ev.description,
    ev.organizer,
    ev.venue,
    ev.address,
    ev.neighborhood,
    ev.virtualLabel,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return hay.includes(s);
}

function effectiveFormats(filters: EventFilters): Set<EventFormat> {
  return filters.formats.size === 0
    ? new Set(ALL_FORMATS)
    : filters.formats;
}

function effectivePrices(filters: EventFilters): Set<PriceKind> {
  return filters.prices.size === 0 ? new Set(ALL_PRICES) : filters.prices;
}

export function applyEventFilters(
  events: WorkshopEvent[],
  filters: EventFilters,
  search: string,
): WorkshopEvent[] {
  const fmt = effectiveFormats(filters);
  const price = effectivePrices(filters);
  return events.filter((ev) => {
    if (!fmt.has(ev.format)) return false;
    if (!price.has(ev.price)) return false;
    if (filters.categoryIncluded !== null) {
      if (
        filters.categoryIncluded.size === 0 ||
        !filters.categoryIncluded.has(ev.category)
      ) {
        return false;
      }
    }
    if (
      filters.neighborhood &&
      (ev.neighborhood ?? "").toLowerCase() !==
        filters.neighborhood.toLowerCase()
    ) {
      return false;
    }
    if (!eventOccursInRange(ev, filters.rangeStart, filters.rangeEnd)) {
      return false;
    }
    if (!matchesSearch(ev, search)) return false;
    return true;
  });
}

export function distinctNeighborhoods(events: WorkshopEvent[]): string[] {
  const set = new Set<string>();
  for (const e of events) {
    if (e.neighborhood?.trim()) set.add(e.neighborhood.trim());
  }
  return [...set].sort((a, b) => a.localeCompare(b));
}

export function distinctCategories(
  events: WorkshopEvent[],
): WorkshopEventCategory[] {
  const set = new Set<WorkshopEventCategory>();
  for (const e of events) set.add(e.category);
  return [...set].sort((a, b) => a.localeCompare(b));
}

export function monthRangeISO(year: number, monthIndex: number): {
  start: string;
  end: string;
} {
  const start = new Date(year, monthIndex, 1);
  const end = new Date(year, monthIndex + 1, 0);
  const pad = (n: number) => String(n).padStart(2, "0");
  const iso = (d: Date) =>
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  return { start: iso(start), end: iso(end) };
}
