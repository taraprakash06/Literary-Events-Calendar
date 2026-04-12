import { NextResponse } from "next/server";
import {
  MCPL_DEFAULT_EVENT_TYPE,
  isMcplLiteraryWritingEvent,
  mapMcplLibnetRowToWorkshopEvent,
  mcplEeventCalUrl,
  type McplLibnetRawEvent,
} from "@/lib/mcpl-libnet";
import {
  buildDcplEeventCalReq,
  firstDayOfMonthISO,
  libnetMonthDaySpan,
} from "@/lib/dcpl-libnet";

export const revalidate = 300;

function resolveWorkshopCityId(raw: string | null): string {
  const t = raw?.trim();
  if (t === "dmv" || t === "dc" || t === "mcpl") return t;
  return "mcpl";
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const y = Number(searchParams.get("year"));
  const m = Number(searchParams.get("month"));
  const now = new Date();
  const year = Number.isFinite(y) && y >= 2000 && y <= 2100 ? y : now.getFullYear();
  const monthIndex =
    Number.isFinite(m) && m >= 1 && m <= 12 ? m - 1 : now.getMonth();

  const workshopCityId = resolveWorkshopCityId(searchParams.get("cityId"));

  const eventType =
    searchParams.get("eventType")?.trim() || MCPL_DEFAULT_EVENT_TYPE;

  const date = firstDayOfMonthISO(year, monthIndex);
  const daySpan = libnetMonthDaySpan(year, monthIndex);
  const payload = buildDcplEeventCalReq({ date, daySpan });
  const url = mcplEeventCalUrl(payload, eventType);

  try {
    const res = await fetch(url, { next: { revalidate: 300 } });
    if (!res.ok) {
      return NextResponse.json(
        { error: `LibNet HTTP ${res.status}`, sourceUrl: url },
        { status: 502 },
      );
    }
    const data: unknown = await res.json();
    if (!Array.isArray(data)) {
      return NextResponse.json(
        { error: "LibNet returned non-array JSON", sourceUrl: url },
        { status: 502 },
      );
    }
    const rows = data as McplLibnetRawEvent[];
    const literary = rows.filter(isMcplLiteraryWritingEvent);
    const events = literary.map((row) =>
      mapMcplLibnetRowToWorkshopEvent(row, workshopCityId),
    );
    return NextResponse.json({
      events,
      meta: {
        year,
        month: monthIndex + 1,
        dateFrom: date,
        daySpan,
        libnetUrl: url,
        totalFetched: rows.length,
        literaryCount: events.length,
        workshopCityId,
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "fetch failed";
    return NextResponse.json(
      { error: message, sourceUrl: url },
      { status: 502 },
    );
  }
}
