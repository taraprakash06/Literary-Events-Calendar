/**
 * Stories Books & Cafe (Echo Park, LA) uses TBM Bookmanager.
 * Source: https://www.storiesla.com/events
 */

import {
  fetchBookmanagerEventRowsForMonth,
  type BookmanagerEventV2Row,
  type BookmanagerStoreInfo,
} from "@/lib/bookmanager-client";

export const STORIES_LA_EVENTS_URL = "https://www.storiesla.com/events";
const DEFAULT_WEBSTORE_SAN = "8034753";

export function getStoriesLaWebstoreSan(): string {
  const raw = process.env.STORIES_LA_BOOKMANAGER_WEBSTORE_SAN?.trim();
  return raw && raw.length > 0 ? raw : DEFAULT_WEBSTORE_SAN;
}

export type StoriesLaStoreInfo = BookmanagerStoreInfo;
export type StoriesLaEventV2Row = BookmanagerEventV2Row;

export async function fetchStoriesLaEventRowsForMonth(
  year: number,
  monthIndex: number,
  signal?: AbortSignal,
): Promise<{ rows: StoriesLaEventV2Row[]; store: StoriesLaStoreInfo }> {
  return fetchBookmanagerEventRowsForMonth(
    getStoriesLaWebstoreSan(),
    year,
    monthIndex,
    signal,
  );
}
