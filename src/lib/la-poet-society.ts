import { DateTime } from "luxon";
import type {
  EventFormat,
  WorkshopEvent,
  WorkshopEventCategory,
} from "@/lib/workshop-types";

const TZ = "America/Los_Angeles";
export const LA_POET_SOCIETY_URL = "https://www.lapoetsociety.org/";

export type LaPoetSocietyMeta = {
  recurring: boolean;
  programs: number;
  instancesInMonth: number;
};

type TimeSlot = { hour: number; minute: number };
type Recurrence =
  | { kind: "weekly"; weekday: number }
  | { kind: "first"; weekday: number }
  | { kind: "last"; weekday: number }
  | { kind: "nth"; weekday: number; n: number };

type LaPoetSocietyProgram = {
  slug: string;
  title: string;
  tagline: string;
  description: string;
  recurrence: Recurrence;
  start: TimeSlot;
  end: TimeSlot;
  format: EventFormat;
  category: WorkshopEventCategory;
  venue?: string;
  address?: string;
  neighborhood?: string;
  virtualLabel?: string;
  rsvpUrl: string;
};

const PROGRAMS: LaPoetSocietyProgram[] = [
  {
    slug: "fresh-fridays",
    title: "Fresh Fridays Open Mic",
    tagline: "LA Poet Society · First Fridays",
    description:
      "Open mic for all types of performers, hosted by Los Angeles Poet Society at Señor Fish Eagle Rock.",
    recurrence: { kind: "first", weekday: 5 },
    start: { hour: 19, minute: 0 },
    end: { hour: 21, minute: 0 },
    format: "in-person",
    category: "open-mic",
    venue: "Señor Fish Eagle Rock",
    address: "4803 Eagle Rock Blvd, Los Angeles, CA 90041",
    neighborhood: "Eagle Rock",
    rsvpUrl: LA_POET_SOCIETY_URL,
  },
  {
    slug: "heartbeat-open-mic",
    title: "Heartbeat Open Mic",
    tagline: "LA Poet Society · Last Saturdays",
    description:
      "Monthly open mic at The Libros Lincoln Heights Bookstore, presented by Los Angeles Poet Society.",
    recurrence: { kind: "last", weekday: 6 },
    start: { hour: 18, minute: 0 },
    end: { hour: 20, minute: 0 },
    format: "in-person",
    category: "open-mic",
    venue: "The Libros Lincoln Heights Bookstore",
    address: "3422 N Broadway, Los Angeles, CA 90031",
    neighborhood: "Lincoln Heights",
    rsvpUrl: LA_POET_SOCIETY_URL,
  },
  {
    slug: "talking-hearts",
    title: "Talking Hearts Writing Circle",
    tagline: "LA Poet Society · 2nd Mondays",
    description:
      "Community writing circle hosted by Los Angeles Poet Society. Registration required: losangelespoetsociety@gmail.com",
    recurrence: { kind: "nth", weekday: 1, n: 2 },
    start: { hour: 17, minute: 30 },
    end: { hour: 19, minute: 0 },
    format: "in-person",
    category: "workshop",
    venue: "Bodevi Wine & Espresso Bar",
    address: "909 San Fernando Rd, San Fernando, CA 91340",
    neighborhood: "San Fernando",
    rsvpUrl: "mailto:losangelespoetsociety@gmail.com",
  },
  // Virtual radio / Instagram Live programs with only generic station or
  // profile homepage links (e.g. radioollin.org) are intentionally omitted —
  // they are not dated event pages.
  {
    slug: "poetry-on-demand",
    title: "Poetry on Demand",
    tagline: "LA Poet Society · Sundays at Melrose Trading Post",
    description:
      "Pop-up poetry at the Melrose Trading Post (Fairfax High School), presented by Los Angeles Poet Society.",
    recurrence: { kind: "weekly", weekday: 7 },
    start: { hour: 12, minute: 0 },
    end: { hour: 17, minute: 0 },
    format: "in-person",
    category: "open-mic",
    venue: "Melrose Trading Post",
    address: "7850 Melrose Ave, Los Angeles, CA 90046",
    neighborhood: "Fairfax",
    rsvpUrl: LA_POET_SOCIETY_URL,
  },
];

