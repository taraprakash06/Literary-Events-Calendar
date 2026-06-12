import { DateTime } from "luxon";
import type { WorkshopEvent } from "@/lib/workshop-types";

const TZ = "America/Los_Angeles";
export const DA_POETRY_LOUNGE_TUESDAYS_URL =
  "https://www.dapoetrylounge.com/events/tuesdays";
export const DA_POETRY_LOUNGE_OPEN_MIC_URL =
  "https://www.dapoetrylounge.com/events/open-mic-night";
export const DA_POETRY_LOUNGE_SLAM_URL =
  "https://www.dapoetrylounge.com/events/slam-night";
export const DA_POETRY_LOUNGE_WOMAN_FEMME_URL =
  "https://www.dapoetrylounge.com/events/woman-femme-night";

/** Tuesday in Luxon (1 = Monday). */
const WEEKDAY = 2;
const DEFAULT_START_HOUR = 20;
const DEFAULT_END_HOUR = 23;

const COC_VENUE = {
  venue: "Community Owned Center (COC)",
  address: "4276 Crenshaw Blvd, Los Angeles, CA 90008",
  neighborhood: "Leimert Park",
} as const;

const COLYTON_VENUE = {
  venue: "Da Poetry Lounge",
  address: "430 Colyton St, Los Angeles, CA 90013",
  neighborhood: "Downtown LA",
} as const;

const BASE_DESCRIPTION =
  "Poetry open mic from Da Poetry Lounge Co. Walk-up sign-ups, all ages welcome. " +
  "Doors open around 8:15pm; pay at the door ($10 suggested donation).";

export type DaPoetryLoungeOpenMicMeta = {
  recurring: boolean;
  instancesInMonth: number;
  usedCuratedMonth?: boolean;
};

type TimeSlot = { hour: number; minute: number };
type VenueInfo = {
  venue: string;
  address: string;
  neighborhood: string;
};

type OccurrenceSpec = {
  day: number;
  title: string;
  description?: string;
  start?: TimeSlot;
  end?: TimeSlot;
  venue?: VenueInfo;
  rsvpUrl?: string;
  price?: WorkshopEvent["price"];
};

/** Verified monthly calendars published by DPL (e.g. Instagram). */
const CURATED_BY_MONTH: Record<string, OccurrenceSpec[]> = {
  "2026-06": [
    {
      day: 2,
      title: "Open Mic — Slam Team Sendoff",
      venue: COC_VENUE,
      rsvpUrl: DA_POETRY_LOUNGE_OPEN_MIC_URL,
    },
    {
      day: 9,
      title: "Open Mic — Founders Night",
      description:
        "DPL Founders 28th Anniversary open mic. Walk-up sign-ups, all ages welcome. " +
        "Doors open 8:15pm; $10 suggested donation or pay what you can.",
      venue: COC_VENUE,
      rsvpUrl: DA_POETRY_LOUNGE_OPEN_MIC_URL,
    },
    {
      day: 16,
      title: "Open Cash Slam — Juneteenth",
      description:
        "Cash slam poetry competition for Juneteenth, part of the DPL Summer Series. Pay at the door.",
      venue: COLYTON_VENUE,
      rsvpUrl: DA_POETRY_LOUNGE_SLAM_URL,
    },
    {
      day: 23,
      title: "Open Mic Night",
      venue: COLYTON_VENUE,
      rsvpUrl: DA_POETRY_LOUNGE_OPEN_MIC_URL,
    },
    {
      day: 30,
      title: "Open Mic — Women & Femmes Night",
      venue: COLYTON_VENUE,
      rsvpUrl: DA_POETRY_LOUNGE_WOMAN_FEMME_URL,
    },
  ],
};

function summerSeriesVenue(day: DateTime): VenueInfo {
  // DPL Summer Series (mid-June through late August) at Colyton St.
  const inSummer =
    (day.month === 6 && day.day >= 16) ||
    day.month === 7 ||
    (day.month === 8 && day.day <= 25);
  return inSummer ? { ...COLYTON_VENUE } : { ...COC_VENUE };
}

function isThirdTuesday(dt: DateTime): boolean {
  return dt.weekday === WEEKDAY && dt.day >= 15 && dt.day <= 21;
}

function isLastTuesdayOfMonth(dt: DateTime, monthEnd: DateTime): boolean {
  if (dt.weekday !== WEEKDAY) return false;
  let last: DateTime | null = null;
  let day = dt.startOf("month");
  while (day <= monthEnd) {
    if (day.weekday === WEEKDAY) last = day;
    day = day.plus({ days: 1 });
  }
  return last?.toISODate() === dt.toISODate();
}

