import { polishAboutText } from "@/lib/text";
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
    /\bfree admission\b/.test(blob) ||
    /\badmission is free\b/.test(blob) ||
    /\bthis (?:event|program|workshop|reading) is free\b/.test(blob) ||
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
    /\bno (?:registration|rsvp)(?:\s+is)?\s+(?:required|necessary|needed)\b/.test(
      blob,
    ) ||
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
    /\bno (?:registration|rsvp)(?:\s+is)?\s+(?:required|necessary|needed)\b/.test(
      blob,
    ) ||
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
 * Also reconciles `$0` / free stickers with Cost lines in About, then removes
 * pricing language from About so cost lives only in the Price field.
 */
export function enrichEventAccessFromCopy(ev: WorkshopEvent): WorkshopEvent {
  const priced = reconcileEventPricingFromCopy(ev);
  const saysFree = eventCopySaysFree(priced);
  // Price-detail wording follows copy only (not merely having an RSVP URL).
  const needsRegFromCopy =
    priced.registrationRequired === true ||
    (priced.registrationRequired !== false &&
      eventCopyImpliesAdvanceRegistration(priced));
  const needsReg = eventRequiresAdvanceRegistration(priced);

  const next: WorkshopEvent = { ...priced };
  if (saysFree && (priced.price === "unknown" || !priced.price)) {
    next.price = "free";
  }
  if (needsReg && priced.registrationRequired !== false) {
    next.registrationRequired = true;
  }

  if (saysFree || needsReg) {
    const blob = eventAccessCopyBlob(priced);
    const detail = next.priceDetail?.trim() ?? "";
    const detailIsAutoOrBlank =
      !detail ||
      isBareZeroPriceDetail(detail) ||
      /^free$/i.test(detail) ||
      /^unknown$/i.test(detail) ||
      /^free · registration required$/i.test(detail) ||
      /^free · please rsvp$/i.test(detail);
    if (saysFree && needsRegFromCopy && detailIsAutoOrBlank) {
      next.priceDetail = /\bplease rsvp\b/.test(blob)
        ? "Free · please RSVP"
        : "Free · registration required";
    } else if ((saysFree || next.price === "free") && detailIsAutoOrBlank) {
      next.priceDetail = "Free";
    }
  }

  if (next.description) {
    next.description = polishAboutText(
      stripPricingFromAboutText(next.description),
    );
  }

  return next;
}

/**
 * Remove cost / ticket / free-price wording from About after it has been
 * copied into `price` / `priceDetail`.
 */
export function stripPricingFromAboutText(input: string): string {
  let t = input.replace(/\u00a0/g, " ");

  t = t.replace(
    /\bCost:\s*\$\s*[\d,]+(?:\.\d{2})?\s*[|｜]\s*Members?\s*\$\s*[\d,]+(?:\.\d{2})?/gi,
    " ",
  );
  t = t.replace(
    /\bCost:\s*\$\s*[\d,]+(?:\.\d{2})?(?:\s*[-–—]\s*\$\s*[\d,]+(?:\.\d{2})?)?/gi,
    " ",
  );
  t = t.replace(
    /\$\s*[\d,]+(?:\.\d{2})?\s*for\s+members\s*\$\s*[\d,]+(?:\.\d{2})?\s*for\s+non-?members/gi,
    " ",
  );
  t = t.replace(
    /\b(?:tuition|workshop fee|program fee|registration fee)\s*[:=]?\s*\$\s*[\d,]+(?:\.\d{2})?/gi,
    " ",
  );
  t = t.replace(
    /\b(?:tickets?|admission)\s*(?:are\s+|is\s+|:\s*)?\$\s*[\d,]+(?:\.\d{2})?(?:\s*(?:\+?\s*tax|cover|online|at the door))?/gi,
    " ",
  );
  t = t.replace(/\$\s*[\d,]+(?:\.\d{2})?\s+cover\b/gi, " ");
  t = t.replace(
    /\b(?:online\s+)?\$\s*[\d,]+(?:\.\d{2})?\s*(?:\+?\s*tax)?\s*,?\s*\$\s*[\d,]+(?:\.\d{2})?\s+at the door\b/gi,
    " ",
  );
  t = t.replace(
    /\b(?:this\s+(?:event|program|workshop|reading)\s+is\s+free|admission\s+is\s+free|free\s+admission|free\s+to\s+attend|free\s+of\s+charge)\b[.,;!]*/gi,
    " ",
  );
  t = t.replace(
    /\bfree\s*[·•]\s*(?:registration required|please rsvp|no registration required|optional[^.]{0,40}donation)\b/gi,
    " ",
  );
  t = t.replace(
    /\ban?\s+optional\s+\$\s*[\d,]+(?:\.\d{2})?\s+donation\b[^.!?]*/gi,
    " ",
  );
  // "Free; please register…" / sentence-leading Free.
  t = t.replace(/(^|[.!?]\s*)Free\b[.;:,]?\s*/g, "$1");
  t = t.replace(/\bFree[.;:]\s+(?=please\s+(?:register|rsvp))/gi, "");

  // If we deleted mid-sentence price copy, avoid leaving " , " or "  ".
  return t
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([.,!?])/g, "$1")
    .replace(/([.!?]){2,}/g, "$1")
    .replace(/^[.,;:\s]+/, "")
    .trim();
}

