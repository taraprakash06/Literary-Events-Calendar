import { NextResponse } from "next/server";
import { DateTime } from "luxon";
import {
  BUSBOYS_POETS_EVENTS_LIST,
  BUSBOYS_POETS_TIMEZONE,
  fetchBusboysPoetsEventRowsFromMonthStart,
  parseBusboysRowStart,
} from "@/lib/busboys-poets-client";
import { mapBusboysRowToWorkshop } from "@/lib/busboys-poets-map";
import { resolveFullBusboysTitles } from "@/lib/busboys-poets-titles";

export const revalidate = 600;

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const y = Number(searchParams.get("year"));
  const m = Number(searchParams.get("month"));
  const now = new Date();
  const year = Number.isFinite(y) && y >= 2000 && y <= 2100 ? y : now.getFullYear();
  const monthIndex =
    Number.isFinite(m) && m >= 1 && m <= 12 ? m - 1 : now.getMonth();

  const monthStart = DateTime.fromObject(
    { year, month: monthIndex + 1, day: 1 },
    { zone: BUSBOYS_POETS_TIMEZONE },
  ).startOf("day");
  const monthEnd = monthStart.endOf("month").endOf("day");

  try {
    const raw = await fetchBusboysPoetsEventRowsFromMonthStart(year, monthIndex);
    const monthRows = raw.filter((row) => {
      const start = parseBusboysRowStart(row);
      return start && start >= monthStart && start <= monthEnd;
    });
    const fullTitles = await resolveFullBusboysTitles(monthRows);
    const events = raw
      .map((row) =>
        mapBusboysRowToWorkshop(row, {
          monthStart,
          monthEnd,
          titleOverride: fullTitles.get(row.ID),
        }),
      )
      .filter((e): e is NonNullable<typeof e> => e !== null);

    return NextResponse.json({
      events,
      meta: {
        year,
        month: monthIndex + 1,
        source: BUSBOYS_POETS_EVENTS_LIST,
        fetched: raw.length,
        matched: events.length,
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "fetch failed";
    return NextResponse.json({ error: message, events: [] }, { status: 502 });
  }
}
