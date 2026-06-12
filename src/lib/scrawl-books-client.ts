/**
 * Scrawl Books (Reston, VA) uses TBM Bookmanager.
 * Source: https://www.scrawlbooks.com/events
 */

import {
  fetchBookmanagerEventRowsForMonth,
  type BookmanagerEventV2Row,
  type BookmanagerStoreInfo,
} from "@/lib/bookmanager-client";

const DEFAULT_WEBSTORE_SAN = "9900276";

export function getScrawlWebstoreSan(): string {
  const raw = process.env.SCRAWL_BOOKMANAGER_WEBSTORE_SAN?.trim();
  return raw && raw.length > 0 ? raw : DEFAULT_WEBSTORE_SAN;
}

export type ScrawlStoreInfo = BookmanagerStoreInfo;
export type ScrawlEventV2Row = BookmanagerEventV2Row;

export async function fetchScrawlBooksEventRowsForMonth(
  year: number,
  monthIndex: number,
  signal?: AbortSignal,
): Promise<{ rows: ScrawlEventV2Row[]; store: ScrawlStoreInfo }> {
  return fetchBookmanagerEventRowsForMonth(
    getScrawlWebstoreSan(),
    year,
    monthIndex,
    signal,
  );
}
