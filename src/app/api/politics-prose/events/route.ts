import { NextResponse } from "next/server";
import { fetchPoliticsProseCalendarEvents } from "@/lib/politics-prose-client";
import { mapPnpEventToWorkshop } from "@/lib/politics-prose-map";

export const revalidate = 600;

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
        fetched: raw.length,
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
