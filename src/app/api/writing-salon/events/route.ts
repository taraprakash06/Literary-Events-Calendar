import { NextResponse } from "next/server";
import { fetchWritingSalonEventsForMonth } from "@/lib/writing-salon-client";
import { mapWritingSalonEventToWorkshops } from "@/lib/writing-salon-map";

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
    const raw = await fetchWritingSalonEventsForMonth(year, monthIndex);
    const events = raw.flatMap((row) => mapWritingSalonEventToWorkshops(row));

    return NextResponse.json({
      events,
      meta: {
        year,
        month: monthIndex + 1,
        source: "https://www.writingsalons.com/all-classes/",
        fetched: raw.length,
        rowsInMonth: events.length,
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "fetch failed";
    return NextResponse.json(
      { error: message, events: [], meta: { year, month: monthIndex + 1 } },
      { status: 502 },
    );
  }
}
