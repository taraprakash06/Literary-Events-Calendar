import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export type CalendarSubscription = {
  email: string;
  cityId: string;
  createdAt: string;
  /** YYYY-MM of the last monthly send, if any. */
  lastSentMonth?: string;
};

type StoreFile = { subscriptions: CalendarSubscription[] };

const CITIES_PROP = "litlist_cities";
const SENT_PROP = "litlist_sent";
const FILE = path.join(process.cwd(), "data", "subscribers.json");

const RESEND = "https://api.resend.com";

function resendKey(): string | null {
  const k = process.env.RESEND_API_KEY?.trim();
  return k || null;
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function splitList(raw: string | undefined): string[] {
  if (!raw?.trim()) return [];
  return [...new Set(raw.split(",").map((s) => s.trim()).filter(Boolean))];
}

function joinList(ids: string[]): string {
  return [...new Set(ids)].sort().join(",");
}

let writeChain: Promise<void> = Promise.resolve();

async function readFileStore(): Promise<CalendarSubscription[]> {
  try {
    const raw = await readFile(FILE, "utf8");
    const parsed = JSON.parse(raw) as StoreFile;
    return Array.isArray(parsed.subscriptions) ? parsed.subscriptions : [];
  } catch {
    return [];
  }
}

async function writeFileStore(rows: CalendarSubscription[]): Promise<void> {
  await mkdir(path.dirname(FILE), { recursive: true });
  const body: StoreFile = { subscriptions: rows };
  await writeFile(FILE, JSON.stringify(body, null, 2), "utf8");
}

function withFileLock<T>(fn: () => Promise<T>): Promise<T> {
  const run = writeChain.then(fn, fn);
  writeChain = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

async function resendFetch(
  pathname: string,
  init?: RequestInit,
): Promise<{ ok: boolean; status: number; json: unknown }> {
  const key = resendKey();
  if (!key) return { ok: false, status: 0, json: null };
  const res = await fetch(`${RESEND}${pathname}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  let json: unknown = null;
  try {
    json = await res.json();
  } catch {
    json = null;
  }
  return { ok: res.ok, status: res.status, json };
}

async function ensureContactProperties(): Promise<void> {
  if (!resendKey()) return;
  for (const key of [CITIES_PROP, SENT_PROP]) {
    await resendFetch("/contact-properties", {
      method: "POST",
      body: JSON.stringify({
        key,
        type: "string",
        fallback_value: "",
      }),
    });
  }
}

type ResendContact = {
  id?: string;
  email?: string;
  unsubscribed?: boolean;
  properties?: Record<string, string>;
};

function contactCities(c: ResendContact): string[] {
  return splitList(c.properties?.[CITIES_PROP]);
}

function contactSent(c: ResendContact): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of splitList(c.properties?.[SENT_PROP])) {
    const [cityId, month] = part.split(":");
    if (cityId && month) out[cityId] = month;
  }
  return out;
}

function sentProp(map: Record<string, string>): string {
  return Object.entries(map)
    .map(([cityId, month]) => `${cityId}:${month}`)
    .sort()
    .join(",");
}

async function getResendContact(email: string): Promise<ResendContact | null> {
  const { ok, json } = await resendFetch(
    `/contacts/${encodeURIComponent(email)}`,
  );
  if (!ok || !json || typeof json !== "object") return null;
  return json as ResendContact;
}

async function upsertResendCities(
  email: string,
  mutate: (cities: string[]) => string[],
): Promise<void> {
  if (!resendKey()) return;
  await ensureContactProperties();
  const existing = await getResendContact(email);
  const nextCities = mutate(existing ? contactCities(existing) : []);
  const properties = {
    ...(existing?.properties ?? {}),
    [CITIES_PROP]: joinList(nextCities),
  };
  if (existing?.id) {
    await resendFetch(`/contacts/${existing.id}`, {
      method: "PATCH",
      body: JSON.stringify({
        unsubscribed: nextCities.length === 0 ? true : false,
        properties,
      }),
    });
    return;
  }
  await resendFetch("/contacts", {
    method: "POST",
    body: JSON.stringify({
      email,
      unsubscribed: false,
      properties,
    }),
  });
}

async function listResendContacts(): Promise<ResendContact[]> {
  if (!resendKey()) return [];
  const out: ResendContact[] = [];
  let after: string | undefined;
  for (let i = 0; i < 50; i++) {
    const q = new URLSearchParams({ limit: "100" });
    if (after) q.set("after", after);
    const { ok, json } = await resendFetch(`/contacts?${q.toString()}`);
    if (!ok || !json || typeof json !== "object") break;
    const body = json as {
      data?: ResendContact[];
      has_more?: boolean;
    };
    const batch = body.data ?? [];
    out.push(...batch);
    if (!body.has_more || batch.length === 0) break;
    after = batch[batch.length - 1]?.id;
    if (!after) break;
  }
  return out;
}

export async function addSubscription(
  email: string,
  cityId: string,
): Promise<"created" | "exists"> {
  const normalized = normalizeEmail(email);
  return withFileLock(async () => {
    const rows = await readFileStore();
    const found = rows.find(
      (r) => r.email === normalized && r.cityId === cityId,
    );
    if (!found) {
      rows.push({
        email: normalized,
        cityId,
        createdAt: new Date().toISOString(),
      });
      try {
        await writeFileStore(rows);
      } catch (err) {
        console.warn("[subscribe] file store write failed", err);
      }
    }
    try {
      await upsertResendCities(normalized, (cities) =>
        cities.includes(cityId) ? cities : [...cities, cityId],
      );
    } catch (err) {
      console.warn("[subscribe] Resend sync failed", err);
    }
    return found ? "exists" : "created";
  });
}

export async function removeSubscription(
  email: string,
  cityId: string,
): Promise<boolean> {
  const normalized = normalizeEmail(email);
  return withFileLock(async () => {
    const rows = await readFileStore();
    const next = rows.filter(
      (r) => !(r.email === normalized && r.cityId === cityId),
    );
    const changed = next.length !== rows.length;
    if (changed) {
      try {
        await writeFileStore(next);
      } catch (err) {
        console.warn("[subscribe] file store write failed", err);
      }
    }
    try {
      await upsertResendCities(normalized, (cities) =>
        cities.filter((id) => id !== cityId),
      );
    } catch (err) {
      console.warn("[subscribe] Resend sync failed", err);
    }
    return changed;
  });
}

export async function listSubscriptions(): Promise<CalendarSubscription[]> {
  const fromFile = await readFileStore();
  const byKey = new Map<string, CalendarSubscription>();
  for (const row of fromFile) {
    byKey.set(`${row.email}|${row.cityId}`, row);
  }
  try {
    const contacts = await listResendContacts();
    for (const c of contacts) {
      const email = c.email?.trim().toLowerCase();
      if (!email || c.unsubscribed) continue;
      const sent = contactSent(c);
      for (const cityId of contactCities(c)) {
        const key = `${email}|${cityId}`;
        const prev = byKey.get(key);
        byKey.set(key, {
          email,
          cityId,
          createdAt: prev?.createdAt ?? new Date().toISOString(),
          lastSentMonth: sent[cityId] ?? prev?.lastSentMonth,
        });
      }
    }
  } catch (err) {
    console.warn("[subscribe] Resend list failed", err);
  }
  return [...byKey.values()];
}

export async function markSubscriptionSent(
  email: string,
  cityId: string,
  monthKey: string,
): Promise<void> {
  const normalized = normalizeEmail(email);
  await withFileLock(async () => {
    const rows = await readFileStore();
    let changed = false;
    for (const row of rows) {
      if (row.email === normalized && row.cityId === cityId) {
        row.lastSentMonth = monthKey;
        changed = true;
      }
    }
    if (changed) {
      try {
        await writeFileStore(rows);
      } catch {
        /* ephemeral fs */
      }
    }
  });
  if (!resendKey()) return;
  try {
    await ensureContactProperties();
    const existing = await getResendContact(normalized);
    if (!existing?.id) return;
    const sent = contactSent(existing);
    sent[cityId] = monthKey;
    await resendFetch(`/contacts/${existing.id}`, {
      method: "PATCH",
      body: JSON.stringify({
        properties: {
          ...(existing.properties ?? {}),
          [SENT_PROP]: sentProp(sent),
        },
      }),
    });
  } catch (err) {
    console.warn("[subscribe] mark sent failed", err);
  }
}

export function hasResend(): boolean {
  return Boolean(resendKey());
}
