import { NextResponse } from "next/server";
import {
  fetchAllSourceEventsForMonth,
  getEventbriteToken,
} from "@/lib/eventbrite-client";
import { cityIdForEbEvent, mapEbEventToWorkshop } from "@/lib/eventbrite-map";
import type { AppCityId } from "@/lib/eventbrite-geo";

const ALLOWED: AppCityId[] = ["dmv", "nyc", "la", "sf"];

function resolveCityParam(raw: string | null): AppCityId | null {
  const t = raw?.trim() as AppCityId;
  return ALLOWED.includes(t) ? t : null;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const cityId = resolveCityParam(searchParams.get("cityId"));
  if (!cityId) {
    return NextResponse.json(
      { error: "Missing or invalid cityId (dmv, nyc, la, sf)." },
      { status: 400 },
    );
  }

  const token = getEventbriteToken();
  if (!token) {
    return NextResponse.json({
      events: [],
      meta: {
        configured: false,
        message:
          "Set EVENTBRITE_API_TOKEN (or EVENTBRITE_OAUTH_TOKEN) in .env.local. Events are loaded from events you own and optional organization IDs.",
      },
    });
  }

  const y = Number(searchParams.get("year"));
  const m = Number(searchParams.get("month"));
  const now = new Date();
  const year = Number.isFinite(y) && y >= 2000 && y <= 2100 ? y : now.getFullYear();
  const monthIndex =
    Number.isFinite(m) && m >= 1 && m <= 12 ? m - 1 : now.getMonth();

  try {
    const seen = new Set<string>();
    const events = [];
    const raw = await fetchAllSourceEventsForMonth(token, year, monthIndex);
    for (const ev of raw) {
      if (seen.has(ev.id)) continue;
      seen.add(ev.id);
      const resolved = cityIdForEbEvent(ev);
      if (resolved !== cityId) continue;
      const row = mapEbEventToWorkshop(ev, cityId);
      if (row) events.push(row);
    }
    return NextResponse.json({
      events,
      meta: {
        configured: true,
        cityId,
        year,
        month: monthIndex + 1,
        sourceCount: raw.length,
        matchedCount: events.length,
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Eventbrite request failed";
    return NextResponse.json({
      events: [],
      meta: { configured: true, cityId, year, month: monthIndex + 1 },
      error: message,
    });
  }
}
