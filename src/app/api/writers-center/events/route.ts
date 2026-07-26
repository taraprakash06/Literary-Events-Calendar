import { NextResponse } from "next/server";
import { DateTime } from "luxon";
import { fetchWritersCenterListingsForMonth } from "@/lib/writers-center-client";
import { mapTwcEventToWorkshops } from "@/lib/writers-center-map";

export const revalidate = 600;

function inRequestedMonth(
  startIso: string,
  timeZone: string | undefined,
  year: number,
  monthIndex: number,
): boolean {
  const zone = timeZone?.trim() || "America/New_York";
  const dt = DateTime.fromISO(startIso, { zone: "utc" }).setZone(zone);
  if (!dt.isValid) return false;
  return dt.year === year && dt.month === monthIndex + 1;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const y = Number(searchParams.get("year"));
  const m = Number(searchParams.get("month"));
  const now = new Date();
  const year = Number.isFinite(y) && y >= 2000 && y <= 2100 ? y : now.getFullYear();
  const monthIndex =
    Number.isFinite(m) && m >= 1 && m <= 12 ? m - 1 : now.getMonth();

  try {
    const raw = await fetchWritersCenterListingsForMonth(year, monthIndex);
    const events = raw
      .flatMap((row) => mapTwcEventToWorkshops(row))
      .filter((ev) =>
        inRequestedMonth(ev.start, ev.timeZone, year, monthIndex),
      );

    return NextResponse.json({
      events,
      meta: {
        year,
        month: monthIndex + 1,
        source: "https://writer.org/free-events-calendar/",
        workshopsSource: "https://writer.org/workshops/",
        categories: ["workshop", "event"],
        fetched: raw.length,
        listed: events.length,
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
