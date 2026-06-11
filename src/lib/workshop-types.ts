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
   * Optional IANA timezone to display dates/times consistently with the source.
   * Example: "America/New_York".
   */
  timeZone?: string;
  format: EventFormat;
  price: PriceKind;
  category: WorkshopEventCategory;
  organizer: string;
  venue?: string;
  /** Street or well-known place name */
  address?: string;
  neighborhood?: string;
  virtualLabel?: string;
  rsvpUrl?: string;
  /** Human-readable publisher or feed name once live. */
  source?: string;
  /** Which connector this listing belongs to in the ingestion model. */
  sourceChannel?: SourceChannel;
  /** `sample` = UI placeholder until feeds return real rows. */
  listingProvenance?: ListingProvenance;
};

export type EventFilters = {
  /** Checked = included; unchecked = excluded */
  formats: Set<EventFormat>;
  prices: Set<PriceKind>;
  categoryIncluded: Set<WorkshopEventCategory>;
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
