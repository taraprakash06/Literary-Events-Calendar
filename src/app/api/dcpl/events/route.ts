import { NextResponse } from "next/server";
import {
  DCPL_DEFAULT_EVENT_TYPE,
  DCPL_DEFAULT_TYPE_FILTERS,
  buildDcplEeventCalReq,
  dcplEeventCalUrl,
  firstDayOfMonthISO,
  libnetMonthDaySpan,
  mapDcplLibnetRowToWorkshopEvent,
  type DcplLibnetRawEvent,
} from "@/lib/dcpl-libnet";

export const revalidate = 300;

function parseTypesParam(raw: string | null): string[] | undefined {
  if (raw === null || raw === "") return [...DCPL_DEFAULT_TYPE_FILTERS];
  if (raw.trim().toLowerCase() === "all") return undefined;
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function resolveWorkshopCityId(raw: string | null): string {
  const t = raw?.trim();
  if (t === "dmv" || t === "dc" || t === "mcpl") return t;
  return "dc";
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

  const types = parseTypesParam(searchParams.get("types"));
  const eventType = searchParams.get("eventType")?.trim() || DCPL_DEFAULT_EVENT_TYPE;

  const date = firstDayOfMonthISO(year, monthIndex);
  const daySpan = libnetMonthDaySpan(year, monthIndex);
  const payload = buildDcplEeventCalReq({ date, daySpan, types });
  const url = dcplEeventCalUrl(payload, eventType);

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
    const events = (data as DcplLibnetRawEvent[]).map((row) =>
      mapDcplLibnetRowToWorkshopEvent(row, workshopCityId),
    );
    return NextResponse.json({
      events,
      meta: {
        year,
        month: monthIndex + 1,
        dateFrom: date,
        daySpan,
        types: types ?? null,
        libnetUrl: url,
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
