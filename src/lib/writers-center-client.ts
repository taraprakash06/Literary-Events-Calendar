import type { TwcTribeEvent } from "@/lib/writers-center-map";

export const WRITERS_CENTER_SITE = "https://writer.org";
export const WRITERS_CENTER_WORKSHOPS_PAGE =
  "https://writer.org/workshops/";
export const WRITERS_CENTER_FREE_EVENTS_PAGE =
  "https://writer.org/free-events-calendar/";
const TRIBE_EVENTS = `${WRITERS_CENTER_SITE}/wp-json/tribe/events/v1/events`;

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function monthDateRange(year: number, monthIndex: number): {
  startDate: string;
  endDate: string;
} {
  const startDate = `${year}-${pad2(monthIndex + 1)}-01`;
  const last = new Date(year, monthIndex + 1, 0).getDate();
  const endDate = `${year}-${pad2(monthIndex + 1)}-${pad2(last)}`;
  return { startDate, endDate };
}

type TribeListResponse = {
  events?: TwcTribeEvent[];
  total_pages?: number;
};

async function fetchWritersCenterByCategory(
  category: string,
  year: number,
  monthIndex: number,
  signal?: AbortSignal,
): Promise<TwcTribeEvent[]> {
  const { startDate, endDate } = monthDateRange(year, monthIndex);
  const out: TwcTribeEvent[] = [];
  const totalPagesCap = 10;
  let page = 1;

  while (page <= totalPagesCap) {
    const u = new URL(TRIBE_EVENTS);
    u.searchParams.set("categories", category);
    u.searchParams.set("start_date", startDate);
    u.searchParams.set("end_date", endDate);
    u.searchParams.set("per_page", "100");
    u.searchParams.set("page", String(page));
    u.searchParams.set("status", "publish");

    const res = await fetch(u.toString(), {
      signal,
      headers: { Accept: "application/json" },
      next: { revalidate: 600 },
    });
    if (!res.ok) {
      throw new Error(`Writer's Center TEC HTTP ${res.status} (${category})`);
    }
    const data = (await res.json()) as TribeListResponse;
    const batch = data.events ?? [];
    out.push(...batch);
    const totalPages = data.total_pages ?? page;
    if (page >= totalPages || batch.length === 0) break;
    page += 1;
  }

  return out;
}

/**
 * Fetches published **Workshop** category events for the month from The Events
 * Calendar REST API (same catalog as the public workshops page).
 */
export async function fetchWritersCenterWorkshopsForMonth(
  year: number,
  monthIndex: number,
  signal?: AbortSignal,
): Promise<TwcTribeEvent[]> {
  return fetchWritersCenterByCategory("workshop", year, monthIndex, signal);
}

/**
 * Fetches published **Event** category listings (free events calendar:
 * open mics, craft chats, readings, book clubs, etc.).
 */
export async function fetchWritersCenterFreeEventsForMonth(
  year: number,
  monthIndex: number,
  signal?: AbortSignal,
): Promise<TwcTribeEvent[]> {
  return fetchWritersCenterByCategory("event", year, monthIndex, signal);
}

/**
 * Workshops + free-events calendar rows for the month, deduped by TEC id.
 */
export async function fetchWritersCenterListingsForMonth(
  year: number,
  monthIndex: number,
  signal?: AbortSignal,
): Promise<TwcTribeEvent[]> {
  const [workshops, freeEvents] = await Promise.all([
    fetchWritersCenterWorkshopsForMonth(year, monthIndex, signal),
    fetchWritersCenterFreeEventsForMonth(year, monthIndex, signal),
  ]);

  const byId = new Map<number, TwcTribeEvent>();
  for (const ev of [...workshops, ...freeEvents]) {
    byId.set(ev.id, ev);
  }
  return [...byId.values()];
}
