import { DateTime } from "luxon";
import type { WorkshopEvent } from "@/lib/workshop-types";

const TZ = "America/New_York";

export const WRITE_TO_RIGHT_REGISTRATION_URL =
  "https://docs.google.com/forms/d/e/1FAIpQLSeo9GasAltXuBWMue2Csjlt1xu-OzyiPonyyo80d9ymtH_vGQ/viewform";
export const WRITE_TO_RIGHT_PROGRAM_URL =
  "https://www.writetoright.co/summer-program-gaithersburg-library";

const VENUE = "Gaithersburg Library";
const ADDRESS = "18330 Montgomery Village Ave, Gaithersburg, MD 20879";
const NEIGHBORHOOD = "Gaithersburg";

const DESCRIPTION =
  "Completely free week-long summer writing workshop for students, held at Gaithersburg Library. " +
  "Register via the official Google Form. " +
  `Program details: ${WRITE_TO_RIGHT_PROGRAM_URL}`;

type ProgramSpec = {
  year: number;
  monthIndex: number;
  startDay: number;
  endDay: number;
  startHour: number;
  endHour: number;
};

/** Verified program dates from Write to Right registration pages. */
const PROGRAMS: ProgramSpec[] = [
  {
    year: 2026,
    monthIndex: 7,
    startDay: 17,
    endDay: 21,
    startHour: 13,
    endHour: 15,
  },
];

export type WriteToRightMeta = {
  programsInMonth: number;
  instancesInMonth: number;
};

function buildDayEvent(
  day: DateTime,
  dayIndex: number,
  totalDays: number,
  spec: ProgramSpec,
): WorkshopEvent {
  const start = day.set({
    hour: spec.startHour,
    minute: 0,
    second: 0,
    millisecond: 0,
  });
  const end = day.set({
    hour: spec.endHour,
    minute: 0,
    second: 0,
    millisecond: 0,
  });
  const dateKey = start.toFormat("yyyyLLdd");

  return {
    id: `write-to-right-summer-${dateKey}`,
    cityId: "dmv",
    title: "Write to Right Summer Program",
    tagline: `Gaithersburg Library · Free · Day ${dayIndex} of ${totalDays}`,
    description: DESCRIPTION,
    start: start.toISO() ?? start.toString(),
    end: end.toISO() ?? undefined,
    timeZone: TZ,
    format: "in-person",
    price: "free",
    category: "workshop",
    organizer: "Write to Right",
    venue: VENUE,
    address: ADDRESS,
    neighborhood: NEIGHBORHOOD,
    rsvpUrl: WRITE_TO_RIGHT_REGISTRATION_URL,
    source: "Write to Right",
    sourceChannel: "literary_org",
    listingProvenance: "live",
  };
}

export function fetchWriteToRightEventsForMonth(
  year: number,
  monthIndex: number,
): { events: WorkshopEvent[]; meta: WriteToRightMeta } {
  const events: WorkshopEvent[] = [];
  let programsInMonth = 0;

  for (const prog of PROGRAMS) {
    if (prog.year !== year || prog.monthIndex !== monthIndex) continue;
    programsInMonth++;
    const totalDays = prog.endDay - prog.startDay + 1;
    const monthStart = DateTime.fromObject(
      { year, month: monthIndex + 1, day: 1 },
      { zone: TZ },
    );
    for (let d = prog.startDay; d <= prog.endDay; d++) {
      const day = monthStart.set({ day: d });
      if (!day.isValid) continue;
      events.push(buildDayEvent(day, d - prog.startDay + 1, totalDays, prog));
    }
  }

  events.sort(
    (a, b) => new Date(a.start).getTime() - new Date(b.start).getTime(),
  );

  return {
    events,
    meta: {
      programsInMonth,
      instancesInMonth: events.length,
    },
  };
}