function applyTime(day: DateTime, slot: TimeSlot): DateTime {
  return day.set({
    hour: slot.hour,
    minute: slot.minute,
    second: 0,
    millisecond: 0,
  });
}

function nthWeekdayInMonth(
  monthStart: DateTime,
  monthEnd: DateTime,
  weekday: number,
  n: number,
): DateTime | null {
  let count = 0;
  let day = monthStart.startOf("day");
  while (day <= monthEnd) {
    if (day.weekday === weekday) {
      count++;
      if (count === n) return day;
    }
    day = day.plus({ days: 1 });
  }
  return null;
}

function lastWeekdayInMonth(
  monthStart: DateTime,
  monthEnd: DateTime,
  weekday: number,
): DateTime | null {
  let found: DateTime | null = null;
  let day = monthStart.startOf("day");
  while (day <= monthEnd) {
    if (day.weekday === weekday) found = day;
    day = day.plus({ days: 1 });
  }
  return found;
}

function daysForRecurrence(
  recurrence: Recurrence,
  monthStart: DateTime,
  monthEnd: DateTime,
): DateTime[] {
  if (recurrence.kind === "weekly") {
    const out: DateTime[] = [];
    let day = monthStart.startOf("day");
    while (day <= monthEnd) {
      if (day.weekday === recurrence.weekday) out.push(day);
      day = day.plus({ days: 1 });
    }
    return out;
  }
  if (recurrence.kind === "first") {
    const d = nthWeekdayInMonth(monthStart, monthEnd, recurrence.weekday, 1);
    return d ? [d] : [];
  }
  if (recurrence.kind === "last") {
    const d = lastWeekdayInMonth(monthStart, monthEnd, recurrence.weekday);
    return d ? [d] : [];
  }
  const d = nthWeekdayInMonth(
    monthStart,
    monthEnd,
    recurrence.weekday,
    recurrence.n,
  );
  return d ? [d] : [];
}

function mapInstance(
  program: LaPoetSocietyProgram,
  day: DateTime,
): WorkshopEvent {
  const start = applyTime(day, program.start);
  const end = applyTime(day, program.end);
  return {
    id: `la-poet-society-${program.slug}-${start.toFormat("yyyyLLddHHmm")}`,
    cityId: "la",
    title: program.title,
    tagline: program.tagline,
    description: program.description,
    start: start.toISO() ?? start.toString(),
    end: end.toISO() ?? undefined,
    timeZone: TZ,
    format: program.format,
    price: "free",
    category: program.category,
    organizer: "Los Angeles Poet Society",
    venue: program.venue,
    address: program.address,
    neighborhood: program.neighborhood,
    virtualLabel: program.virtualLabel,
    rsvpUrl: program.rsvpUrl,
    source: "Los Angeles Poet Society",
    sourceChannel: "literary_org",
    listingProvenance: "live",
  };
}

export async function fetchLaPoetSocietyEventsForMonth(
  year: number,
  monthIndex: number,
): Promise<{ events: WorkshopEvent[]; meta: LaPoetSocietyMeta }> {
  const monthStart = DateTime.fromObject(
    { year, month: monthIndex + 1, day: 1 },
    { zone: TZ },
  ).startOf("day");
  const monthEnd = monthStart.endOf("month").endOf("day");

  const events: WorkshopEvent[] = [];
  for (const program of PROGRAMS) {
    for (const day of daysForRecurrence(program.recurrence, monthStart, monthEnd)) {
      events.push(mapInstance(program, day));
    }
  }

  events.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());

  return {
    events,
    meta: {
      recurring: true,
      programs: PROGRAMS.length,
      instancesInMonth: events.length,
    },
  };
}
