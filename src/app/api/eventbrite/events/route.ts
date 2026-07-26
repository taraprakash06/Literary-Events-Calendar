import { NextResponse } from "next/server";
import {
  fetchAllSourceEventsForMonth,
  getEventbriteToken,
} from "@/lib/eventbrite-client";
import { cityIdForEbEvent, mapEbEventToWorkshop } from "@/lib/eventbrite-map";
import type { AppCityId } from "@/lib/eventbrite-geo";
import {
  eventInMonth,
  fetchEventbritePublicEvent,
  mapEventbritePublicToWorkshop,
} from "@/lib/eventbrite-public-page";
import type { WorkshopEvent } from "@/lib/workshop-types";

const ALLOWED: AppCityId[] = ["dmv", "nyc", "la", "sf"];

const CURATED_PUBLIC_URLS: Partial<Record<AppCityId, readonly string[]>> = {
  nyc: [
    "https://www.eventbrite.com/e/adore-amor-hosted-by-the-bronx-is-reading-tickets-1992780713759",
    "https://www.eventbrite.com/e/embodied-voices-a-poetry-reading-and-conversation-tickets-1992951157561",
    "https://www.eventbrite.com/e/disturbing-the-peace-an-open-mic-reading-with-poets-out-loud-tickets-1994925936177",
    "https://www.eventbrite.com/e/poetry-afternoon-reading-by-michele-wolf-richard-levine-and-barbara-ungar-tickets-1994871545493",
    "https://www.eventbrite.com/e/translating-sonnets-tickets-1992948280957",
    "https://www.eventbrite.com/e/hot-people-read-poetry-make-it-work-tickets-1992844445382",
    "https://www.eventbrite.com/e/ecopoetics-workshop-tickets-1991816334274",
    "https://www.eventbrite.com/e/the-writing-group-readings-and-social-in-williamsburg-tickets-1993395483552",
    "https://www.eventbrite.com/e/acw-ad-hoc-poetry-workshops-tickets-1991481000281",
    "https://www.eventbrite.com/e/poetry-today-book-club-sonnets-by-ingrid-jacobsen-tickets-1993770351793",
    "https://www.eventbrite.com/e/in-store-indie-press-spotlight-new-poetry-from-wave-books-tickets-1992780187184",
    "https://www.eventbrite.com/e/the-gift-of-reading-kin-by-tayari-jones-tickets-1994520871618",
    "https://www.eventbrite.com/e/books-iced-coffee-a-side-of-dragons-amanda-lovelace-tickets-1992827866795",
    "https://www.eventbrite.com/e/verse-takes-flight-a-poetry-book-club-at-lofty-pigeon-books-tickets-1992661392867",
    "https://www.eventbrite.com/e/emily-wilson-jhumpa-lahiri-crossing-the-wine-dark-sea-tickets-1991937154651",
    "https://www.eventbrite.com/e/the-writing-group-at-brooklyn-art-haus-tickets-1990295671932",
  ],
};

function resolveCityParam(raw: string | null): AppCityId | null {
  const t = raw?.trim() as AppCityId;
  return ALLOWED.includes(t) ? t : null;
}

async function fetchCuratedPublicEvents(
  cityId: AppCityId,
  year: number,
  monthIndex: number,
): Promise<WorkshopEvent[]> {
  const events: WorkshopEvent[] = [];
  for (const url of CURATED_PUBLIC_URLS[cityId] ?? []) {
    try {
      const context = await fetchEventbritePublicEvent(url);
      if (!context) continue;
      let event = mapEventbritePublicToWorkshop(context, cityId);
      // This open mic is free; Eventbrite exposes the suggested donation
      // as ticketing, which otherwise makes the generic mapper call it paid.
      if (event?.id === "eventbrite-public-1994925936177") {
        event = { ...event, price: "free" };
      }
      if (event?.id === "eventbrite-public-1992948280957") {
        event = {
          ...event,
          tagline: `Only a few tickets left · ${event.tagline}`,
        };
      }
      if (event?.id === "eventbrite-public-1991937154651") {
        // Bio text includes "creative writing"; this is an author talk.
        event = { ...event, category: "reading" };
      }
      if (
        event &&
        eventInMonth(
          event.start,
          event.timeZone ?? "America/New_York",
          year,
          monthIndex,
        )
      ) {
        events.push(event);
      }
    } catch {
      // A single public Eventbrite page should not take down the full feed.
    }
  }
  return events;
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

  const y = Number(searchParams.get("year"));
  const m = Number(searchParams.get("month"));
  const now = new Date();
  const year = Number.isFinite(y) && y >= 2000 && y <= 2100 ? y : now.getFullYear();
  const monthIndex =
    Number.isFinite(m) && m >= 1 && m <= 12 ? m - 1 : now.getMonth();
  const curated = await fetchCuratedPublicEvents(cityId, year, monthIndex);

  const token = getEventbriteToken();
  if (!token) {
    return NextResponse.json({
      events: curated,
      meta: {
        configured: false,
        cityId,
        year,
        month: monthIndex + 1,
        curatedCount: curated.length,
        message:
          "Eventbrite API is not configured; direct curated Eventbrite listings are still included.",
      },
    });
  }

  try {
    const seen = new Set(curated.map((event) => event.id));
    const events: WorkshopEvent[] = [...curated];
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
        curatedCount: curated.length,
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
