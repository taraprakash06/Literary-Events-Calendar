import type { WorkshopEvent } from "@/lib/workshop-types";

export const DC_ART_ALL_NIGHT_URL = "https://www.dcartallnight.org/";

export type DcArtAllNightMeta = {
  inMonth: boolean;
};

/**
 * Tenleytown Art All Night is visual-art programming, not a literary listing.
 * Kept as a no-op so existing API routes continue to resolve.
 */
export function fetchDcArtAllNightEventsForMonth(
  _year: number,
  _monthIndex: number,
): { events: WorkshopEvent[]; meta: DcArtAllNightMeta } {
  return { events: [], meta: { inMonth: false } };
}
