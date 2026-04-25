import { NextResponse } from "next/server";
import { getEventbriteToken, fetchOrganizerEventsForMonth } from "@/lib/eventbrite-client";
import { mapEbEventToWorkshop } from "@/lib/eventbrite-map";
import { fetchStrandEventsForMonth } from "@/lib/strand-books";

export const revalidate = 600;

const STRAND_ORGANIZER_ID = "30058841244";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const y = Number(searchParams.get("year"));
  const m = Number(searchParams.get("month"));
  const now = new Date();
  const year = Number.isFinite(y) && y >= 2000 && y <= 2100 ? y : now.getFullYear();
  const monthIndex =
    Number.isFinite(m) && m >= 1 && m <= 12 ? m - 1 : now.getMonth();

  // Prefer the Eventbrite API (reliable, complete) when configured.
  const token = getEventbriteToken();
  if (token) {
    try {
      const raw = await fetchOrganizerEventsForMonth(token, STRAND_ORGANIZER_ID, year, monthIndex);
      const events = raw
        .map((ev) => mapEbEventToWorkshop(ev, "nyc"))
        .filter((e): e is NonNullable<typeof e> => e != null);
      if (events.length > 0) {
        return NextResponse.json({
          events,
          meta: {
            year,
            month: monthIndex + 1,
            source: "https://www.strandbooks.com/events.html",
            via: `https://www.eventbrite.com/o/the-strand-book-store-${STRAND_ORGANIZER_ID}`,
            viaApi: true,
            sourceCount: raw.length,
            mappedCount: events.length,
          },
        });
      }
      // If the API returns 0 (often due to permission/model mismatch), fall back to HTML parsing.
    } catch (e) {
      const message = e instanceof Error ? e.message : "Eventbrite request failed";
      // If the token is invalid, treat Eventbrite as effectively unconfigured and fall back.
      if (/HTTP 401\b/i.test(message) || /INVALID_AUTH/i.test(message)) {
        // fall through
      } else {
        return NextResponse.json(
          { error: message, events: [], meta: { year, month: monthIndex + 1, viaApi: true } },
          { status: 502 },
        );
      }
    }
  }

  // Fallback: attempt parsing the public Eventbrite organizer HTML (may be incomplete).
  try {
    const { events, meta } = await fetchStrandEventsForMonth(year, monthIndex);
    return NextResponse.json({
      events,
      meta: {
        year,
        month: monthIndex + 1,
        source: "https://www.strandbooks.com/events.html",
        via: `https://www.eventbrite.com/o/the-strand-book-store-${STRAND_ORGANIZER_ID}`,
        viaApi: false,
        ...meta,
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "fetch failed";
    return NextResponse.json(
      { error: message, events: [], meta: { year, month: monthIndex + 1, viaApi: false } },
      { status: 502 },
    );
  }
}

