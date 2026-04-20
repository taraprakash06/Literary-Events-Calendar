/**
 * Scrawl Books (Reston, VA) uses TBM Bookmanager. Their public events UI loads
 * from the Bookmanager customer API (same origin pattern as the storefront bundle).
 * Source: https://www.scrawlbooks.com/events
 */

const BOOKMANAGER_CUSTOMER_API = "https://api.bookmanager.com/customer/";

const DEFAULT_WEBSTORE_SAN = "9900276";

export function getScrawlWebstoreSan(): string {
  const raw = process.env.SCRAWL_BOOKMANAGER_WEBSTORE_SAN?.trim();
  return raw && raw.length > 0 ? raw : DEFAULT_WEBSTORE_SAN;
}

export type ScrawlStoreInfo = {
  id: number;
  san: string;
  name: string;
  address?: string;
  city?: string;
  province?: string;
  postal_code?: string;
  url?: string;
  base_url?: string;
};

export type ScrawlStoreSettingsResponse = {
  store_info: ScrawlStoreInfo;
  error?: string;
};

export type ScrawlSessionResponse = {
  session_id: string;
  error?: string;
};

export type ScrawlEventV2Row = {
  id: number;
  title: string;
  description?: string;
  summary?: string;
  /** YYYYMMDD */
  date: string;
  start_time?: string;
  end_time?: string;
  all_day?: boolean;
  location_text?: string;
  category?: { id: number; name: string; colour?: string };
};

export type ScrawlEventListResponse = {
  rows?: ScrawlEventV2Row[];
  error?: string;
};

const UA = "calendar_literary/1.0 (+https://github.com/taraprakash06/literary-events-calendar)";

async function bookmanagerFormPost<T>(
  webstoreSan: string,
  path: string,
  uuid: string,
  sessionId: string,
  logUrl: string,
  storeId: string | undefined,
  extra: Record<string, string>,
  signal?: AbortSignal,
): Promise<T> {
  const url = `${BOOKMANAGER_CUSTOMER_API}${path.replace(/^\//, "")}?_cb=${encodeURIComponent(webstoreSan)}`;
  const body = new FormData();
  body.append("uuid", uuid);
  body.append("session_id", sessionId);
  body.append("log_url", logUrl);
  if (storeId) body.append("store_id", storeId);
  for (const [k, v] of Object.entries(extra)) {
    body.append(k, v);
  }

  const res = await fetch(url, {
    method: "POST",
    headers: { "User-Agent": UA, Accept: "application/json" },
    body,
    cache: "no-store",
    signal,
  });
  const text = await res.text();
  let json: unknown;
  try {
    json = JSON.parse(text) as T & { error?: string };
  } catch {
    throw new Error(`Scrawl Books: non-JSON response (${path}) HTTP ${res.status}`);
  }
  const err = (json as { error?: string }).error;
  if (!res.ok || err) {
    throw new Error(
      `Scrawl Books ${path} HTTP ${res.status}${err ? `: ${err}` : ""} ${text.slice(0, 160)}`,
    );
  }
  return json as T;
}

function monthRangeYYYYMMDD(year: number, monthIndex: number): {
  start_date: string;
  end_date: string;
} {
  const start = new Date(Date.UTC(year, monthIndex, 1));
  const end = new Date(Date.UTC(year, monthIndex + 1, 0));
  const fmt = (d: Date) =>
    `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, "0")}${String(d.getUTCDate()).padStart(2, "0")}`;
  return { start_date: fmt(start), end_date: fmt(end) };
}

/**
 * Fetches live event rows for Scrawl Books for a calendar month via Bookmanager.
 */
export async function fetchScrawlBooksEventRowsForMonth(
  year: number,
  monthIndex: number,
  signal?: AbortSignal,
): Promise<{ rows: ScrawlEventV2Row[]; store: ScrawlStoreInfo }> {
  const webstoreSan = getScrawlWebstoreSan();
  const uuid = crypto.randomUUID();
  const logUrl = "/events";

  const settings = await bookmanagerFormPost<ScrawlStoreSettingsResponse>(
    webstoreSan,
    "store/getSettings",
    uuid,
    "",
    "/",
    undefined,
    { webstore_name: webstoreSan },
    signal,
  );
  if (signal?.aborted) {
    const e = new Error("Aborted");
    e.name = "AbortError";
    throw e;
  }

  const storeId = String(settings.store_info?.id ?? "").trim();
  if (!/^\d+$/.test(storeId)) {
    throw new Error("Scrawl Books: store/getSettings did not return store_info.id");
  }

  const session = await bookmanagerFormPost<ScrawlSessionResponse>(
    webstoreSan,
    "session/get",
    uuid,
    "",
    logUrl,
    storeId,
    { reset_cart: "true" },
    signal,
  );
  if (signal?.aborted) {
    const e = new Error("Aborted");
    e.name = "AbortError";
    throw e;
  }

  const sessionId = session.session_id?.trim();
  if (!sessionId) {
    throw new Error("Scrawl Books: session/get did not return session_id");
  }

  const { start_date, end_date } = monthRangeYYYYMMDD(year, monthIndex);
  const limit = 50;
  const rows: ScrawlEventV2Row[] = [];
  for (let offset = 0, page = 0; page < 30; page++) {
    if (signal?.aborted) {
      const e = new Error("Aborted");
      e.name = "AbortError";
      throw e;
    }
    const list = await bookmanagerFormPost<ScrawlEventListResponse>(
      webstoreSan,
      "event/v2/list",
      uuid,
      sessionId,
      logUrl,
      storeId,
      {
        start_date,
        end_date,
        limit: String(limit),
        offset: String(offset),
      },
      signal,
    );
    const batch = Array.isArray(list.rows) ? list.rows : [];
    rows.push(...batch);
    if (batch.length < limit) break;
    offset += limit;
  }

  return { rows, store: settings.store_info };
}