function applyTime(day: DateTime, slot: TimeSlot): DateTime {
  return day.set({
    hour: slot.hour,
    minute: slot.minute,
    second: 0,
    millisecond: 0,
  });
}

function mapOccurrence(
  start: DateTime,
  end: DateTime,
  spec: {
    title: string;
    description: string;
    venue: VenueInfo;
    rsvpUrl: string;
    price: WorkshopEvent["price"];
  },
): WorkshopEvent {
  return {
    id: `da-poetry-lounge-open-mic-${start.toFormat("yyyyLLddHHmm")}`,
    cityId: "la",
    title: spec.title,
    tagline: "Da Poetry Lounge · Tuesdays",
    description: spec.description,
    start: start.toISO() ?? start.toString(),
    end: end.toISO() ?? undefined,
    timeZone: TZ,
    format: "in-person",
    price: spec.price,
    category: "open-mic",
    organizer: "Da Poetry Lounge",
    venue: spec.venue.venue,
    address: spec.venue.address,
    neighborhood: spec.venue.neighborhood,
    rsvpUrl: spec.rsvpUrl,
    source: "Da Poetry Lounge",
    sourceChannel: "literary_org",
    listingProvenance: "live",
  };
}

function curatedEventsForMonth(
  year: number,
  monthIndex: number,
  monthStart: DateTime,
  monthEnd: DateTime,
): WorkshopEvent[] | null {
  const key = `${year}-${String(monthIndex + 1).padStart(2, "0")}`;
  const specs = CURATED_BY_MONTH[key];
  if (!specs?.length) return null;

  return specs
    .map((spec) => {
      const day = monthStart.set({ day: spec.day });
      if (!day.isValid || day < monthStart || day > monthEnd) return null;
      const start = applyTime(day, spec.start ?? { hour: DEFAULT_START_HOUR, minute: 0 });
      const end = applyTime(day, spec.end ?? { hour: DEFAULT_END_HOUR, minute: 0 });
      const venue = spec.venue ?? summerSeriesVenue(day);
      return mapOccurrence(start, end, {
        title: spec.title,
        description: spec.description ?? BASE_DESCRIPTION,
        venue,
        rsvpUrl: spec.rsvpUrl ?? DA_POETRY_LOUNGE_OPEN_MIC_URL,
        price: spec.price ?? "unknown",
      });
    })
    .filter((e): e is WorkshopEvent => e != null)
    .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
}

function fallbackEventsForMonth(
  monthStart: DateTime,
  monthEnd: DateTime,
): WorkshopEvent[] {
  const out: WorkshopEvent[] = [];
  let day = monthStart.startOf("day");
  while (day <= monthEnd) {
    if (day.weekday === WEEKDAY) {
      const start = applyTime(day, { hour: DEFAULT_START_HOUR, minute: 0 });
      const end = applyTime(day, { hour: DEFAULT_END_HOUR, minute: 0 });
      const venue = summerSeriesVenue(day);
      const lastTue = isLastTuesdayOfMonth(day, monthEnd);
      const thirdTue = isThirdTuesday(day);

      let title = "Open Mic Night";
      let rsvpUrl = DA_POETRY_LOUNGE_OPEN_MIC_URL;
      if (thirdTue) {
        title = "Open Cash Slam";
        rsvpUrl = DA_POETRY_LOUNGE_SLAM_URL;
      } else if (lastTue) {
        title = "Open Mic — Women & Femmes Night";
        rsvpUrl = DA_POETRY_LOUNGE_WOMAN_FEMME_URL;
      }

      out.push(
        mapOccurrence(start, end, {
          title,
          description: BASE_DESCRIPTION,
          venue,
          rsvpUrl,
          price: "unknown",
        }),
      );
    }
    day = day.plus({ days: 1 });
  }
  return out;
}

export async function fetchDaPoetryLoungeOpenMicForMonth(
  year: number,
  monthIndex: number,
): Promise<{ events: WorkshopEvent[]; meta: DaPoetryLoungeOpenMicMeta }> {
  const monthStart = DateTime.fromObject(
    { year, month: monthIndex + 1, day: 1 },
    { zone: TZ },
  ).startOf("day");
  const monthEnd = monthStart.endOf("month").endOf("day");

  const curated = curatedEventsForMonth(year, monthIndex, monthStart, monthEnd);
  const events = curated ?? fallbackEventsForMonth(monthStart, monthEnd);

  return {
    events,
    meta: {
      recurring: true,
      instancesInMonth: events.length,
      ...(curated ? { usedCuratedMonth: true } : {}),
    },
  };
}
