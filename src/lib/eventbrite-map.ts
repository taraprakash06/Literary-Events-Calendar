import { isTheaterEventText, isVisualArtOnlyEventText } from "@/lib/event-category";
import type {
  EventFormat,
  WorkshopEvent,
  WorkshopEventCategory,
} from "@/lib/workshop-types";
import type { AppCityId } from "@/lib/eventbrite-geo";
import { classifyEventbriteLocation } from "@/lib/eventbrite-geo";
import { DateTime } from "luxon";
import { limitAboutToSentences, stripHtmlAndDecode, toShortOverview } from "@/lib/text";

/** Curated About when Eventbrite summary/HTML leads with a location note. */
const EB_ABOUT_BY_TITLE: Array<{ match: RegExp; about: string }> = [
  {
    match:
      /poetry today book club.*ingrid jacobsen|sonnets on the attempted murder of me,\s*bugs b/i,
    about:
      "Book Club Bar's monthly Sunday-brunch poetry discussion takes up Sonnets on the Attempted Murder of Me, Bugs B by Ingrid Jacobsen—and Ingrid will join the conversation. Read the collection beforehand, then gather at Book Club Bar East Village for an intimate gab session led by bookseller Daniel Yadin; no other prep needed, just curiosity (boozy optional). Jacobsen's book is the first publication from The Can Press, which Yadin started with fellow BCB bookseller Mathuson and BCB alum Keri. Tickets include $8 off any drink; registration is capped, so register early, and tip bartenders separately.",
  },
  {
    match: /adore,?\s*amor.*bronx is reading|adore,?\s*amor festival/i,
    about:
      "Adore, Amor is a new romance festival from The Bronx is Reading, staged as a lawn-and-garden party at the historic Andrew Freedman Home on the Grand Concourse. Spend the day celebrating romance culture with author talks, Instagrammable moments, and a bookish crowd marking Romance Bookstore Day in NYC. Mix and mingle—exchange a title you brought or make a new reading friend—with activities like DIY keychains, mini silk flower bouquets, and acrylic bookmarks (supplies first come, first served). Official booksellers The Bronx is Reading and Lavish Booktique will be on-site with participating authors' books and merch.",
  },
  {
    match:
      /books,\s*iced coffee\s*&\s*a side of dragons|amanda lovelace.*love\s*&\s*legends|love\s*&\s*legends.*amanda lovelace/i,
    about:
      "Love & Legends Books celebrates Amanda Lovelace's BOOKS, ICED COFFEE & A SIDE OF DRAGONS, with Lovelace in conversation with Megan (@booksnblazers). Expect a moderated discussion, audience Q&A, and a signing line afterward. The new graphic novel is a sugary-sweet sapphic romance set on the Jersey Shore—bookstore owner Luci, coffee-shop neighbor Aster, and a tiny wind dragon named Dandelion in Sea Witch Cove. Lovelace is the USA TODAY bestselling poet behind the women are some kind of magic series; Megan has been championing queer books on Instagram for a decade.",
  },
];

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
  return stripHtmlAndDecode(html);
}

function textField(tf?: EbTextField): string {
  if (!tf) return "";
  const t = (tf.text ?? "").trim();
  if (t) return t;
  const h = (tf.html ?? "").trim();
  return h ? stripHtml(h) : "";
}

/**
 * Eventbrite `format_id` is the event *type* (e.g. 9 = Workshop), not attendance mode.
 * Attendance comes from `online_event` and venue data — see Eventbrite “formats” API.
 */
function hasMeaningfulPhysicalVenue(v: EbVenue | null | undefined): boolean {
  if (!v) return false;
  const lat = Number(v.latitude);
  const lng = Number(v.longitude);
  if (Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) + Math.abs(lng) > 0.0001) {
    return true;
  }
  const display = v.address?.localized_address_display?.trim();
  if (display && display.length > 3) return true;
  const name = (v.name ?? "").trim().toLowerCase();
  if (!name) return false;
  if (name === "online event" || name === "online" || name === "to be announced") return false;
  return true;
}

function mapFormat(ev: EbEventResource): EventFormat {
  const online = ev.online_event === true;
  const physical = hasMeaningfulPhysicalVenue(ev.venue);

  if (online && physical) return "hybrid";
  if (online) return "virtual";

  const hay = `${textField(ev.name)}\n${textField(ev.summary)}\n${textField(ev.description)}`.toLowerCase();
  if (
    !physical &&
    /\b(virtual\s+(event|class|workshop|reading)|online\s+only|held\s+online|via\s+zoom|on\s+zoom|zoom\s+link|google\s+meet|microsoft\s+teams)\b/i.test(
      hay,
    )
  ) {
    return "virtual";
  }

  return "in-person";
}

