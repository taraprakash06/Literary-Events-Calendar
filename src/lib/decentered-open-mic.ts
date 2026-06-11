import { DateTime } from "luxon";
import type { WorkshopEvent } from "@/lib/workshop-types";

const TZ = "America/Los_Angeles";
export const DECENTERED_OPEN_MIC_URL = "https://decentered.org/events/open-mic";

/** Tuesday in Luxon (1 = Monday). */
const WEEKDAY = 2;
const START_HOUR = 19;
const START_MINUTE = 0;
const END_HOUR = 22;
const END_MINUTE = 0;

const DESCRIPTION =
  "Weekly multi-genre open mic at The Decentered Studio — poetry, comedy, music, dance, and more. " +
  "Walk-in sign-ups; all ages; free. House PA available.";

export type DecenteredOpenMicMeta = {
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

function mapInstance(start: DateTime, end: DateTime): WorkshopEvent {
  return {
    id: `decentered-open-mic-${start.toFormat("yyyyLLddHHmm")}`,
    cityId: "sf",
    title: "Decentered Arts Open Mic",
    tagline: "Decentered Studio · Tuesdays",
    description: DESCRIPTION,
    start: start.toISO() ?? start.toString(),
    end: end.toISO() ?? undefined,
    timeZone: TZ,
    format: "in-person",
    price: "free",
    category: "open-mic",
    organizer: "Decentered Studio",
    venue: "The Decentered Studio",
    address: "1175 Folsom St #2A, San Francisco, CA",
    neighborhood: "SoMa",
    rsvpUrl: DECENTERED_OPEN_MIC_URL,
    source: "Decentered Arts",
    sourceChannel: "literary_org",
    listingProvenance: "live",
  };
}

export async function fetchDecenteredOpenMicForMonth(
  year: number,
  monthIndex: number,
): Promise<{ events: WorkshopEvent[]; meta: DecenteredOpenMicMeta }> {
  const monthStart = DateTime.fromObject(
    { year, month: monthIndex + 1, day: 1 },
    { zone: TZ },
  ).startOf("day");
  const monthEnd = monthStart.endOf("month").endOf("day");

  const events = expandWeeklyInMonth(monthStart, monthEnd)
    .map((slot) => mapInstance(slot.start, slot.end))
    .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());

  return {
    events,
    meta: {
      recurring: true,
      instancesInMonth: events.length,
    },
  };
}
