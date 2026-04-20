import { NextResponse } from "next/server";
import {
  MD_HUMANITIES_EVENTS_PAGE,
  fetchMdHumanitiesEventsForMonth,
} from "@/lib/mdhumanities-client";
import { mapMdHumTribeEventToWorkshop } from "@/lib/mdhumanities-map";

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
    const raw = await fetchMdHumanitiesEventsForMonth(year, monthIndex);
    const events = raw
      .map((row) => mapMdHumTribeEventToWorkshop(row))
      .filter((e): e is NonNullable<typeof e> => e !== null);

    return NextResponse.json({
      events,
      meta: {
        year,
        month: monthIndex + 1,
        source: MD_HUMANITIES_EVENTS_PAGE,
        fetched: raw.length,
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "fetch failed";
    return NextResponse.json({ error: message, events: [] }, { status: 502 });
  }
}
