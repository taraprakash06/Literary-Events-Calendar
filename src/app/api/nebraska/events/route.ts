import { NextResponse } from "next/server";
import { fetchNebraskaCuratedEventsForMonth } from "@/lib/nebraska-curated";

export const revalidate = 600;

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const y = Number(searchParams.get("year"));
  const m = Number(searchParams.get("month"));
  const now = new Date();
  const year = Number.isFinite(y) && y >= 2000 && y <= 2100 ? y : now.getFullYear();
  const monthIndex =
    Number.isFinite(m) && m >= 1 && m <= 12 ? m - 1 : now.getMonth();

  const { events, meta } = fetchNebraskaCuratedEventsForMonth(year, monthIndex);
  return NextResponse.json({
    events,
    meta: {
      year,
      month: monthIndex + 1,
      source: "Omaha / Lincoln curated listings",
      ...meta,
      mappedCount: events.length,
    },
  });
}
