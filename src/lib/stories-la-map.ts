import type { StoriesLaEventV2Row, StoriesLaStoreInfo } from "@/lib/stories-la-client";
import { isTheaterEventText } from "@/lib/event-category";
import type { EventFormat, WorkshopEvent, WorkshopEventCategory } from "@/lib/workshop-types";
import { DateTime } from "luxon";
import { stripHtmlAndDecode, toShortOverview, limitAboutToSentences } from "@/lib/text";

const ORIGIN = "https://www.storiesla.com";
const TZ = "America/Los_Angeles";

function publicSiteOrigin(store: StoriesLaStoreInfo): string {
  const raw = (store.url ?? store.base_url ?? ORIGIN).trim();
  try {
    const url = new URL(raw.startsWith("http") ? raw : `https://${raw}`);
    return url.origin;
  } catch {
    return ORIGIN;
  }
}

function mapCategory(name: string | undefined, title: string): WorkshopEventCategory {
  const n = `${name ?? ""} ${title}`.toLowerCase();
  if (n.includes("book club")) return "other";
  if (n.includes("open mic") || n.includes("open-mic")) return "open-mic";
  if (n.includes("workshop") || n.includes("writing")) return "workshop";
  if (n.includes("book release") || n.includes("launch") || n.includes("signing")) {
    return "reading";
  }
  if (n.includes("reading") || n.includes("poetry") || n.includes("author")) {
    return "reading";
  }
  if (n.includes("panel") || n.includes("discussion")) return "other";
  return "reading";
}

function mapFormat(row: StoriesLaEventV2Row): EventFormat {
  const blob = `${row.location_text ?? ""} ${row.summary ?? ""} ${row.description ?? ""}`.toLowerCase();
  if (/\bzoom\b|\bvirtual\b|\bonline only\b|\bwebinar\b/.test(blob)) {
    if (/\bstories\b|\becho park\b|\bin-?store\b|\bin person\b/.test(blob)) return "hybrid";
    return "virtual";
  }
  return "in-person";
}

function parseStartEnd(row: StoriesLaEventV2Row): { start: DateTime; end?: DateTime } | null {
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

export function isStoriesLaLiterary(row: StoriesLaEventV2Row): boolean {
  const b = `${row.title}\n${row.summary ?? ""}\n${row.description ?? ""}\n${row.category?.name ?? ""}`.toLowerCase();
  if (/\bclosed\b|\bstore closed\b/.test(b)) return false;
  if (/\btrivia night\b/.test(b)) return false;
  if (/\bcomedy show\b|\bstand-?up comedy\b/.test(b)) return false;
  if (/\bjazz roulette\b|\bvariety show\b/.test(b)) return false;
  return true;
}

export function mapStoriesLaEventRowToWorkshop(
  row: StoriesLaEventV2Row,
  store: StoriesLaStoreInfo,
): WorkshopEvent | null {
  if (!isStoriesLaLiterary(row)) return null;

  const span = parseStartEnd(row);
  if (!span) return null;

  const title = (row.title ?? "").trim();
  if (!title) return null;
  if (isTheaterEventText(title, row.summary, row.description)) return null;

  const origin = publicSiteOrigin(store);
  const rsvpUrl = `${origin}/events/${row.id}`;

  const htmlDesc = (row.description ?? "").trim();
  const htmlSum = (row.summary ?? "").trim();
  const description =
    limitAboutToSentences(htmlDesc || htmlSum || title, 4) ||
    toShortOverview(htmlDesc || htmlSum || title, 420) ||
    stripHtmlAndDecode(htmlDesc || htmlSum) ||
    "Event details on the Stories Books & Cafe website.";

  const tagline = htmlSum ? toShortOverview(htmlSum, 220) : "";

  const venueLine = (row.location_text ?? "").trim();
  const venueDefault = [store.name, store.city, store.province].filter(Boolean).join(", ");
  const venue = venueLine || venueDefault || "Stories Books & Cafe";

  const format = mapFormat(row);
  const category = mapCategory(row.category?.name, title);

  const addrParts = [store.address, store.city, store.province, store.postal_code].filter(
    (x) => (x ?? "").trim().length > 0,
  ) as string[];
  const address = addrParts.length ? addrParts.join(", ") : undefined;

  return {
    id: `stories-la-${row.id}`,
    cityId: "la",
    title,
    tagline,
    description,
    start: span.start.toISO() ?? span.start.toString(),
    end: span.end?.toISO() ?? undefined,
    timeZone: TZ,
    format,
    price: "unknown",
    category,
    organizer: store.name || "Stories Books & Cafe",
    venue,
    address,
    neighborhood: "Echo Park",
    virtualLabel: format === "virtual" ? "Online" : format === "hybrid" ? "Hybrid" : undefined,
    rsvpUrl,
    source: "Stories Books & Cafe (storiesla.com)",
    sourceChannel: "bookstore",
    listingProvenance: "live",
  };
}
