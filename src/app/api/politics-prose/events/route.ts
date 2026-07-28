import { NextResponse } from "next/server";
import {
  fetchPoliticsProseCalendarEvents,
  POLITICS_PROSE_ORIGIN,
} from "@/lib/politics-prose-client";
import { mapPnpEventToWorkshop } from "@/lib/politics-prose-map";

export const revalidate = 600;

/**
 * Politics & Prose rate-limits (HTTP 429) when we scrape every event page on
 * month load. About/price are filled on demand via /api/event-page-enrich when
 * the user opens a listing.
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const y = Number(searchParams.get("year"));
  const m = Number(searchParams.get("month"));
  const now = new Date();
  const year = Number.isFinite(y) && y >= 2000 && y <= 2100 ? y : now.getFullYear();
  const monthIndex =
    Number.isFinite(m) && m >= 1 && m <= 12 ? m - 1 : now.getMonth();

  try {
    const raw = await fetchPoliticsProseCalendarEvents(year, monthIndex);
    const events = raw
      .map((row) => mapPnpEventToWorkshop(row))
      .filter((e): e is NonNullable<typeof e> => e !== null);

    return NextResponse.json({
      events,
      meta: {
        year,
        month: monthIndex + 1,
        source: "https://politics-prose.com/events/calendar",
        listPage: "https://politics-prose.com/upcoming-events",
        origin: POLITICS_PROSE_ORIGIN,
        fetched: raw.length,
        matched: events.length,
        pageEnrichment: "on-demand",
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "fetch failed";
    return NextResponse.json(
      { error: message, events: [] },
      { status: 502 },
    );
  }
}
