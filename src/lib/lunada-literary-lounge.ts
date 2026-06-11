import { DateTime } from "luxon";
import type { WorkshopEvent } from "@/lib/workshop-types";

const TZ = "America/Los_Angeles";

/** Open mic sign-ups and program info. */
export const LUNADA_LOUNGE_URL =
  "https://galeriadelaraza.org/lunada-literary-lounge/";

const VENUE = "Galería de la Raza Studio 24";
const ADDRESS = "2779 Folsom St Suite A, San Francisco, CA 94110";

const DESCRIPTION =
  "Lunada Literary Lounge gathers to honor spoken word, poetry, música, and literatura. " +
  "On its silver anniversary, Galería hosts seasonal new-moon gatherings in 2026. " +
  "Open mic sign-ups are on the Lunada Literary Lounge page.";

/**
 * 2026 new-moon gatherings listed on the Lunada Literary Lounge program page.
 * @see https://galeriadelaraza.org/lunada-literary-lounge/
 */
const LUNADA_GATHERINGS_2026: {
  date: string;
  calendarUrl?: string;
}[] = [
  {
    date: "2026-04-17",
    calendarUrl:
      "https://galeriadelaraza.org/calendar/lunada-new-moon-fest-2026/",
  },
  {
    date: "2026-06-14",
    calendarUrl:
      "https://galeriadelaraza.org/calendar/lunada-new-moon-fest-2026-2/",
  },
  { date: "2026-10-10" },
];

const START_HOUR = 17;
const END_HOUR = 22;

export function isLunadaEventTitle(title: string): boolean {
  return /\blunada\b/i.test(title);
}

function dayKey(iso: string, zone = TZ): string {
  const dt = DateTime.fromISO(iso, { setZone: true }).setZone(zone);
  return dt.isValid ? dt.toFormat("yyyy-MM-dd") : "";
}

function buildLunadaEvent(
  date: string,
  calendarUrl?: string,
): WorkshopEvent | null {
  const start = DateTime.fromISO(`${date}T00:00:00`, { zone: TZ }).set({
    hour: START_HOUR,
    minute: 0,
    second: 0,
    millisecond: 0,
  });
  if (!start.isValid) return null;
  const end = start.set({ hour: END_HOUR, minute: 0 });

  return {
    id: `lunada-lounge-${date.replace(/-/g, "")}`,
    cityId: "sf",
    title: "Lunada Literary Lounge — New Moon Fest 2026",
    tagline: "Galería de la Raza · Open mic",
    description: DESCRIPTION,
    start: start.toISO() ?? start.toString(),
    end: end.toISO() ?? undefined,
    timeZone: TZ,
    format: "in-person",
    price: "free",
    category: "open-mic",
    organizer: "Galería de la Raza",
    venue: VENUE,
    address: ADDRESS,
    neighborhood: "Mission District",
    rsvpUrl: LUNADA_LOUNGE_URL,
    source: "Lunada Literary Lounge (Galería de la Raza)",
    sourceChannel: "literary_org",
    listingProvenance: "live",
    ...(calendarUrl ? { tagline: `${VENUE} · Open mic sign-ups` } : {}),
  };
}

/** Program-page instances for a calendar month (fills gaps when not yet on Tribe calendar). */
export function lunadaLiteraryLoungeEventsForMonth(
  year: number,
  monthIndex: number,
): WorkshopEvent[] {
  const month = monthIndex + 1;
  const out: WorkshopEvent[] = [];

  for (const row of LUNADA_GATHERINGS_2026) {
    const [y, m] = row.date.split("-").map(Number);
    if (y !== year || m !== month) continue;
    const ev = buildLunadaEvent(row.date, row.calendarUrl);
    if (ev) out.push(ev);
  }

  return out;
}

/** Merge Tribe calendar rows with Lunada program dates; open-mic RSVP → lounge page. */
export function mergeGaleriaWithLunadaLounge(
  apiEvents: WorkshopEvent[],
  year: number,
  monthIndex: number,
): WorkshopEvent[] {
  const enhanced = apiEvents.map((ev) =>
    isLunadaEventTitle(ev.title)
      ? {
          ...ev,
          rsvpUrl: LUNADA_LOUNGE_URL,
          tagline: ev.tagline || "Lunada Literary Lounge · Open mic sign-ups",
        }
      : ev,
  );

  const coveredDays = new Set(
    enhanced
      .filter((ev) => isLunadaEventTitle(ev.title))
      .map((ev) => dayKey(ev.start, ev.timeZone ?? TZ)),
  );

  for (const loungeEv of lunadaLiteraryLoungeEventsForMonth(year, monthIndex)) {
    const key = dayKey(loungeEv.start, loungeEv.timeZone ?? TZ);
    if (!coveredDays.has(key)) {
      enhanced.push(loungeEv);
      coveredDays.add(key);
    }
  }

  return enhanced.sort(
    (a, b) => new Date(a.start).getTime() - new Date(b.start).getTime(),
  );
}
