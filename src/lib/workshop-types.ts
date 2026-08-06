export type EventFormat = "in-person" | "virtual" | "hybrid";

export type PriceKind = "free" | "paid" | "unknown";

/** High-level category for filtering. */
export type WorkshopEventCategory =
  | "workshop"
  | "open-mic"
  | "reading"
  | "other";

export type City = {
  id: string;
  slug: string;
  name: string;
  label: string;
  /** Primary IANA zone for in-person display in this region. */
  timeZone: string;
  /**
   * When true (e.g. Tennessee), in-person events keep their venue zone and
   * show an abbreviation (ET/CT) on each listing.
   */
  multiTimeZone?: boolean;
  /**
   * When true, show a zone abbreviation (e.g. CT) on in-person event times
   * even in a single-zone region.
   */
  showTimezoneAbbr?: boolean;
};

/** Ingestion channel this row would map to in production. */
export type SourceChannel =
  | "eventbrite"
  | "google_public"
  | "library"
  | "literary_org"
  | "theater_arts"
  | "bookstore"
  | "news_roundup"
  | "instagram";

export type ListingProvenance = "sample" | "live";

export type WorkshopEvent = {
  id: string;
  cityId: string;
  title: string;
  tagline: string;
  description: string;
  /** ISO 8601 local date-time string (no Z) or with Z for UTC — parsed with Date */
  start: string;
  end?: string;
  /**
   * When true, the organizer has not published a start time. `start` still
   * carries a date (often noon local) for calendar placement, but UI should
   * show the date with "Time TBD" instead of a clock time.
   */
  timeTbd?: boolean;
  /**
   * Optional IANA timezone to display dates/times consistently with the source.
   * Example: "America/New_York".
   */
  timeZone?: string;
  format: EventFormat;
  price: PriceKind;
  /** Human-readable ticket cost, e.g. "$12.51 – $30.12". */
  priceDetail?: string;
  /**
   * When true/false, overrides text inference for whether advance
   * registration or RSVP is required. When omitted, inferred from copy.
   */
  registrationRequired?: boolean;
  category: WorkshopEventCategory;
  organizer: string;
  venue?: string;
  /** Street or well-known place name */
  address?: string;
  neighborhood?: string;
  virtualLabel?: string;
  rsvpUrl?: string;
  /**
   * When true, `rsvpUrl` is an organizer's full events calendar (not a
   * per-event page). UI should say there is no direct event link.
   */
  rsvpIsGeneralCalendar?: boolean;
  /** Human-readable publisher or feed name once live. */
  source?: string;
  /** Which connector this listing belongs to in the ingestion model. */
  sourceChannel?: SourceChannel;
  /** `sample` = UI placeholder until feeds return real rows. */
  listingProvenance?: ListingProvenance;
};

export type EventFilters = {
  /**
   * Facet filters (e-commerce style): empty set = no restriction (show all).
   * Non-empty = match any checked value (OR within facet). Facets AND together.
   */
  formats: Set<EventFormat>;
  prices: Set<PriceKind>;
  categoryIncluded: Set<WorkshopEventCategory>;
  /**
   * When true, only show events that require advance registration / RSVP.
   * When false (default), show all events regardless of RSVP requirement.
   */
  registrationRequiredOnly: boolean;
  rangeStart: string;
  rangeEnd: string;
};

export const ALL_EVENT_FORMATS: EventFormat[] = ["in-person", "virtual", "hybrid"];
export const ALL_PRICE_KINDS: PriceKind[] = ["free", "paid", "unknown"];
export const ALL_WORKSHOP_CATEGORIES: WorkshopEventCategory[] = [
  "workshop",
  "open-mic",
  "reading",
  "other",
];

export const CATEGORY_LABELS: Record<WorkshopEventCategory, string> = {
  workshop: "Workshop",
  "open-mic": "Open mic",
  reading: "Reading",
  other: "Other",
};

export const FORMAT_LABELS: Record<EventFormat, string> = {
  "in-person": "In person",
  virtual: "Virtual",
  hybrid: "Hybrid",
};

export const PRICE_LABELS: Record<PriceKind, string> = {
  free: "Free",
  paid: "Paid",
  unknown: "Unknown",
};
