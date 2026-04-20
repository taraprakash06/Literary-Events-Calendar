import type { MdHumTribeEvent } from "@/lib/mdhumanities-client";
import type { EventFormat, WorkshopEvent, WorkshopEventCategory } from "@/lib/workshop-types";
import { DateTime } from "luxon";
import { stripHtmlAndDecode, toShortOverview } from "@/lib/text";

type VenueObj = NonNullable<
  Extract<MdHumTribeEvent["venue"], { venue?: string }>
>;

function normalizeVenue(ev: MdHumTribeEvent): VenueObj | null {
  const v = ev.venue;
  if (!v || Array.isArray(v)) return null;
  return v as VenueObj;
}

function safeTitle(title: unknown): string {
  if (typeof title === "string") return stripHtmlAndDecode(title).trim();
  if (title && typeof title === "object" && "rendered" in title) {
    const r = (title as { rendered?: string }).rendered;
    if (typeof r === "string") return stripHtmlAndDecode(r).trim();
  }
  return "";
}

function mapPrice(cost?: string): WorkshopEvent["price"] {
  if (!cost?.trim()) return "unknown";
  const c = cost.toLowerCase();
  if (c.includes("free") || c === "0") return "free";
  if (/\$|€|£|\d/.test(cost)) return "paid";
  return "unknown";
}

function categorySlugs(ev: MdHumTribeEvent): string[] {
  return (ev.categories ?? [])
    .map((c) => (c.slug ?? "").toLowerCase())
    .filter(Boolean);
}

function isOnlineEvent(ev: MdHumTribeEvent): boolean {
  if (ev.is_virtual === true) return true;
  if (categorySlugs(ev).includes("online")) return true;
  const t = safeTitle(ev.title).toLowerCase();
  if (t.includes("webinar")) return true;
  return false;
}

function hasPhysicalVenue(ev: MdHumTribeEvent): boolean {
  const v = normalizeVenue(ev);
  if (!v) return false;
  return (
    Boolean(v.venue?.trim()) ||
    Boolean(v.address?.trim()) ||
    (v.geo_lat != null &&
      v.geo_lng != null &&
      String(v.geo_lat).trim() !== "" &&
      String(v.geo_lng).trim() !== "")
  );
}

function mapFormat(ev: MdHumTribeEvent): EventFormat {
  const online = isOnlineEvent(ev);
  const physical = hasPhysicalVenue(ev);
  if (online && physical) return "hybrid";
  if (online) return "virtual";
  return "in-person";
}

function venueLine(ev: MdHumTribeEvent): string | undefined {
  const v = normalizeVenue(ev);
  if (!v) return undefined;
  const parts = [
    v.venue,
    [v.address, v.city, v.state, v.zip].filter(Boolean).join(", ") || null,
  ].filter(Boolean) as string[];
  if (parts.length === 0) return undefined;
  return parts.join(" · ");
}

function mapCategory(ev: MdHumTribeEvent): WorkshopEventCategory {
  const t = safeTitle(ev.title).toLowerCase();
  const slugs = new Set(categorySlugs(ev));
  const catNames = (ev.categories ?? [])
    .map((c) => (c.name ?? "").toLowerCase())
    .join(" ");

  if (t.includes("open mic")) return "open-mic";
  if (t.includes("history day") || slugs.has("maryland-history-day")) return "festival";
  if (t.includes("conference") || t.includes("annual meeting")) return "panel";
  if (t.includes("bookfest") || t.includes("book fest") || catNames.includes("one maryland one book"))
    return "reading";
  if (t.includes("webinar") || slugs.has("online")) return "panel";
  if (t.includes("showcase")) return "reading";
  if (t.includes("workshop")) return "workshop";
  return "other";
}

function parseStartEnd(ev: MdHumTribeEvent): { start: DateTime; end: DateTime | null } | null {
  const tz = (ev.timezone ?? "America/New_York").trim() || "America/New_York";
  if (ev.all_day) {
    const d = (ev.start_date ?? "").trim().slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return null;
    const start = DateTime.fromISO(`${d}T00:00:00`, { zone: tz }).startOf("day");
    if (!start.isValid) return null;
    const end = start.endOf("day");
    return { start, end };
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
  return { start, end: end ?? start.plus({ hours: 1 }) };
}

export function mapMdHumTribeEventToWorkshop(ev: MdHumTribeEvent): WorkshopEvent | null {
  const span = parseStartEnd(ev);
  if (!span) return null;

  const title = safeTitle(ev.title);
  if (!title) return null;

  const excerpt = (ev.excerpt ?? "").trim();
  const descHtml = (ev.description ?? "").trim();
  const description =
    (excerpt ? stripHtmlAndDecode(excerpt) : "") ||
    (descHtml ? stripHtmlAndDecode(descHtml).slice(0, 3000) : "") ||
    "Event details on the Maryland Humanities website.";

  const tagline = excerpt ? toShortOverview(excerpt, 240) : "";

  const format = mapFormat(ev);
  const virtualLabel =
    format === "hybrid"
      ? "Hybrid (online + in person)"
      : format === "virtual"
        ? "Online"
        : undefined;

  const v = normalizeVenue(ev);

  return {
    id: `mdhum-${ev.id}`,
    cityId: "dmv",
    title,
    tagline,
    description: toShortOverview(description, 420) || description,
    start: span.start.toISO() ?? span.start.toUTC().toISO() ?? span.start.toString(),
    end: span.end?.toISO() ?? undefined,
    timeZone: (ev.timezone ?? "America/New_York").trim() || "America/New_York",
    format,
    price: mapPrice(ev.cost),
    category: mapCategory(ev),
    organizer: "Maryland Humanities",
    venue: venueLine(ev),
    address: v?.address?.trim() || undefined,
    neighborhood: v?.city?.trim() || undefined,
    virtualLabel,
    rsvpUrl: ev.url?.trim() || undefined,
    source: "Maryland Humanities (mdhumanities.org)",
    sourceChannel: "literary_org",
    listingProvenance: "live",
  };
}