function mapCategory(ev: EbEventResource): WorkshopEventCategory {
  const t = textField(ev.name).toLowerCase();
  const d = (
    textField(ev.summary) ||
    textField(ev.description)
  ).toLowerCase();
  const hay = `${t}\n${d}`;

  if (/(open\s*mic|mic\s*night|slam)/.test(hay)) return "open-mic";
  if (/(workshop|writing\s+workshop|creative\s+writing|screenwriting|memoir|novel|short\s+story|critique|writers'?(\s+)?group)/.test(hay))
    return "workshop";
  // Poetry book clubs / poetry discussions still read as literary readings.
  if (/(poetry\s+today|poetry\s+book\s+club|poetry\s+discussion)/.test(hay)) {
    return "reading";
  }
  if (/(book\s*club|book\s+discussion|reading\s+group)/.test(hay)) return "other";
  if (/(poetry\s+reading|reading\b|author\s+talk|author\s+reading)/.test(hay)) return "reading";
  if (/(panel|conversation|in\s+conversation)/.test(hay)) return "other";
  if (/(festival)/.test(hay)) return "other";
  if (/(launch|book\s+launch)/.test(hay)) return "reading";

  return "other";
}

function cleanEventbriteAboutText(raw: string): string {
  return raw
    .replace(/\bOverview\b/gi, " ")
    .replace(
      /\*{0,2}\s*please note the location of this meeting[\s\S]*?\*{0,2}/gi,
      " ",
    )
    .replace(
      /\bWhat your ticket includes:\s*/i,
      " ",
    )
    .replace(
      /\bPlease note:\s*gratuity for the bartenders[\s\S]*$/i,
      "",
    )
    .replace(
      /\bPlease use your tickets at the beginning of the event\.?/i,
      "",
    )
    .replace(/\s+/g, " ")
    .trim();
}

function resolveEventbriteAbout(ev: EbEventResource, title: string): string {
  const blob = `${title}\n${textField(ev.description)}\n${textField(ev.summary)}`;
  for (const row of EB_ABOUT_BY_TITLE) {
    if (row.match.test(blob)) return row.about;
  }

  const fromHtml = ev.description?.html
    ? stripHtmlAndDecode(ev.description.html)
    : "";
  const fromSummaryHtml = ev.summary?.html
    ? stripHtmlAndDecode(ev.summary.html)
    : "";
  const cleaned = cleanEventbriteAboutText(
    fromHtml || textField(ev.description) || fromSummaryHtml || textField(ev.summary),
  );

  return (
    limitAboutToSentences(cleaned, 4) ||
    toShortOverview(cleaned, 420) ||
    cleaned ||
    "Details on Eventbrite."
  );
}

export function mapEbEventToWorkshop(
  ev: EbEventResource,
  cityId: AppCityId,
): WorkshopEvent | null {
  const tz = ev.start?.timezone?.trim() || ev.end?.timezone?.trim() || "";
  const startLocal = ev.start?.local?.trim();
  const startUtc = ev.start?.utc?.trim();
  const startIso =
    startLocal && tz
      ? DateTime.fromISO(startLocal, { zone: tz }).toISO()
      : startUtc || null;
  if (!startIso) return null;

  const title = textField(ev.name);
  if (!title) return null;

  const summaryPlain = textField(ev.summary);
  const descriptionPlain = textField(ev.description);
  if (isTheaterEventText(title, summaryPlain, descriptionPlain)) return null;
  if (isVisualArtOnlyEventText(title, summaryPlain, descriptionPlain)) return null;

  const description = resolveEventbriteAbout(ev, title);

  const venue = ev.venue;
  const addr = venue?.address;
  const venueName = (venue?.name ?? "").trim();
  const line =
    [venueName, addr?.localized_address_display].filter(Boolean).join(" · ") ||
    venueName ||
    undefined;
  const address = addr?.localized_address_display?.trim() || undefined;

  const price: WorkshopEvent["price"] = ev.is_free ? "free" : "paid";

  const format = mapFormat(ev);
  const virtualLabel =
    format === "hybrid"
      ? "Hybrid (online + in person)"
      : format === "virtual"
        ? "Online (Eventbrite)"
        : undefined;

  const endLocal = ev.end?.local?.trim();
  const endUtc = ev.end?.utc?.trim();
  const endIso =
    endLocal && tz
      ? DateTime.fromISO(endLocal, { zone: tz }).toISO() ?? undefined
      : endUtc || undefined;

  return {
    id: `eb-${ev.id}`,
    cityId,
    title,
    tagline: summaryPlain || "",
    description: description.slice(0, 4000),
    start: startIso,
    end: endIso,
    timeZone: tz || undefined,
    format,
    price,
    category: mapCategory(ev),
    // Eventbrite listings are advance ticket / registration flows.
    registrationRequired: true,
    organizer: "Eventbrite",
    venue: line,
    address,
    neighborhood: addr?.localized_area_display?.trim() || undefined,
    virtualLabel,
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
