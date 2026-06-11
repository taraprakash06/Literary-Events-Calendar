import { NextResponse } from "next/server";
import {
  GALERIA_CALENDAR_URL,
  fetchGaleriaEventsForMonth,
} from "@/lib/galeria-de-la-raza-client";
import { mapGaleriaTribeEventToWorkshop } from "@/lib/galeria-de-la-raza-map";
import {
  LUNADA_LOUNGE_URL,
  mergeGaleriaWithLunadaLounge,
} from "@/lib/lunada-literary-lounge";

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
    const raw = await fetchGaleriaEventsForMonth(year, monthIndex);
    const mapped = raw
      .map((row) => mapGaleriaTribeEventToWorkshop(row))
      .filter((e): e is NonNullable<typeof e> => e !== null);
    const events = mergeGaleriaWithLunadaLounge(mapped, year, monthIndex);

    return NextResponse.json({
      events,
      meta: {
        year,
        month: monthIndex + 1,
        source: GALERIA_CALENDAR_URL,
        lunadaLounge: LUNADA_LOUNGE_URL,
        fetched: raw.length,
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "fetch failed";
    return NextResponse.json({ error: message, events: [] }, { status: 502 });
  }
}
