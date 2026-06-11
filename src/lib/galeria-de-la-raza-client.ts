/**
 * Galería de la Raza calendar — The Events Calendar REST API.
 * @see https://galeriadelaraza.org/calendar/
 */

export const GALERIA_SITE = "https://galeriadelaraza.org";
export const GALERIA_CALENDAR_URL = `${GALERIA_SITE}/calendar/`;

const TRIBE_EVENTS = `${GALERIA_SITE}/wp-json/tribe/events/v1/events`;

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

export type GaleriaTribeEvent = {
  id: number;
  title: string | { rendered?: string };
  url: string;
  excerpt?: string;
  description?: string;
  start_date?: string;
  end_date?: string;
  timezone?: string;
  all_day?: boolean;
  cost?: string;
  is_virtual?: boolean | null;
  categories?: { slug?: string; name?: string }[];
  venue?:
    | {
        venue?: string;
        address?: string;
        city?: string;
        state?: string;
        zip?: string;
      }
    | unknown[];
};

type TribeListResponse = {
  events?: GaleriaTribeEvent[];
  total_pages?: number;
};

export async function fetchGaleriaEventsForMonth(
  year: number,
  monthIndex: number,
  signal?: AbortSignal,
): Promise<GaleriaTribeEvent[]> {
  const { startDate, endDate } = monthDateRange(year, monthIndex);
  const out: GaleriaTribeEvent[] = [];
  const totalPagesCap = 10;
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
      next: { revalidate: 600 },
    });
    if (!res.ok) {
      throw new Error(`Galería de la Raza TEC HTTP ${res.status}`);
    }

    const data = (await res.json()) as TribeListResponse;
    const batch = data.events ?? [];
    out.push(...batch);
    if (batch.length === 0 || page >= (data.total_pages ?? 1)) break;
    page += 1;
  }

  return out;
}
