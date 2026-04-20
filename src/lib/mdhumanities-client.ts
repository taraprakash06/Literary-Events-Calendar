/**
 * Maryland Humanities publishes events via The Events Calendar REST API.
 * Source aligned with: https://www.mdhumanities.org/events/
 */

export const MD_HUMANITIES_SITE = "https://www.mdhumanities.org";
export const MD_HUMANITIES_EVENTS_PAGE = `${MD_HUMANITIES_SITE}/events/`;

const TRIBE_EVENTS = `${MD_HUMANITIES_SITE}/wp-json/tribe/events/v1/events`;

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

/** Subset of Tribe v1 event JSON used by Maryland Humanities. */
export type MdHumTribeEvent = {
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
  is_virtual?: boolean | null;
  virtual_url?: string | null;
  venue?:
    | {
        venue?: string;
        address?: string;
        city?: string;
        state?: string;
        zip?: string;
        geo_lat?: string | number | null;
        geo_lng?: string | number | null;
      }
    | unknown[];
  categories?: Array<{ name?: string; slug?: string }>;
  tags?: Array<{ name?: string; slug?: string }>;
};

type TribeListResponse = {
  events?: MdHumTribeEvent[];
  total_pages?: number;
};

const UA = "calendar_literary/1.0 (+https://github.com/taraprakash06/literary-events-calendar)";

export async function fetchMdHumanitiesEventsForMonth(
  year: number,
  monthIndex: number,
  signal?: AbortSignal,
): Promise<MdHumTribeEvent[]> {
  const { startDate, endDate } = monthDateRange(year, monthIndex);
  const out: MdHumTribeEvent[] = [];
  const totalPagesCap = 15;
  let page = 1;

  while (page <= totalPagesCap) {
    if (signal?.aborted) {
      const e = new Error("Aborted");
      e.name = "AbortError";
      throw e;
    }
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
      const t = await res.text().catch(() => "");
      throw new Error(`Maryland Humanities TEC HTTP ${res.status} ${t.slice(0, 200)}`);
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
