/**
 * Busboys and Poets exposes a custom REST route used by their events list page
 * (Load More / filters). Source aligned with:
 * https://www.busboysandpoets.com/events-list/
 */

import { DateTime } from "luxon";

export const BUSBOYS_POETS_EVENTS_LIST =
  "https://www.busboysandpoets.com/events-list/";

const EVENTS_MORE_API =
  "https://www.busboysandpoets.com/wp-json/wp/v2/events/more";

const TZ = "America/New_York";

export type BusboysEventsMoreRow = {
  ID: number;
  url: string;
  thumbnail?: string;
  /** e.g. "Apr 1, 2026 6:00 pm" */
  date: string;
  name: string;
  venue: string | null;
  price?: string;
  category?: string;
};

export type BusboysEventsMoreResponse = {
  Events?: BusboysEventsMoreRow[];
  where?: unknown;
};

const UA = "calendar_literary/1.0 (+https://github.com/taraprakash06/literary-events-calendar)";

function monthStartQueryDate(year: number, monthIndex: number): string {
  const mm = String(monthIndex + 1).padStart(2, "0");
  return `${mm}-01-${year}`;
}

export function parseBusboysRowStart(row: BusboysEventsMoreRow): DateTime | null {
  const raw = (row.date ?? "").trim();
  if (!raw) return null;
  const dt = DateTime.fromFormat(raw, "LLL d, yyyy h:mm a", { zone: TZ });
  return dt.isValid ? dt : null;
}

/**
 * Fetches event rows from the first day of the month onward (API behavior), then the
 * caller should filter to the exact calendar month.
 */
export async function fetchBusboysPoetsEventRowsFromMonthStart(
  year: number,
  monthIndex: number,
  signal?: AbortSignal,
): Promise<BusboysEventsMoreRow[]> {
  const date = monthStartQueryDate(year, monthIndex);
  const limit = 50;
  const out: BusboysEventsMoreRow[] = [];
  const monthEnd = DateTime.fromObject(
    { year, month: monthIndex + 1, day: 1 },
    { zone: TZ },
  ).endOf("month");

  for (let offset = 0, page = 0; page < 60; page++) {
    if (signal?.aborted) {
      const e = new Error("Aborted");
      e.name = "AbortError";
      throw e;
    }
    const u = new URL(EVENTS_MORE_API);
    u.searchParams.set("limit", String(limit));
    u.searchParams.set("offset", String(offset));
    u.searchParams.set("date", date);

    const res = await fetch(u.toString(), {
      headers: { Accept: "application/json", "User-Agent": UA },
      cache: "no-store",
      signal,
    });
    if (!res.ok) {
      const t = await res.text().catch(() => "");
      throw new Error(`Busboys and Poets events/more HTTP ${res.status} ${t.slice(0, 200)}`);
    }
    const body = (await res.json()) as BusboysEventsMoreResponse;
    const batch = Array.isArray(body.Events) ? body.Events : [];
    if (batch.length === 0) break;
    out.push(...batch);

    const starts = batch
      .map(parseBusboysRowStart)
      .filter((d): d is DateTime => d !== null);
    if (
      starts.length > 0 &&
      starts.every((s) => s.startOf("day") > monthEnd.startOf("day"))
    ) {
      break;
    }

    if (batch.length < limit) break;
    offset += limit;
  }

  return out;
}

export { TZ as BUSBOYS_POETS_TIMEZONE };
