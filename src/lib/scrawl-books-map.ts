import type { ScrawlEventV2Row, ScrawlStoreInfo } from "@/lib/scrawl-books-client";
import type { EventFormat, WorkshopEvent, WorkshopEventCategory } from "@/lib/workshop-types";
import { DateTime } from "luxon";
import { stripHtmlAndDecode, toShortOverview } from "@/lib/text";

const TZ = "America/New_York";

function publicSiteOrigin(store: ScrawlStoreInfo): string {
  const raw = (store.url ?? store.base_url ?? "https://www.scrawlbooks.com").trim();
  try {
    return new URL(raw).origin;
  } catch {
    return "https://www.scrawlbooks.com";
  }
}

function mapCategory(name: string | undefined): WorkshopEventCategory {
  const n = (name ?? "").toLowerCase();
  if (n.includes("book club")) return "book-club";
  if (n.includes("storytime")) return "reading";
  if (n.includes("workshop") || n.includes("writing")) return "workshop";
  if (n.includes("panel") || n.includes("discussion")) return "panel";
  if (n.includes("launch") || n.includes("signing")) return "launch";
  if (n.includes("festival")) return "festival";
  if (n.includes("open mic") || n.includes("open-mic")) return "open-mic";
  if (n.includes("theater") || n.includes("theatre")) return "theater";
  if (n.includes("author") || n.includes("reading") || n.includes("offsite")) return "reading";
  return "other";
}

function mapFormat(row: ScrawlEventV2Row): EventFormat {
  const blob = `${row.location_text ?? ""} ${row.summary ?? ""} ${row.description ?? ""}`.toLowerCase();
  if (/\bzoom\b|\bvirtual\b|\bonline only\b|\bwebinar\b/.test(blob)) {
    if (/\bscrawl\b|\bin-?store\b|\breston\b|\bfenwick\b|\blibrary\b/.test(blob)) return "hybrid";
    return "virtual";
  }
  return "in-person";
}

function parseStartEnd(row: ScrawlEventV2Row): { start: DateTime; end?: DateTime } | null {
  const d = row.date?.trim();
  if (!/^\d{8}$/.test(d)) return null;

  const day = DateTime.fromFormat(d, "yyyyMMdd", { zone: TZ }).startOf("day");
  if (!day.isValid) return null;

  if (row.all_day) {
    return { start: day, end: day.endOf("day") };
  }

  const t = (row.start_time ?? "12:00:00").trim();
  const parts = t.split(":").map((x) => Number(x));
  const hh = Number.isFinite(parts[0]) ? parts[0] : 12;
  const mm = Number.isFinite(parts[1]) ? parts[1] : 0;
  const ss = Number.isFinite(parts[2]) ? parts[2] : 0;
  const start = day.set({ hour: hh, minute: mm, second: ss });

  const et = row.end_time?.trim();
  if (et && /^\d{2}:\d{2}/.test(et)) {
    const ep = et.split(":").map((x) => Number(x));
    const ehh = Number.isFinite(ep[0]) ? ep[0] : hh;
    const emm = Number.isFinite(ep[1]) ? ep[1] : mm;
    const ess = Number.isFinite(ep[2]) ? ep[2] : 0;
    const end = day.set({ hour: ehh, minute: emm, second: ess });
    if (end.toMillis() > start.toMillis()) return { start, end };
  }

  return { start, end: start.plus({ hours: 1 }) };
}

export function mapScrawlEventRowToWorkshop(
  row: ScrawlEventV2Row,
  store: ScrawlStoreInfo,
): WorkshopEvent | null {
  const span = parseStartEnd(row);
  if (!span) return null;

  const title = (row.title ?? "").trim();
  if (!title) return null;

  const origin = publicSiteOrigin(store);
  const rsvpUrl = `${origin}/events/${row.id}`;

  const htmlDesc = (row.description ?? "").trim();
  const htmlSum = (row.summary ?? "").trim();
  const description =
    toShortOverview(htmlDesc || htmlSum || title, 420) ||
    stripHtmlAndDecode(htmlDesc || htmlSum) ||
    "Event details on the Scrawl Books website.";

  const tagline = htmlSum ? toShortOverview(htmlSum, 220) : "";

  const venueLine = (row.location_text ?? "").trim();
  const venueDefault = [store.name, store.city, store.province].filter(Boolean).join(", ");
  const venue = venueLine || venueDefault || "Scrawl Books";

  const format = mapFormat(row);
  const category = mapCategory(row.category?.name);

  const addrParts = [store.address, store.city, store.province, store.postal_code].filter(
    (x) => (x ?? "").trim().length > 0,
  ) as string[];
  const address = addrParts.length ? addrParts.join(", ") : undefined;

  return {
    id: `scrawl-books-${row.id}`,
    cityId: "dmv",
    title,
    tagline,
    description,
    start: span.start.toISO() ?? span.start.toUTC().toISO() ?? span.start.toString(),
    end: span.end?.toISO() ?? undefined,
    timeZone: TZ,
    format,
    price: "unknown",
    category,
    organizer: store.name || "Scrawl Books",
    venue,
    address,
    virtualLabel: format === "virtual" ? "Online" : format === "hybrid" ? "Hybrid" : undefined,
    rsvpUrl,
    source: "Scrawl Books (scrawlbooks.com)",
    sourceChannel: "bookstore",
    listingProvenance: "live",
  };
}
