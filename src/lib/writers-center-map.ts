import type {
  EventFormat,
  WorkshopEvent,
  WorkshopEventCategory,
} from "@/lib/workshop-types";
import { stripHtmlAndDecode, toShortOverview } from "@/lib/text";

/** One event from `GET /wp-json/tribe/events/v1/events` (subset of fields). */
export type TwcTribeEvent = {
  id: number;
  title: string | { rendered?: string };
  url: string;
  excerpt?: string;
  description?: string;
  start_date?: string;
  end_date?: string;
  utc_start_date?: string;
  utc_end_date?: string;
  timezone?: string;
  all_day?: boolean;
  cost?: string;
  is_virtual?: boolean;
  virtual_url?: string | null;
  venue?: {
    venue?: string;
    address?: string;
    city?: string;
    state?: string;
    zip?: string;
    geo_lat?: string | number | null;
    geo_lng?: string | number | null;
  } | null;
};

function stripHtml(html: string): string {
  return stripHtmlAndDecode(html);
}

function toIsoUtc(raw?: string | null): string | null {
  if (!raw?.trim()) return null;
  const s = raw.trim().replace(" ", "T");
  if (s.endsWith("Z")) return s;
  if (/[+-]\d{2}:\d{2}$/.test(s)) return s;
  return `${s}Z`;
}

function mapPrice(cost?: string): WorkshopEvent["price"] {
  if (!cost?.trim()) return "unknown";
  const c = cost.toLowerCase();
  if (c.includes("free") || c === "0") return "free";
  if (/\$|€|£|\d/.test(cost)) return "paid";
  return "unknown";
}

function mapFormat(ev: TwcTribeEvent): EventFormat {
  const hasVenue =
    Boolean(ev.venue?.venue?.trim()) ||
    Boolean(ev.venue?.address?.trim()) ||
    (ev.venue?.geo_lat != null &&
      ev.venue?.geo_lng != null &&
      String(ev.venue.geo_lat).trim() !== "" &&
      String(ev.venue.geo_lng).trim() !== "");
  if (ev.is_virtual && hasVenue) return "hybrid";
  if (ev.is_virtual) return "virtual";
  return "in-person";
}

function venueLine(ev: TwcTribeEvent): string | undefined {
  const v = ev.venue;
  if (!v) return undefined;
  const parts = [
    v.venue,
    [v.address, v.city, v.state, v.zip].filter(Boolean).join(", ") || null,
  ].filter(Boolean) as string[];
  if (parts.length === 0) return undefined;
  return parts.join(" · ");
}

function safeTitle(title: unknown): string {
  if (typeof title === "string") return title.trim();
  if (title && typeof title === "object" && "rendered" in title) {
    const r = (title as { rendered?: string }).rendered;
    if (typeof r === "string") return stripHtml(r).trim();
  }
  return "";
}

export function mapTwcEventToWorkshop(ev: TwcTribeEvent): WorkshopEvent | null {
  const start = toIsoUtc(ev.utc_start_date);
  if (!start) return null;

  const end = toIsoUtc(ev.utc_end_date);

  const excerpt = (ev.excerpt ?? "").trim();
  const descHtml = (ev.description ?? "").trim();
  const description =
    (excerpt ? stripHtml(excerpt) : "") ||
    (descHtml ? stripHtml(descHtml).slice(0, 3000) : "") ||
    "Workshop at The Writer's Center.";

  const tagline =
    excerpt.length > 0 ? toShortOverview(excerpt, 220) : "";

  const category: WorkshopEventCategory = "workshop";

  const title = safeTitle(ev.title);
  if (!title) return null;

  const format = mapFormat(ev);
  const virtualLabel =
    format === "hybrid"
      ? "Hybrid (online + in person)"
      : format === "virtual"
        ? "Online (The Writer's Center)"
        : undefined;

  return {
    id: `twc-${ev.id}`,
    cityId: "dmv",
    title,
    tagline: tagline,
    description,
    start,
    end: end ?? undefined,
    timeZone: "America/New_York",
    format,
    price: mapPrice(ev.cost),
    category,
    organizer: "The Writer's Center",
    venue: venueLine(ev),
    address: ev.venue?.address?.trim() || undefined,
    neighborhood: ev.venue?.city?.trim() || undefined,
    virtualLabel,
    rsvpUrl: ev.url?.trim() || undefined,
    source: "The Writer's Center — Workshops (writer.org)",
    sourceChannel: "literary_org",
    listingProvenance: "live",
  };
}
