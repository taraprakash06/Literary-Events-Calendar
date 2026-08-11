import { isFilmOnlyWorkshopEvent, isTheaterWorkshopEvent, isVisualArtOnlyWorkshopEvent } from "@/lib/event-category";
import type {
  EventFilters,
  EventFormat,
  PriceKind,
  WorkshopEvent,
  WorkshopEventCategory,
} from "@/lib/workshop-types";
import { DateTime } from "luxon";

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

function eventAccessCopyBlob(ev: WorkshopEvent): string {
  return [ev.title, ev.tagline, ev.description, ev.priceDetail]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .replace(/\s+/g, " ");
}

/** True when About / price copy says the event is free to attend. */
export function eventCopySaysFree(ev: WorkshopEvent): boolean {
  const blob = eventAccessCopyBlob(ev);
  if (/\bnot free\b/.test(blob) || /\bfree with (?:purchase|ticket)\b/.test(blob)) {
    return false;
  }
  return (
    /\bfree to attend\b/.test(blob) ||
    /\bfree(?:\s+and\s+open)?(?:\s+to\s+the\s+public)?[.;,]?\s*(?:please\s+)?rsvp\b/.test(
      blob,
    ) ||
    /\bfree[.;,]?\s*please rsvp\b/.test(blob) ||
    /\bfree · registration required\b/.test(blob) ||
    /\bfree[^.]{0,48}registration(?:\s+is)?\s+required\b/.test(blob) ||
    /\bfree of charge\b/.test(blob) ||
    /\bno (?:cost|charge|fee|ticket(?:s)? required)\b/.test(blob) ||
    /\bcomplimentary\b/.test(blob)
  );
}

/**
 * Text in title / About / price that implies advance RSVP or registration.
 */
function eventCopyImpliesAdvanceRegistration(ev: WorkshopEvent): boolean {
  const blob = eventAccessCopyBlob(ev);

  if (
    /\bno (?:registration|rsvp) (?:required|necessary|needed)\b/.test(blob) ||
    /\bregistration not required\b/.test(blob)
  ) {
    return false;
  }

  return (
    /\bpre-?registration(?:\s+is)?(?:\s+required)?\b/.test(blob) ||
    /\b(?:advance\s+)?registration(?:\s+is)?\s+required\b/.test(blob) ||
    /\brsvp(?:\s+is)?\s+required\b/.test(blob) ||
    /\bplease rsvp\b/.test(blob) ||
    /\bmust rsvp\b/.test(blob) ||
    /\brsvp to (?:attend|reserve|hold|secure)\b/.test(blob) ||
    /\bregister (?:in advance|ahead(?: of time)?|online|today)\b/.test(blob) ||
    /\bregister to (?:attend|perform|participate)\b/.test(blob) ||
    /\bregistration is capped\b/.test(blob) ||
    /\brsvp required to receive (?:the )?zoom\b/.test(blob) ||
    (/\bspace is limited\b/.test(blob) && /\brsvp\b/.test(blob)) ||
    /\bfree[^.]{0,48}registration(?:\s+is)?\s+required\b/.test(blob) ||
    /\bfree · registration required\b/.test(blob) ||
    /\bfree · please rsvp\b/.test(blob) ||
    /\bfree to attend[.;,]?\s*please rsvp\b/.test(blob) ||
    /\btickets? are \$\d+/.test(blob) ||
    /\b(?:buy|purchase) (?:your )?tickets?\b/.test(blob) ||
    /\bregister early if you (?:are )?planning on attending\b/.test(blob)
  );
}

/** True when the listing has a direct event RSVP / registration URL (not a general calendar). */
export function eventHasRegistrationOrRsvpLink(ev: WorkshopEvent): boolean {
  const url = ev.rsvpUrl?.trim();
  if (!url) return false;
  if (ev.rsvpIsGeneralCalendar) return false;
  return true;
}

/**
 * Whether the listing asks people to register or RSVP ahead of time
 * (not same-day door signup alone), or provides a registration/RSVP link.
 */
export function eventRequiresAdvanceRegistration(ev: WorkshopEvent): boolean {
  if (ev.registrationRequired === true) return true;
  if (ev.registrationRequired === false) return false;

  const blob = eventAccessCopyBlob(ev);
  if (
    /\bno (?:registration|rsvp) (?:required|necessary|needed)\b/.test(blob) ||
    /\bregistration not required\b/.test(blob)
  ) {
    return false;
  }

  if (eventCopyImpliesAdvanceRegistration(ev)) return true;
  if (eventHasRegistrationOrRsvpLink(ev)) return true;
  return false;
}

/**
 * Infer free + registration-required from About / price copy when scrapers
 * left price as unknown (e.g. Landmark “Free to attend; please RSVP.”).
 */
export function enrichEventAccessFromCopy(ev: WorkshopEvent): WorkshopEvent {
  const saysFree = eventCopySaysFree(ev);
  // Price-detail wording follows copy only (not merely having an RSVP URL).
  const needsRegFromCopy =
    ev.registrationRequired === true ||
    (ev.registrationRequired !== false && eventCopyImpliesAdvanceRegistration(ev));
  const needsReg = eventRequiresAdvanceRegistration(ev);
  if (!saysFree && !needsReg) return ev;

  const blob = eventAccessCopyBlob(ev);
  const next: WorkshopEvent = { ...ev };
  if (saysFree && (ev.price === "unknown" || !ev.price)) {
    next.price = "free";
  }
  if (needsReg && ev.registrationRequired !== false) {
    next.registrationRequired = true;
  }

  const detail = ev.priceDetail?.trim() ?? "";
  const detailIsAutoOrBlank =
    !detail ||
    /^free$/i.test(detail) ||
    /^unknown$/i.test(detail) ||
    /^free · registration required$/i.test(detail) ||
    /^free · please rsvp$/i.test(detail);
  if (saysFree && needsRegFromCopy && detailIsAutoOrBlank) {
    next.priceDetail = /\bplease rsvp\b/.test(blob)
      ? "Free · please RSVP"
      : "Free · registration required";
  } else if (saysFree && detailIsAutoOrBlank) {
    next.priceDetail = "Free";
  }
  return next;
}

/** True when the user has narrowed results via facets, RSVP toggle, or search. */
export function hasActiveNarrowingFilters(
  filters: EventFilters,
  search: string,
): boolean {
  return (
    filters.formats.size > 0 ||
    filters.prices.size > 0 ||
    filters.categoryIncluded.size > 0 ||
    filters.registrationRequiredOnly ||
    search.trim().length > 0
  );
}

export function applyEventFilters(
  events: WorkshopEvent[],
  filters: EventFilters,
  search: string,
): WorkshopEvent[] {
  return events.filter((ev) => {
    if (isTheaterWorkshopEvent(ev)) return false;
    if (isVisualArtOnlyWorkshopEvent(ev)) return false;
    if (isFilmOnlyWorkshopEvent(ev)) return false;
    // Empty facet = no restriction (e-commerce style). Non-empty = OR within
    // the facet; facets combine with AND.
    if (filters.formats.size > 0 && !filters.formats.has(ev.format)) {
      return false;
    }
    if (filters.prices.size > 0 && !filters.prices.has(ev.price)) {
      return false;
    }
    if (
      filters.categoryIncluded.size > 0 &&
      !filters.categoryIncluded.has(ev.category)
    ) {
      return false;
    }
    if (
      filters.registrationRequiredOnly &&
      !eventRequiresAdvanceRegistration(ev)
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
