import { DateTime } from "luxon";
import type { WorkshopEvent } from "@/lib/workshop-types";

const TZ = "America/New_York";
export const DC_ART_ALL_NIGHT_URL = "https://www.dcartallnight.org/";

const EVENT = {
  year: 2026,
  monthIndex: 8, // September
  day: 12,
  title: "Tenleytown Art All Night",
  venue: "Tenley-Friendship Library",
  address: "Washington, DC",
  neighborhood: "Tenleytown",
} as const;

export type DcArtAllNightMeta = {
  inMonth: boolean;
};

/**
 * Curated listing for Tenleytown Art All Night at Tenley-Friendship Library.
 * Time is TBD on the source page — stored as noon local so it lands on the day.
 */
export function fetchDcArtAllNightEventsForMonth(
  year: number,
  monthIndex: number,
): { events: WorkshopEvent[]; meta: DcArtAllNightMeta } {
  if (year !== EVENT.year || monthIndex !== EVENT.monthIndex) {
    return { events: [], meta: { inMonth: false } };
  }

  // Noon placeholder when the organizer has not published a start time.
  const start = DateTime.fromObject(
    {
      year: EVENT.year,
      month: EVENT.monthIndex + 1,
      day: EVENT.day,
      hour: 12,
      minute: 0,
      second: 0,
      millisecond: 0,
    },
    { zone: TZ },
  );

  const ev: WorkshopEvent = {
    id: "dc-art-all-night-tenleytown-20260912",
    cityId: "dmv",
    title: EVENT.title,
    tagline: "Tenley-Friendship Library · Free · All ages · Time TBD",
    description:
      "Neighborhood celebration of creativity, culture, and community as part of DC Art All Night. " +
      "Held at Tenley-Friendship Library in Washington, DC. Free and open to all ages. Time TBD — " +
      `check ${DC_ART_ALL_NIGHT_URL} for updates.`,
    start: start.toISO() ?? start.toString(),
    timeZone: TZ,
    timeTbd: true,
    format: "in-person",
    price: "free",
    category: "other",
    organizer: "DC Art All Night",
    venue: EVENT.venue,
    address: EVENT.address,
    neighborhood: EVENT.neighborhood,
    rsvpUrl: DC_ART_ALL_NIGHT_URL,
    source: "DC Art All Night",
    sourceChannel: "literary_org",
    listingProvenance: "live",
  };

  return { events: [ev], meta: { inMonth: true } };
}
