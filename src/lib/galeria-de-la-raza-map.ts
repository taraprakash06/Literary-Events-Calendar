import { DateTime } from "luxon";
import type { GaleriaTribeEvent } from "@/lib/galeria-de-la-raza-client";
import type {
  EventFormat,
  WorkshopEvent,
  WorkshopEventCategory,
} from "@/lib/workshop-types";
import { stripHtmlAndDecode, toShortOverview } from "@/lib/text";

const DEFAULT_TZ = "America/Los_Angeles";

function stripHtml(html: string): string {
  return stripHtmlAndDecode(html);
}

function safeTitle(title: unknown): string {
  if (typeof title === "string") return stripHtml(title).trim();
  if (title && typeof title === "object" && "rendered" in title) {
    const r = (title as { rendered?: string }).rendered;
    if (typeof r === "string") return stripHtml(r).trim();
  }
  return "";
}

function eventBlob(ev: GaleriaTribeEvent): string {
  const title = safeTitle(ev.title);
  const excerpt = (ev.excerpt ?? "").trim();
  const desc = (ev.description ?? "").trim();
  return `${title} ${stripHtml(excerpt)} ${stripHtml(desc)}`.toLowerCase();
}

/** Literary / spoken-word programs only — not exhibitions or drag nights. */
export function isGaleriaLiteraryEvent(ev: GaleriaTribeEvent): boolean {
  const blob = eventBlob(ev);

  if (
    /\b(dragiarte|scavenger hunt|on view:|sculpture walk|closing reception)\b/i.test(
      blob,
    )
  ) {
    return false;
  }

  return (
    /\b(lunada|literary lounge|literary|poetry|poetics|reading|anthology|open mic|spoken word|literatura|writer|author)\b/i.test(
      blob,
    )
  );
}

function mapCategory(ev: GaleriaTribeEvent): WorkshopEventCategory {
  const blob = eventBlob(ev);
  if (/\b(open mic|lunada)\b/i.test(blob)) return "open-mic";
  if (/\b(reading|anthology|poetry|poetics)\b/i.test(blob)) return "reading";
  return "other";
}

function mapPrice(cost?: string): WorkshopEvent["price"] {
  if (!cost?.trim()) return "free";
  const c = cost.toLowerCase();
  if (c.includes("free") || c === "0") return "free";
  if (/\$|€|£|\d/.test(cost)) return "paid";
  return "unknown";
}

function normalizeVenue(
  ev: GaleriaTribeEvent,
): { venue?: string; address?: string; city?: string; state?: string; zip?: string } | null {
  const v = ev.venue;
  if (!v || Array.isArray(v)) return null;
  return v as {
    venue?: string;
    address?: string;
    city?: string;
    state?: string;
    zip?: string;
  };
}

function venueLine(ev: GaleriaTribeEvent): string | undefined {
  const v = normalizeVenue(ev);
  if (!v) return undefined;
  const parts = [
    v.venue,
    [v.address, v.city, v.state, v.zip].filter(Boolean).join(", ") || null,
  ].filter(Boolean) as string[];
  return parts.length > 0 ? parts.join(" · ") : undefined;
}

function parseStartEnd(ev: GaleriaTribeEvent): { start: DateTime; end: DateTime | null } | null {
  const tz = (ev.timezone ?? DEFAULT_TZ).trim() || DEFAULT_TZ;
  if (ev.all_day) {
    const d = (ev.start_date ?? "").trim().slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return null;
    const start = DateTime.fromISO(`${d}T00:00:00`, { zone: tz }).startOf("day");
    if (!start.isValid) return null;
    return { start, end: start.endOf("day") };
  }

  const sRaw = (ev.start_date ?? "").trim();
  if (!sRaw) return null;
  const start = DateTime.fromFormat(sRaw, "yyyy-MM-dd HH:mm:ss", { zone: tz });
  if (!start.isValid) return null;

  const eRaw = (ev.end_date ?? "").trim();
  let end: DateTime | null = null;
  if (eRaw) {
    const parsed = DateTime.fromFormat(eRaw, "yyyy-MM-dd HH:mm:ss", { zone: tz });
    end = parsed.isValid ? parsed : null;
  }
  if (end && end.toMillis() < start.toMillis()) {
    end = null;
  }
  return { start, end: end ?? start.plus({ hours: 2 }) };
}

export function mapGaleriaTribeEventToWorkshop(ev: GaleriaTribeEvent): WorkshopEvent | null {
  if (!isGaleriaLiteraryEvent(ev)) return null;

  const span = parseStartEnd(ev);
  if (!span) return null;

  const title = safeTitle(ev.title);
  if (!title) return null;

  const excerpt = (ev.excerpt ?? "").trim();
  const descHtml = (ev.description ?? "").trim();
  const description =
    (excerpt ? stripHtml(excerpt) : "") ||
    (descHtml ? stripHtml(descHtml).slice(0, 3000) : "") ||
    "Event details on the Galería de la Raza website.";

  const tagline = excerpt ? toShortOverview(excerpt, 240) : "";
  const v = normalizeVenue(ev);

  return {
    id: `galeria-${ev.id}`,
    cityId: "sf",
    title,
    tagline,
    description: toShortOverview(description, 420) || description,
    start: span.start.toISO() ?? span.start.toString(),
    end: span.end?.toISO() ?? undefined,
    timeZone: (ev.timezone ?? DEFAULT_TZ).trim() || DEFAULT_TZ,
    format: "in-person" satisfies EventFormat,
    price: mapPrice(ev.cost),
    category: mapCategory(ev),
    organizer: "Galería de la Raza",
    venue: venueLine(ev),
    address: v?.address?.trim() || undefined,
    neighborhood: v?.city?.trim() || "Mission District",
    rsvpUrl: ev.url?.trim() || undefined,
    source: "Galería de la Raza",
    sourceChannel: "literary_org",
    listingProvenance: "live",
  };
}
