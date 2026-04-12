import type { WorkshopEvent } from "@/lib/workshop-types";

/**
 * Live events only — populate from ingestion (APIs, iCal, RSS, etc.).
 * Do not add fabricated rows here; every listing must map to a verifiable source.
 */
export const WORKSHOP_EVENTS: WorkshopEvent[] = [];

export function eventsForCity(cityId: string): WorkshopEvent[] {
  return WORKSHOP_EVENTS.filter((e) => e.cityId === cityId);
}
