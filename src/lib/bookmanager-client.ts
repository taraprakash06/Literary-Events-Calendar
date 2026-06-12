/**
 * TBM Bookmanager customer API — used by indie bookstore event calendars
 * (e.g. Scrawl Books, Stories Books & Cafe).
 */

const BOOKMANAGER_CUSTOMER_API = "https://api.bookmanager.com/customer/";

export type BookmanagerStoreInfo = {
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

export type BookmanagerStoreSettingsResponse = {
  store_info: BookmanagerStoreInfo;
  error?: string;
};

export type BookmanagerSessionResponse = {
  session_id: string;
  error?: string;
};

export type BookmanagerEventV2Row = {
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

export type BookmanagerEventListResponse = {
  rows?: BookmanagerEventV2Row[];
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
    throw new Error(`Bookmanager: non-JSON response (${path}) HTTP ${res.status}`);
  }
  const err = (json as { error?: string }).error;
  if (!res.ok || err) {
    throw new Error(
      `Bookmanager ${path} HTTP ${res.status}${err ? `: ${err}` : ""} ${text.slice(0, 160)}`,
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

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    const e = new Error("Aborted");
    e.name = "AbortError";
    throw e;
  }
}

export async function fetchBookmanagerEventRowsForMonth(
  webstoreSan: string,
  year: number,
  monthIndex: number,
  signal?: AbortSignal,
): Promise<{ rows: BookmanagerEventV2Row[]; store: BookmanagerStoreInfo }> {
  const uuid = crypto.randomUUID();
  const logUrl = "/events";

  const settings = await bookmanagerFormPost<BookmanagerStoreSettingsResponse>(
    webstoreSan,
    "store/getSettings",
    uuid,
    "",
    "/",
    undefined,
    { webstore_name: webstoreSan },
    signal,
  );
  throwIfAborted(signal);

  const storeId = String(settings.store_info?.id ?? "").trim();
  if (!/^\d+$/.test(storeId)) {
    throw new Error("Bookmanager: store/getSettings did not return store_info.id");
  }

  const session = await bookmanagerFormPost<BookmanagerSessionResponse>(
    webstoreSan,
    "session/get",
    uuid,
    "",
    logUrl,
    storeId,
    { reset_cart: "true" },
    signal,
  );
  throwIfAborted(signal);

  const sessionId = session.session_id?.trim();
  if (!sessionId) {
    throw new Error("Bookmanager: session/get did not return session_id");
  }

  const { start_date, end_date } = monthRangeYYYYMMDD(year, monthIndex);
  const limit = 50;
  const rows: BookmanagerEventV2Row[] = [];
  for (let offset = 0, page = 0; page < 30; page++) {
    throwIfAborted(signal);
    const list = await bookmanagerFormPost<BookmanagerEventListResponse>(
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
