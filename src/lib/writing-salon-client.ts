import type { WsTribeEvent } from "@/lib/writing-salon-map";

export const WRITING_SALON_SITE = "https://www.writingsalons.com";
export const WRITING_SALON_CLASSES_URL = `${WRITING_SALON_SITE}/all-classes/`;
const TRIBE_EVENTS = `${WRITING_SALON_SITE}/wp-json/tribe/events/v1/events`;

const UA =
  "calendar_literary/1.0 (+https://github.com/taraprakash06/literary-events-calendar)";

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function monthDateRange(year: number, monthIndex: number): {
  startDate: string;
  endDate: string;
} {
  const startDate = `${year}-${pad2(monthIndex + 1)}-01 00:00:00`;
  const last = new Date(year, monthIndex + 1, 0).getDate();
  const endDate = `${year}-${pad2(monthIndex + 1)}-${pad2(last)} 23:59:59`;
  return { startDate, endDate };
}

type TribeListResponse = {
  events?: WsTribeEvent[];
  total_pages?: number;
};

/** Tribe JSON is sometimes prefixed with repeated HTML snippets. */
export function parseWritingSalonTribeJson(text: string): TribeListResponse {
  const cleaned = text.replace(/^(?:<p>No Current Classes<\/p>)+/, "").trim();
  return JSON.parse(cleaned) as TribeListResponse;
}

export async function fetchWritingSalonEventsForMonth(
  year: number,
  monthIndex: number,
  signal?: AbortSignal,
): Promise<WsTribeEvent[]> {
  const { startDate, endDate } = monthDateRange(year, monthIndex);
  const out: WsTribeEvent[] = [];
  const totalPagesCap = 15;
  let page = 1;

  while (page <= totalPagesCap) {
    const u = new URL(TRIBE_EVENTS);
    u.searchParams.set("start_date", startDate);
    u.searchParams.set("end_date", endDate);
    u.searchParams.set("per_page", "100");
    u.searchParams.set("page", String(page));
    u.searchParams.set("status", "publish");

    const res = await fetch(u.toString(), {
      signal,
      headers: { Accept: "application/json", "User-Agent": UA },
      cache: "no-store",
    });
    if (!res.ok) {
      throw new Error(`Writing Salon TEC HTTP ${res.status}`);
    }
    const data = parseWritingSalonTribeJson(await res.text());
    const batch = data.events ?? [];
    out.push(...batch);
    const totalPages = data.total_pages ?? page;
    if (page >= totalPages || batch.length === 0) break;
    page += 1;
  }

  return out;
}
