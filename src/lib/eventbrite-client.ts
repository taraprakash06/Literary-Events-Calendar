import type { EbEventResource } from "@/lib/eventbrite-map";
import type { AppCityId } from "@/lib/eventbrite-geo";

const EB_API = "https://www.eventbriteapi.com/v3";

function authHeaders(token: string): HeadersInit {
  return { Authorization: `Bearer ${token}` };
}

type EbPaginated<T> = {
  events?: T[];
  pagination?: {
    has_more_items?: boolean;
    continuation?: string;
    page_count?: number;
    page_number?: number;
  };
};

function monthRangeUTC(year: number, monthIndex: number): {
  rangeStart: string;
  rangeEnd: string;
} {
  const start = new Date(Date.UTC(year, monthIndex, 1, 0, 0, 0));
  const end = new Date(Date.UTC(year, monthIndex + 1, 0, 23, 59, 59));
  return {
    rangeStart: start.toISOString().replace(/\.\d{3}Z$/, "Z"),
    rangeEnd: end.toISOString().replace(/\.\d{3}Z$/, "Z"),
  };
}

async function fetchAllEventPages(
  token: string,
  path: string,
  year: number,
  monthIndex: number,
  extraParams: Record<string, string | undefined> = {},
  maxPages = 8,
): Promise<EbEventResource[]> {
  const { rangeStart, rangeEnd } = monthRangeUTC(year, monthIndex);
  const out: EbEventResource[] = [];

  for (let page = 1; page <= maxPages; page++) {
    const u = new URL(`${EB_API}${path}`);
    u.searchParams.set("status", "live");
    u.searchParams.set("order_by", "start_asc");
    u.searchParams.set("expand", "venue");
    u.searchParams.set("start_date.range_start", rangeStart);
    u.searchParams.set("start_date.range_end", rangeEnd);
    u.searchParams.set("page", String(page));
    for (const [k, v] of Object.entries(extraParams)) {
      if (v) u.searchParams.set(k, v);
    }

    const res = await fetch(u.toString(), {
      headers: authHeaders(token),
      cache: "no-store",
    });
    if (!res.ok) {
      const err = await res.text().catch(() => "");
      throw new Error(`Eventbrite ${path} HTTP ${res.status} ${err.slice(0, 200)}`);
    }
    const data = (await res.json()) as EbPaginated<EbEventResource>;
    const batch = data.events ?? [];
    if (batch.length === 0) break;
    out.push(...batch);

    const pn = data.pagination?.page_number ?? page;
    const pc = data.pagination?.page_count ?? pn;
    if (pn >= pc) break;
  }
  return out;
}

function citySearchParams(cityId: AppCityId): { address: string; within: string } {
  switch (cityId) {
    case "dmv":
      return { address: "Washington, DC", within: "40mi" };
    case "nyc":
      return { address: "New York, NY", within: "30mi" };
    case "sf":
      return { address: "San Francisco, CA", within: "35mi" };
    case "la":
      return { address: "Los Angeles, CA", within: "35mi" };
  }
}

export function getEventbriteToken(): string | null {
  const t =
    process.env.EVENTBRITE_API_TOKEN?.trim() ||
    process.env.EVENTBRITE_OAUTH_TOKEN?.trim();
  return t && t.length > 0 ? t : null;
}

export function parseOrganizationIds(): string[] {
  const raw = process.env.EVENTBRITE_ORGANIZATION_IDS?.trim();
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter((s) => /^\d+$/.test(s));
}

/** Events you own (organizer account tied to the private token). */
export async function fetchOwnedEventsForMonth(
  token: string,
  year: number,
  monthIndex: number,
): Promise<EbEventResource[]> {
  return fetchAllEventPages(token, "/users/me/owned_events/", year, monthIndex);
}

/** Events under specific organization IDs (comma-separated in env). */
export async function fetchOrganizationEventsForMonth(
  token: string,
  orgId: string,
  year: number,
  monthIndex: number,
): Promise<EbEventResource[]> {
  return fetchAllEventPages(
    token,
    `/organizations/${encodeURIComponent(orgId)}/events/`,
    year,
    monthIndex,
  );
}

/**
 * Public Eventbrite search for writing workshops + literary events.
 * Note: still requires a valid Eventbrite token.
 */
export async function fetchKeywordSearchEventsForMonth(
  token: string,
  cityId: AppCityId,
  year: number,
  monthIndex: number,
): Promise<EbEventResource[]> {
  const { address, within } = citySearchParams(cityId);
  const queries = [
    "writing workshop",
    "creative writing",
    "writers workshop",
    "book club",
    "poetry reading",
    "open mic",
    "author talk",
    "literary",
    "memoir",
  ];

  const seen = new Set<string>();
  const merged: EbEventResource[] = [];

  for (const q of queries) {
    const rows = await fetchAllEventPages(
      token,
      "/events/search/",
      year,
      monthIndex,
      {
        q,
        "location.address": address,
        "location.within": within,
      },
      5,
    );
    for (const ev of rows) {
      if (!seen.has(ev.id)) {
        seen.add(ev.id);
        merged.push(ev);
      }
    }
  }

  return merged;
}

export async function fetchAllSourceEventsForMonth(
  token: string,
  year: number,
  monthIndex: number,
): Promise<EbEventResource[]> {
  const orgIds = parseOrganizationIds();
  const seen = new Set<string>();
  const merged: EbEventResource[] = [];

  const owned = await fetchOwnedEventsForMonth(token, year, monthIndex);
  for (const ev of owned) {
    if (!seen.has(ev.id)) {
      seen.add(ev.id);
      merged.push(ev);
    }
  }

  for (const orgId of orgIds) {
    const rows = await fetchOrganizationEventsForMonth(
      token,
      orgId,
      year,
      monthIndex,
    );
    for (const ev of rows) {
      if (!seen.has(ev.id)) {
        seen.add(ev.id);
        merged.push(ev);
      }
    }
  }

  return merged;
}