/** True when priceDetail is a useless bare zero (not a $0–$10 range). */
export function isBareZeroPriceDetail(detail: string | undefined): boolean {
  if (!detail) return false;
  const d = detail.trim();
  return /^\$?\s*0+(?:\.0+)?(?:\s*(?:usd|dollars?))?$/i.test(d);
}

/**
 * Pull a positive Cost / tuition / ticket amount from About (and similar copy),
 * ignoring parking-only and suggested-donation phrasing when a Cost: line exists.
 */
export function extractAboutCostDetail(
  text: string,
): string | undefined {
  const t = text.replace(/\s+/g, " ").trim();
  if (!t) return undefined;

  const money = (raw: string) => {
    const n = Number(raw.replace(/,/g, ""));
    return Number.isFinite(n) ? n : NaN;
  };
  const trimMoney = (raw: string) => {
    const src = raw.trim();
    if (/,/.test(src)) return src.replace(/\.00$/, "");
    const n = src.replace(/,/g, "");
    if (/\.00$/.test(n)) return n.slice(0, -3);
    return n;
  };

  const pipeMembers = t.match(
    /\bCost:\s*\$\s*([\d,]+(?:\.\d{2})?)\s*[|｜]\s*Members?\s*\$\s*([\d,]+(?:\.\d{2})?)/i,
  );
  if (pipeMembers) {
    const a = money(pipeMembers[1]);
    const b = money(pipeMembers[2]);
    if (a > 0 || b > 0) {
      return `$${trimMoney(pipeMembers[1])} · Members $${trimMoney(pipeMembers[2])}`;
    }
  }

  const member = t.match(
    /\$\s*([\d,]+(?:\.\d{2})?)\s*for\s+members\s*\$\s*([\d,]+(?:\.\d{2})?)\s*for\s+non-?members/i,
  );
  if (member) {
    const a = money(member[1]);
    const b = money(member[2]);
    if (a > 0 || b > 0) {
      return `$${trimMoney(member[1])} members · $${trimMoney(member[2])} non-members`;
    }
  }

  const costLine = t.match(
    /\bCost:\s*\$\s*([\d,]+(?:\.\d{2})?)(?:\s*[-–—]\s*\$\s*([\d,]+(?:\.\d{2})?))?/i,
  );
  if (costLine) {
    const a = money(costLine[1]);
    const b = costLine[2] ? money(costLine[2]) : NaN;
    if (costLine[2] && (a > 0 || b > 0)) {
      return `$${trimMoney(costLine[1])}–$${trimMoney(costLine[2])}`;
    }
    if (a > 0) return `$${trimMoney(costLine[1])}`;
  }

  const tuition = t.match(
    /\b(?:tuition|workshop fee|program fee|registration fee)\s*[:=]?\s*\$\s*([\d,]+(?:\.\d{2})?)/i,
  );
  if (tuition && money(tuition[1]) > 0) {
    return `$${trimMoney(tuition[1])}`;
  }

  const tickets = t.match(
    /\b(?:tickets?|admission)\s*(?:are\s+|is\s+|:)?\s*\$\s*([\d,]+(?:\.\d{2})?)\b/i,
  );
  if (tickets && money(tickets[1]) > 0) {
    return `$${trimMoney(tickets[1])}`;
  }

  return undefined;
}

/**
 * Ensure Price matches About: never show bare `$0` when copy has a real cost;
 * show "Free" for free events with no better detail.
 */
export function reconcileEventPricingFromCopy(
  ev: WorkshopEvent,
): WorkshopEvent {
  const aboutBlob = [ev.title, ev.tagline, ev.description]
    .filter(Boolean)
    .join("\n");
  const aboutCost = extractAboutCostDetail(aboutBlob);
  const detail = ev.priceDetail?.trim() ?? "";
  const bareZero = isBareZeroPriceDetail(detail);
  const next: WorkshopEvent = { ...ev };

  if (aboutCost) {
    // About has a real dollar cost — never leave Price as bare $0 / free sticker.
    if (
      bareZero ||
      !detail ||
      /^free\b/i.test(detail) ||
      ev.price === "free" ||
      ev.price === "unknown"
    ) {
      next.price = "paid";
      next.priceDetail = aboutCost;
      return next;
    }
  }

  if (bareZero) {
    // Useless $0 with no About cost: treat as free display.
    next.price = next.price === "paid" ? "unknown" : next.price === "free" ? "free" : next.price;
    if (next.price === "free" || eventCopySaysFree(ev)) {
      next.price = "free";
      next.priceDetail = "Free";
    } else {
      next.priceDetail = undefined;
      if (next.price === "paid") next.price = "unknown";
    }
    return next;
  }

  if (
    (next.price === "free" || eventCopySaysFree(next)) &&
    (!detail || /^unknown$/i.test(detail))
  ) {
    next.price = "free";
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
