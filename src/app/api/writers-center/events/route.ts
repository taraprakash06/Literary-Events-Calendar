import { NextResponse } from "next/server";
import { DateTime } from "luxon";
import { fetchWritersCenterListingsForMonth } from "@/lib/writers-center-client";
import {
  priceDetailFromTwcCost,
  resolveWritersCenterPricingByUrls,
} from "@/lib/writers-center-details";
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

    const prelim = raw
      .flatMap((row) =>
        mapTwcEventToWorkshops(row, {
          priceDetail: priceDetailFromTwcCost(row),
        }),
      )
      .filter((ev) =>
        inRequestedMonth(ev.start, ev.timeZone, year, monthIndex),
      );

    // Only scrape pages for workshops that actually appear this month.
    const workshopUrls = [
      ...new Set(
        prelim
          .filter((ev) => ev.category === "workshop" && ev.price === "paid")
          .map((ev) => ev.rsvpUrl?.trim())
          .filter((u): u is string => Boolean(u)),
      ),
    ];
    const pricingByUrl = await resolveWritersCenterPricingByUrls(workshopUrls);

    const events = prelim.map((ev) => {
      const url = ev.rsvpUrl?.trim();
      const page = url ? pricingByUrl.get(url) : undefined;
      if (!page?.priceDetail) return ev;
      return {
        ...ev,
        price: page.price ?? ev.price,
        priceDetail: page.priceDetail,
      };
    });

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
        pagesResolved: pricingByUrl.size,
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
