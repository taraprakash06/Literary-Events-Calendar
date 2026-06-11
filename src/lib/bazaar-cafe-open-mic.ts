import { DateTime } from "luxon";
import type { WorkshopEvent } from "@/lib/workshop-types";
import { stripHtmlAndDecode, toShortOverview } from "@/lib/text";

const TZ = "America/Los_Angeles";
export const BAZAAR_CAFE_OPEN_MIC_URL = "https://bazaarcafe.com/open-mic/";
const WP_PAGE_URL = "https://bazaarcafe.com/wp-json/wp/v2/pages/97";

const UA =
  "calendar_literary/1.0 (+https://github.com/taraprakash06/literary-events-calendar)";

/** Thursday in Luxon (1 = Monday). */
const WEEKDAY = 4;
const START_HOUR = 19;
const START_MINUTE = 0;
const END_HOUR = 21;
const END_MINUTE = 30;

const DEFAULT_DESCRIPTION =
  "Weekly all-acoustic open mic at Bazaar Cafe. Original songs and poetry only (no covers). " +
  "Sign up in person or call (415) 831-5620; two songs or ten minutes per performer.";

export type BazaarCafeOpenMicMeta = {
  pageFetched: boolean;
  recurring: boolean;
  instancesInMonth: number;
};

function expandWeeklyInMonth(
  monthStart: DateTime,
  monthEnd: DateTime,
): { start: DateTime; end: DateTime }[] {
  const out: { start: DateTime; end: DateTime }[] = [];
  let day = monthStart.startOf("day");
  while (day <= monthEnd) {
    if (day.weekday === WEEKDAY) {
      const start = day.set({
        hour: START_HOUR,
        minute: START_MINUTE,
        second: 0,
        millisecond: 0,
      });
      const end = day.set({
        hour: END_HOUR,
        minute: END_MINUTE,
        second: 0,
        millisecond: 0,
      });
      out.push({ start, end });
    }
    day = day.plus({ days: 1 });
  }
  return out;
}

async function fetchPageBlurb(signal?: AbortSignal): Promise<string> {
  try {
    const res = await fetch(WP_PAGE_URL, {
      signal,
      headers: { Accept: "application/json", "User-Agent": UA },
      next: { revalidate: 600 },
    });
    if (!res.ok) return DEFAULT_DESCRIPTION;
    const page = (await res.json()) as { content?: { rendered?: string } };
    const html = page.content?.rendered ?? "";
    const plain = stripHtmlAndDecode(html).replace(/\s+/g, " ").trim();
    const schedule = plain.match(
      /Open Mics are held every Thursday evening,?\s*7:00-9:30\.?/i,
    )?.[0];
    const signup = plain.match(
      /Content must be your own \(no covers!\)\.[\s\S]{0,280}/i,
    )?.[0];
    const bits = [schedule, signup].filter(Boolean).join(" ");
    return bits ? toShortOverview(bits, 420) || bits : DEFAULT_DESCRIPTION;
  } catch {
    return DEFAULT_DESCRIPTION;
  }
}

function mapInstance(
  start: DateTime,
  end: DateTime,
  description: string,
): WorkshopEvent {
  return {
    id: `bazaar-cafe-open-mic-${start.toFormat("yyyyLLddHHmm")}`,
    cityId: "sf",
    title: "Open Mic",
    tagline: "Bazaar Cafe · Thursdays",
    description,
    start: start.toISO() ?? start.toString(),
    end: end.toISO() ?? undefined,
    timeZone: TZ,
    format: "in-person",
    price: "unknown",
    category: "open-mic",
    organizer: "Bazaar Cafe",
    venue: "Bazaar Cafe",
    address: "5927 California Street, San Francisco, CA 94121",
    neighborhood: "Richmond District",
    rsvpUrl: BAZAAR_CAFE_OPEN_MIC_URL,
    source: "Bazaar Cafe",
    sourceChannel: "literary_org",
    listingProvenance: "live",
  };
}

export async function fetchBazaarCafeOpenMicForMonth(
  year: number,
  monthIndex: number,
  signal?: AbortSignal,
): Promise<{ events: WorkshopEvent[]; meta: BazaarCafeOpenMicMeta }> {
  const description = await fetchPageBlurb(signal);

  const monthStart = DateTime.fromObject(
    { year, month: monthIndex + 1, day: 1 },
    { zone: TZ },
  ).startOf("day");
  const monthEnd = monthStart.endOf("month").endOf("day");

  const events = expandWeeklyInMonth(monthStart, monthEnd)
    .map((slot) => mapInstance(slot.start, slot.end, description))
    .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());

  return {
    events,
    meta: {
      pageFetched: true,
      recurring: true,
      instancesInMonth: events.length,
    },
  };
}
