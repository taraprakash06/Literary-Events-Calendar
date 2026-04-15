import type {
  EventFormat,
  WorkshopEvent,
  WorkshopEventCategory,
} from "@/lib/workshop-types";
import type { AppCityId } from "@/lib/eventbrite-geo";
import { classifyEventbriteLocation } from "@/lib/eventbrite-geo";

/** Minimal Eventbrite event JSON (owned_events / organization events + expand=venue). */
export type EbTextField = { text?: string; html?: string };

export type EbVenueAddress = {
  city?: string | null;
  region?: string | null;
  postal_code?: string | null;
  localized_area_display?: string | null;
  localized_address_display?: string | null;
};

export type EbVenue = {
  id?: string;
  name?: string | null;
  latitude?: string | null;
  longitude?: string | null;
  address?: EbVenueAddress | null;
};

export type EbEventResource = {
  id: string;
  name?: EbTextField;
  description?: EbTextField;
  summary?: EbTextField;
  url?: string;
  start?: { utc?: string; local?: string; timezone?: string };
  end?: { utc?: string; local?: string; timezone?: string };
  is_free?: boolean;
  venue_id?: string | null;
  venue?: EbVenue | null;
  online_event?: boolean;
  format_id?: string | null;
};

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function textField(tf?: EbTextField): string {
  if (!tf) return "";
  const t = (tf.text ?? "").trim();
  if (t) return t;
  const h = (tf.html ?? "").trim();
  return h ? stripHtml(h) : "";
}

function isOnlineEvent(ev: EbEventResource): boolean {
  if (ev.online_event === true) return true;
  if (ev.format_id === "9") return true;
  return false;
}

function mapFormat(ev: EbEventResource): EventFormat {
  if (isOnlineEvent(ev)) return "virtual";
  return "in-person";
}

function mapCategory(ev: EbEventResource): WorkshopEventCategory {
  const t = textField(ev.name).toLowerCase();
  const d = (
    textField(ev.summary) ||
    textField(ev.description)
  ).toLowerCase();
  const hay = `${t}\n${d}`;

  if (/(book\s*club|book\s+discussion|reading\s+group)/.test(hay)) return "book-club";
  if (/(open\s*mic|mic\s*night|slam)/.test(hay)) return "open-mic";
  if (/(workshop|writing\s+workshop|creative\s+writing|screenwriting|memoir|novel|short\s+story|critique|writers'?(\s+)?group)/.test(hay))
    return "workshop";
  if (/(poetry\s+reading|reading\b|author\s+talk|author\s+reading)/.test(hay)) return "reading";
  if (/(panel|conversation|in\s+conversation)/.test(hay)) return "panel";
  if (/(festival)/.test(hay)) return "festival";
  if (/(launch|book\s+launch)/.test(hay)) return "launch";

  return "other";
}

export function mapEbEventToWorkshop(
  ev: EbEventResource,
  cityId: AppCityId,
): WorkshopEvent | null {
  const startUtc = ev.start?.utc?.trim();
  if (!startUtc) return null;

  const title = textField(ev.name);
  if (!title) return null;

  const summary = textField(ev.summary);
  const description = textField(ev.description) || summary || "Details on Eventbrite.";

  const venue = ev.venue;
  const addr = venue?.address;
  const venueName = (venue?.name ?? "").trim();
  const line =
    [venueName, addr?.localized_address_display].filter(Boolean).join(" · ") ||
    venueName ||
    undefined;
  const address = addr?.localized_address_display?.trim() || undefined;

  const price: WorkshopEvent["price"] = ev.is_free ? "free" : "paid";

  return {
    id: `eb-${ev.id}`,
    cityId,
    title,
    tagline: summary || "",
    description: description.slice(0, 4000),
    start: startUtc,
    end: ev.end?.utc?.trim() || undefined,
    format: mapFormat(ev),
    price,
    category: mapCategory(ev),
    organizer: "Eventbrite",
    venue: line,
    address,
    neighborhood: addr?.localized_area_display?.trim() || undefined,
    rsvpUrl: ev.url?.trim() || undefined,
    source: "Eventbrite",
    sourceChannel: "eventbrite",
    listingProvenance: "live",
  };
}

/** Resolve `cityId` from venue; returns `null` if outside configured regions. */
export function cityIdForEbEvent(ev: EbEventResource): AppCityId | null {
  const v = ev.venue;
  const addr = v?.address;
  return classifyEventbriteLocation({
    latitude: v?.latitude,
    longitude: v?.longitude,
    city: addr?.city,
    region: addr?.region,
  });
}
