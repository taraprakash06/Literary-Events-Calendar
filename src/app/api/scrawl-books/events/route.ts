import { NextResponse } from "next/server";
import { fetchScrawlBooksEventRowsForMonth } from "@/lib/scrawl-books-client";
import { mapScrawlEventRowToWorkshop } from "@/lib/scrawl-books-map";

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
    const { rows, store } = await fetchScrawlBooksEventRowsForMonth(year, monthIndex);
    const events = rows
      .map((row) => mapScrawlEventRowToWorkshop(row, store))
      .filter((e): e is NonNullable<typeof e> => e !== null);

    return NextResponse.json({
      events,
      meta: {
        year,
        month: monthIndex + 1,
        source: "https://www.scrawlbooks.com/events",
        store: store.name,
        fetched: rows.length,
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "fetch failed";
    return NextResponse.json({ error: message, events: [] }, { status: 502 });
  }
}
