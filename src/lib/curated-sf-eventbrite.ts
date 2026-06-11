import type { WorkshopEvent } from "@/lib/workshop-types";
import {
  eventInMonth,
  fetchEventbritePublicEvent,
  mapEventbritePublicToWorkshop,
} from "@/lib/eventbrite-public-page";

/** SF literary events on Eventbrite not covered by EVENTBRITE_ORGANIZATION_IDS. */
const CURATED_SF_EVENTBRITE_URLS = [
  "https://www.eventbrite.com/e/poetry-workshop-tickets-1988290475335",
] as const;

export type CuratedSfEventbriteMeta = {
  urlsChecked: number;
  eventsInMonth: number;
};

export async function fetchCuratedSfEventbriteForMonth(
  year: number,
  monthIndex: number,
  signal?: AbortSignal,
): Promise<{ events: WorkshopEvent[]; meta: CuratedSfEventbriteMeta }> {
  const events: WorkshopEvent[] = [];

  for (const url of CURATED_SF_EVENTBRITE_URLS) {
    const ctx = await fetchEventbritePublicEvent(url, signal);
    if (!ctx) continue;
    const mapped = mapEventbritePublicToWorkshop(ctx, "sf");
    if (!mapped) continue;
    if (
      eventInMonth(
        mapped.start,
        mapped.timeZone ?? "America/Los_Angeles",
        year,
        monthIndex,
      )
    ) {
      events.push(mapped);
    }
  }

  return {
    events,
    meta: {
      urlsChecked: CURATED_SF_EVENTBRITE_URLS.length,
      eventsInMonth: events.length,
    },
  };
}
