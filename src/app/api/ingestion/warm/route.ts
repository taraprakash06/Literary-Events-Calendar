import { CITIES } from "@/data/cities";

export const dynamic = "force-dynamic";

type WarmResult = {
  url: string;
  ok: boolean;
  status?: number;
  ms: number;
  eventsCount?: number;
  error?: string;
};

function monthParamsFromReq(req: Request): { year: number; monthIndex: number } {
  const { searchParams } = new URL(req.url);
  const y = Number(searchParams.get("year"));
  const m = Number(searchParams.get("month"));
  const now = new Date();
  const year = Number.isFinite(y) && y >= 2000 && y <= 2100 ? y : now.getFullYear();
  const monthIndex = Number.isFinite(m) && m >= 1 && m <= 12 ? m - 1 : now.getMonth();
  return { year, monthIndex };
}

function baseUrlFromReq(req: Request): string {
  const u = new URL(req.url);
  return `${u.protocol}//${u.host}`;
}

function endpointsForCity(cityId: string): string[] {
  // These are the same endpoints the UI uses per-city.
  if (cityId === "dmv") {
    return [
      "/api/dcpl/events",
      "/api/mcpl/events",
      "/api/writers-center/events",
      "/api/politics-prose/events",
      "/api/scrawl-books/events",
      "/api/busboys-poets/events",
      "/api/mdhumanities/events",
      "/api/planet-word/events",
      "/api/write-to-right/events",
      "/api/dc-art-all-night/events",
      "/api/dmv-curated/events",
      "/api/eventbrite/events",
    ];
  }
  if (cityId === "nyc") {
    return [
      "/api/nypl/events",
      "/api/center-for-fiction/events",
      "/api/just-buffalo/events",
      "/api/poets-house/events",
      "/api/strand/events",
      "/api/92ny/events",
      "/api/nuyorican/events",
      "/api/eventbrite/events",
    ];
  }
  if (cityId === "la") {
    return [
      "/api/lapl/events",
      "/api/lyric-hyperion/events",
      "/api/la-literature/annual-events",
      "/api/last-bookstore/events",
      "/api/skylight-books/events",
      "/api/writegirl/events",
      "/api/da-poetry-lounge-open-mic/events",
      "/api/world-stage/events",
      "/api/stories-la/events",
      "/api/la-poet-society/events",
      "/api/la-curated/events",
      "/api/eventbrite/events",
    ];
  }
  if (cityId === "sf") {
    return [
      "/api/sfpl/events",
      "/api/writing-salon/events",
      "/api/shut-up-and-write/events",
      "/api/dothebay-poetry-open-mic/events",
      "/api/bazaar-cafe-open-mic/events",
      "/api/decentered-open-mic/events",
      "/api/galeria-de-la-raza/events",
      "/api/curated-sf-eventbrite/events",
      "/api/sf-curated/events",
      "/api/sf-writers-workshop/events",
      "/api/writers-grotto/events",
      "/api/eventbrite/events",
    ];
  }
  if (cityId === "tn") {
    return ["/api/tennessee/events"];
  }
  if (cityId === "ne") {
    return ["/api/nebraska/events", "/api/omaha-public-library/events"];
  }
  return [];
}

export async function GET(req: Request) {
  const { year, monthIndex } = monthParamsFromReq(req);
  const base = baseUrlFromReq(req);

  const results: Record<string, WarmResult[]> = {};

  for (const city of CITIES) {
    const endpoints = endpointsForCity(city.id);
    const cityResults: WarmResult[] = [];

    for (const ep of endpoints) {
      const u = new URL(`${base}${ep}`);
      u.searchParams.set("year", String(year));
      u.searchParams.set("month", String(monthIndex + 1));
      if (ep === "/api/eventbrite/events") u.searchParams.set("cityId", city.id);

      const t0 = Date.now();
      try {
        const ac = new AbortController();
        const timeout = setTimeout(() => ac.abort(), 12_000);
        const res = await fetch(u.toString(), { cache: "no-store", signal: ac.signal });
        clearTimeout(timeout);
        const ms = Date.now() - t0;
        const status = res.status;
        let eventsCount: number | undefined = undefined;
        try {
          const body = (await res.json()) as { events?: unknown };
          if (Array.isArray(body.events)) eventsCount = body.events.length;
        } catch {
          /* ignore json errors */
        }
        cityResults.push({
          url: u.toString(),
          ok: res.ok,
          status,
          ms,
          eventsCount,
        });
      } catch (e) {
        const ms = Date.now() - t0;
        cityResults.push({
          url: u.toString(),
          ok: false,
          ms,
          error: e instanceof Error ? e.message : String(e),
        });
      }
    }

    results[city.id] = cityResults;
  }

  return Response.json({
    warmedAt: new Date().toISOString(),
    year,
    month: monthIndex + 1,
    results,
  });
}

