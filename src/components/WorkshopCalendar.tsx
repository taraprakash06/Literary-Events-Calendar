"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type MutableRefObject } from "react";
import { DateTime } from "luxon";
import { CITIES } from "@/data/cities";
import { eventsForCity } from "@/data/workshop-events";
import { CATEGORY_TAG_STYLES } from "@/lib/category-styles";
import { decodeHtmlEntities, stripHtmlAndDecode } from "@/lib/text";
import {
  applyEventFilters,
  distinctCategories,
  monthRangeISO,
} from "@/lib/event-query";
import {
  cityTimeNote,
  formatEventDateTimeDetail,
  formatEventWhen,
  formatEventWhenCompact,
} from "@/lib/event-time-display";
import {
  CATEGORY_LABELS,
  FORMAT_LABELS,
  PRICE_LABELS,
  type City,
  ALL_EVENT_FORMATS,
  ALL_PRICE_KINDS,
  ALL_WORKSHOP_CATEGORIES,
  type EventFilters,
  type EventFormat,
  type PriceKind,
  type WorkshopEvent,
  type WorkshopEventCategory,
} from "@/lib/workshop-types";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

function buildMonthGrid(year: number, monthIndex: number): (number | null)[] {
  const first = new Date(year, monthIndex, 1);
  const last = new Date(year, monthIndex + 1, 0);
  const padStart = first.getDay();
  const daysInMonth = last.getDate();
  const cells: (number | null)[] = [];
  for (let i = 0; i < padStart; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  while (cells.length < 42) cells.push(null);
  return cells;
}

function shiftMonth(year: number, monthIndex: number, delta: number) {
  const d = new Date(year, monthIndex + delta, 1);
  return { year: d.getFullYear(), monthIndex: d.getMonth() };
}

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function eventZonedDateTime(ev: Pick<WorkshopEvent, "start" | "timeZone">): DateTime {
  const dt = DateTime.fromISO(ev.start, { setZone: true });
  if (ev.timeZone) return dt.setZone(ev.timeZone);
  return dt.toLocal();
}

function localDateKey(ev: Pick<WorkshopEvent, "start" | "timeZone">): string {
  const d = eventZonedDateTime(ev);
  if (!d.isValid) {
    const fallback = new Date(ev.start);
    return `${fallback.getFullYear()}-${pad2(fallback.getMonth() + 1)}-${pad2(fallback.getDate())}`;
  }
  return `${d.year}-${pad2(d.month)}-${pad2(d.day)}`;
}

function sameMonthAs(ev: Pick<WorkshopEvent, "start" | "timeZone">, year: number, monthIndex: number) {
  const d = eventZonedDateTime(ev);
  if (!d.isValid) {
    const fallback = new Date(ev.start);
    return fallback.getFullYear() === year && fallback.getMonth() === monthIndex;
  }
  return d.year === year && d.month === monthIndex + 1;
}

type EventWhen = "past" | "today" | "future";

function eventWhenStatus(
  ev: Pick<WorkshopEvent, "start" | "timeZone">,
  now: DateTime = DateTime.now(),
): EventWhen {
  const evDay = eventZonedDateTime(ev).startOf("day");
  if (!evDay.isValid) return "future";
  const zone = ev.timeZone ?? now.zoneName ?? "local";
  const today = now.setZone(zone).startOf("day");
  if (evDay < today) return "past";
  if (evDay.equals(today)) return "today";
  return "future";
}

function dateKeyWhenStatus(dateKey: string, now: DateTime = DateTime.now()): EventWhen {
  const dt = DateTime.fromISO(dateKey, { zone: now.zoneName ?? "local" }).startOf("day");
  if (!dt.isValid) return "future";
  const today = now.startOf("day");
  if (dt < today) return "past";
  if (dt.equals(today)) return "today";
  return "future";
}

function eventWhenItemClasses(when: EventWhen): string {
  if (when === "past") return "opacity-[0.62] saturate-[0.88] hover:opacity-[0.78]";
  return "";
}

function eventWhenChipClasses(when: EventWhen): string {
  const base = eventWhenItemClasses(when);
  if (when === "today") {
    return [base, "ring-1 ring-rose-900/25 dark:ring-rose-400/35"].filter(Boolean).join(" ");
  }
  return base;
}

function eventQualityScore(ev: WorkshopEvent): number {
  let score = 0;
  if (ev.listingProvenance === "live") score += 20;
  if (ev.rsvpUrl) score += 6;
  if (ev.description && ev.description.trim().length > 80) score += 3;
  if (ev.venue) score += 2;

  const catBoost: Record<WorkshopEventCategory, number> = {
    workshop: 12,
    reading: 10,
    "open-mic": 8,
    other: 4,
  };
  score += catBoost[ev.category] ?? 0;

  const organizer = (ev.organizer ?? "").toLowerCase();
  if (organizer.includes("public library")) score += 2;
  if (organizer.includes("politics and prose")) score += 3;

  return score;
}

function isPostponedEvent(ev: WorkshopEvent): boolean {
  const blob = `${ev.title}\n${ev.tagline ?? ""}\n${ev.description ?? ""}`.toLowerCase();
  return /\bpostponed\b/.test(blob);
}

function pickWeeklyHighlights(events: WorkshopEvent[], min = 5, max = 7): WorkshopEvent[] {
  const eligible = events.filter((ev) => !isPostponedEvent(ev));
  const sorted = [...eligible].sort((a, b) => {
    const s = eventQualityScore(b) - eventQualityScore(a);
    if (s !== 0) return s;
    return eventZonedDateTime(a).toMillis() - eventZonedDateTime(b).toMillis();
  });

  const byDay = new Map<string, WorkshopEvent[]>();
  for (const ev of sorted) {
    const key = localDateKey(ev);
    const list = byDay.get(key) ?? [];
    list.push(ev);
    byDay.set(key, list);
  }

  // Pull one strong pick per day first to spread across days.
  const out: WorkshopEvent[] = [];
  const dayKeys = [...byDay.keys()].sort();
  for (const k of dayKeys) {
    const first = byDay.get(k)?.[0];
    if (!first) continue;
    out.push(first);
    if (out.length >= max) return out;
  }

  // Then fill remaining slots with best remaining.
  if (out.length < min) {
    const used = new Set(out.map((e) => e.id));
    for (const ev of sorted) {
      if (used.has(ev.id)) continue;
      out.push(ev);
      used.add(ev.id);
      if (out.length >= Math.min(max, Math.max(min, out.length))) break;
    }
  }

  return out.slice(0, max);
}

type ViewMode = "calendar" | "list";

function beginSourceLoad(
  epochRef: MutableRefObject<number>,
  pendingRef: MutableRefObject<number>,
  setLoading: (loading: boolean) => void,
): () => void {
  const epoch = epochRef.current;
  pendingRef.current += 1;
  setLoading(true);
  return () => {
    if (epoch !== epochRef.current) return;
    pendingRef.current = Math.max(0, pendingRef.current - 1);
    if (pendingRef.current === 0) setLoading(false);
  };
}

function useIsMobile(breakpoint = 768) {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${breakpoint - 1}px)`);
    const apply = () => setIsMobile(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, [breakpoint]);
  return isMobile;
}

function toggleFilterInSet<T extends string>(set: Set<T>, value: T): Set<T> {
  const next = new Set(set);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  return next;
}

function allFilterSelections(): Pick<
  EventFilters,
  "formats" | "prices" | "categoryIncluded"
> {
  return {
    formats: new Set(ALL_EVENT_FORMATS),
    prices: new Set(ALL_PRICE_KINDS),
    categoryIncluded: new Set(ALL_WORKSHOP_CATEGORIES),
  };
}

function noFilterSelections(): Pick<
  EventFilters,
  "formats" | "prices" | "categoryIncluded"
> {
  return {
    formats: new Set(),
    prices: new Set(),
    categoryIncluded: new Set(),
  };
}

function EventStatusLabel({
  when,
  className,
}: {
  when: EventWhen;
  className?: string;
}) {
  if (when === "future") {
    return (
      <span
        className={
          className ??
          "shrink-0 text-xs font-semibold text-rose-900/90 dark:text-rose-300/90"
        }
      >
        Open
      </span>
    );
  }
  if (when === "today") {
    return (
      <span
        className={
          className ??
          "shrink-0 rounded-full bg-rose-900/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-rose-900 dark:bg-rose-400/15 dark:text-rose-200"
        }
      >
        Today
      </span>
    );
  }
  return (
    <span
      className={
        className ??
        "shrink-0 rounded-full bg-stone-200/90 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-stone-600 dark:bg-stone-700/90 dark:text-stone-300"
      }
    >
      Past
    </span>
  );
}

function FormatGlyph({ format }: { format: EventFormat }) {
  const common = "h-3 w-3 shrink-0 text-stone-500 dark:text-stone-400";
  if (format === "virtual") {
    return (
      <svg className={common} viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          d="M4 8a2 2 0 012-2h12a2 2 0 012 2v8a2 2 0 01-2 2H6a2 2 0 01-2-2V8z"
          stroke="currentColor"
          strokeWidth="1.5"
        />
        <path
          d="M8 14h8M10 11h4"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </svg>
    );
  }
  if (format === "hybrid") {
    return (
      <span
        className="inline-flex h-3 items-center gap-0.5 text-stone-500"
        aria-hidden
        title="Hybrid"
      >
        <svg className="h-2.5 w-2.5" viewBox="0 0 24 24" fill="none">
          <path
            d="M12 21s7-4.5 7-11a7 7 0 10-14 0c0 6.5 7 11 7 11z"
            stroke="currentColor"
            strokeWidth="1.5"
          />
          <circle cx="12" cy="10" r="1.5" fill="currentColor" />
        </svg>
        <svg className="h-2.5 w-2.5" viewBox="0 0 24 24" fill="none">
          <path
            d="M4 8a2 2 0 012-2h12a2 2 0 012 2v8a2 2 0 01-2 2H6a2 2 0 01-2-2V8z"
            stroke="currentColor"
            strokeWidth="1.5"
          />
        </svg>
      </span>
    );
  }
  return (
    <svg className={common} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 21s7-4.5 7-11a7 7 0 10-14 0c0 6.5 7 11 7 11z"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <circle cx="12" cy="10" r="1.5" fill="currentColor" />
    </svg>
  );
}

export function WorkshopCalendar({ city }: { city: City }) {
  const router = useRouter();
  const isMobile = useIsMobile();
  const today = useMemo(() => new Date(), []);
  const [year, setYear] = useState(today.getFullYear());
  const [monthIndex, setMonthIndex] = useState(today.getMonth());
  const [view, setView] = useState<ViewMode>("calendar");
  const [search, setSearch] = useState("");
  const [detail, setDetail] = useState<WorkshopEvent | null>(null);
  const [dayPanelKey, setDayPanelKey] = useState<string | null>(null);

  const [filters, setFilters] = useState<EventFilters>(() => {
    const r = monthRangeISO(today.getFullYear(), today.getMonth());
    return {
      formats: new Set(ALL_EVENT_FORMATS),
      prices: new Set(ALL_PRICE_KINDS),
      categoryIncluded: new Set(ALL_WORKSHOP_CATEGORIES),
      rangeStart: r.start,
      rangeEnd: r.end,
    };
  });

  const loadEpochRef = useRef(0);
  const pendingLoadsRef = useRef(0);
  const [sourcesLoading, setSourcesLoading] = useState(true);

  useEffect(() => {
    loadEpochRef.current += 1;
    pendingLoadsRef.current = 0;
    setSourcesLoading(true);
  }, [city.id, year, monthIndex]);

  useEffect(() => {
    // Keep the date-range filter aligned with the currently viewed month.
    // If a user explicitly sets a custom range within the month, we leave it alone.
    const r = monthRangeISO(year, monthIndex);
    const monthPrefix = `${year}-${pad2(monthIndex + 1)}-`;
    const rangeLooksLikeThisMonth =
      filters.rangeStart.startsWith(monthPrefix) && filters.rangeEnd.startsWith(monthPrefix);
    if (!rangeLooksLikeThisMonth) {
      setFilters((prev) => ({
        ...prev,
        rangeStart: r.start,
        rangeEnd: r.end,
      }));
    }
  }, [filters.rangeEnd, filters.rangeStart, monthIndex, year]);

  const [libnetEvents, setLibnetEvents] = useState<WorkshopEvent[]>([]);
  const [writersCenterEvents, setWritersCenterEvents] = useState<
    WorkshopEvent[]
  >([]);
  const [politicsProseEvents, setPoliticsProseEvents] = useState<
    WorkshopEvent[]
  >([]);
  const [scrawlBooksEvents, setScrawlBooksEvents] = useState<WorkshopEvent[]>([]);
  const [busboysPoetsEvents, setBusboysPoetsEvents] = useState<WorkshopEvent[]>([]);
  const [mdHumanitiesEvents, setMdHumanitiesEvents] = useState<WorkshopEvent[]>([]);
  const [planetWordEvents, setPlanetWordEvents] = useState<WorkshopEvent[]>([]);
  const [writeToRightEvents, setWriteToRightEvents] = useState<WorkshopEvent[]>([]);
  const [dcArtAllNightEvents, setDcArtAllNightEvents] = useState<WorkshopEvent[]>(
    [],
  );
  const [eventbriteEvents, setEventbriteEvents] = useState<WorkshopEvent[]>([]);
  const [eventbriteMeta, setEventbriteMeta] = useState<
    | {
        configured?: boolean;
        message?: string;
        cityId?: string;
        year?: number;
        month?: number;
        sourceCount?: number;
        matchedCount?: number;
      }
    | null
  >(null);
  const [laplEvents, setLaplEvents] = useState<WorkshopEvent[]>([]);
  const [lyricHyperionEvents, setLyricHyperionEvents] = useState<WorkshopEvent[]>(
    [],
  );
  const [laAnnualEvents, setLaAnnualEvents] = useState<WorkshopEvent[]>([]);
  const [lastBookstoreEvents, setLastBookstoreEvents] = useState<WorkshopEvent[]>(
    [],
  );
  const [skylightBooksEvents, setSkylightBooksEvents] = useState<WorkshopEvent[]>(
    [],
  );
  const [writegirlEvents, setWritegirlEvents] = useState<WorkshopEvent[]>([]);
  const [daPoetryLoungeEvents, setDaPoetryLoungeEvents] = useState<
    WorkshopEvent[]
  >([]);
  const [worldStageEvents, setWorldStageEvents] = useState<WorkshopEvent[]>([]);
  const [storiesLaEvents, setStoriesLaEvents] = useState<WorkshopEvent[]>([]);
  const [laPoetSocietyEvents, setLaPoetSocietyEvents] = useState<
    WorkshopEvent[]
  >([]);
  const [laCuratedEvents, setLaCuratedEvents] = useState<WorkshopEvent[]>([]);
  const [sfplEvents, setSfplEvents] = useState<WorkshopEvent[]>([]);
  const [writersGrottoEvents, setWritersGrottoEvents] = useState<WorkshopEvent[]>(
    [],
  );
  const [writingSalonEvents, setWritingSalonEvents] = useState<WorkshopEvent[]>(
    [],
  );
  const [shutUpAndWriteEvents, setShutUpAndWriteEvents] = useState<WorkshopEvent[]>(
    [],
  );
  const [doTheBayOpenMicEvents, setDoTheBayOpenMicEvents] = useState<
    WorkshopEvent[]
  >([]);
  const [bazaarCafeOpenMicEvents, setBazaarCafeOpenMicEvents] = useState<
    WorkshopEvent[]
  >([]);
  const [decenteredOpenMicEvents, setDecenteredOpenMicEvents] = useState<
    WorkshopEvent[]
  >([]);
  const [galeriaEvents, setGaleriaEvents] = useState<WorkshopEvent[]>([]);
  const [curatedSfEbEvents, setCuratedSfEbEvents] = useState<WorkshopEvent[]>([]);
  const [sfCuratedEvents, setSfCuratedEvents] = useState<WorkshopEvent[]>([]);
  const [sfWritersWorkshopEvents, setSfWritersWorkshopEvents] = useState<
    WorkshopEvent[]
  >([]);
  const [catEvents, setCatEvents] = useState<WorkshopEvent[]>([]);
  const [nyplEvents, setNyplEvents] = useState<WorkshopEvent[]>([]);
  const [centerForFictionEvents, setCenterForFictionEvents] = useState<
    WorkshopEvent[]
  >([]);
  const [justBuffaloEvents, setJustBuffaloEvents] = useState<WorkshopEvent[]>([]);
  const [poetsHouseEvents, setPoetsHouseEvents] = useState<WorkshopEvent[]>([]);
  const [strandEvents, setStrandEvents] = useState<WorkshopEvent[]>([]);
  const [ny92Events, setNy92Events] = useState<WorkshopEvent[]>([]);
  const [nuyoricanEvents, setNuyoricanEvents] = useState<WorkshopEvent[]>([]);
  const [tennesseeEvents, setTennesseeEvents] = useState<WorkshopEvent[]>([]);

  useEffect(() => {
    if (city.id !== "dmv") {
      setLibnetEvents([]);
      setWritersCenterEvents([]);
      setPoliticsProseEvents([]);
      setScrawlBooksEvents([]);
      setBusboysPoetsEvents([]);
      setMdHumanitiesEvents([]);
      setPlanetWordEvents([]);
      setWriteToRightEvents([]);
      setDcArtAllNightEvents([]);
      return;
    }
    const y = year;
    const m = monthIndex + 1;
    const ac = new AbortController();
    const finishLoad = beginSourceLoad(loadEpochRef, pendingLoadsRef, setSourcesLoading);
    const q = `year=${y}&month=${m}&cityId=dmv`;
    (async () => {
      try {
        const [
          dcRes,
          mcRes,
          twcRes,
          pnpRes,
          scrawlRes,
          busboysRes,
          mdHumRes,
          pwRes,
          writeToRightRes,
          dcArtAllNightRes,
        ] =
          await Promise.all([
          fetch(`/api/dcpl/events?${q}`, { signal: ac.signal }),
          fetch(`/api/mcpl/events?${q}`, { signal: ac.signal }),
          fetch(`/api/writers-center/events?year=${y}&month=${m}`, {
            signal: ac.signal,
          }),
          fetch(`/api/politics-prose/events?year=${y}&month=${m}`, {
            signal: ac.signal,
          }),
          fetch(`/api/scrawl-books/events?year=${y}&month=${m}`, {
            signal: ac.signal,
          }),
          fetch(`/api/busboys-poets/events?year=${y}&month=${m}`, {
            signal: ac.signal,
          }),
          fetch(`/api/mdhumanities/events?year=${y}&month=${m}`, {
            signal: ac.signal,
          }),
          fetch(`/api/planet-word/events?year=${y}&month=${m}`, {
            signal: ac.signal,
          }),
          fetch(`/api/write-to-right/events?year=${y}&month=${m}`, {
            signal: ac.signal,
          }),
          fetch(`/api/dc-art-all-night/events?year=${y}&month=${m}`, {
            signal: ac.signal,
          }),
        ]);
        const dcJson = dcRes.ok
          ? ((await dcRes.json()) as { events?: WorkshopEvent[] })
          : {};
        const mcJson = mcRes.ok
          ? ((await mcRes.json()) as { events?: WorkshopEvent[] })
          : {};
        const twcJson = twcRes.ok
          ? ((await twcRes.json()) as { events?: WorkshopEvent[] })
          : {};
        const pnpJson = pnpRes.ok
          ? ((await pnpRes.json()) as { events?: WorkshopEvent[] })
          : {};
        const scrawlJson = scrawlRes.ok
          ? ((await scrawlRes.json()) as { events?: WorkshopEvent[] })
          : {};
        const busboysJson = busboysRes.ok
          ? ((await busboysRes.json()) as { events?: WorkshopEvent[] })
          : {};
        const mdHumJson = mdHumRes.ok
          ? ((await mdHumRes.json()) as { events?: WorkshopEvent[] })
          : {};
        const pwJson = pwRes.ok
          ? ((await pwRes.json()) as { events?: WorkshopEvent[] })
          : {};
        const writeToRightJson = writeToRightRes.ok
          ? ((await writeToRightRes.json()) as { events?: WorkshopEvent[] })
          : {};
        const dcArtAllNightJson = dcArtAllNightRes.ok
          ? ((await dcArtAllNightRes.json()) as { events?: WorkshopEvent[] })
          : {};
        const dcEv = Array.isArray(dcJson.events) ? dcJson.events : [];
        const mcEv = Array.isArray(mcJson.events) ? mcJson.events : [];
        const twcEv = Array.isArray(twcJson.events) ? twcJson.events : [];
        const pnpEv = Array.isArray(pnpJson.events) ? pnpJson.events : [];
        const scrawlEv = Array.isArray(scrawlJson.events) ? scrawlJson.events : [];
        const busboysEv = Array.isArray(busboysJson.events) ? busboysJson.events : [];
        const mdHumEv = Array.isArray(mdHumJson.events) ? mdHumJson.events : [];
        const pwEv = Array.isArray(pwJson.events) ? pwJson.events : [];
        const writeToRightEv = Array.isArray(writeToRightJson.events)
          ? writeToRightJson.events
          : [];
        const dcArtAllNightEv = Array.isArray(dcArtAllNightJson.events)
          ? dcArtAllNightJson.events
          : [];
        setLibnetEvents([...dcEv, ...mcEv]);
        setWritersCenterEvents(twcEv);
        setPoliticsProseEvents(pnpEv);
        setScrawlBooksEvents(scrawlEv);
        setBusboysPoetsEvents(busboysEv);
        setMdHumanitiesEvents(mdHumEv);
        setPlanetWordEvents(pwEv);
        setWriteToRightEvents(writeToRightEv);
        setDcArtAllNightEvents(dcArtAllNightEv);
      } catch (e) {
        if ((e as Error).name === "AbortError") return;
        setLibnetEvents([]);
        setWritersCenterEvents([]);
        setPoliticsProseEvents([]);
        setScrawlBooksEvents([]);
        setBusboysPoetsEvents([]);
        setMdHumanitiesEvents([]);
        setPlanetWordEvents([]);
        setWriteToRightEvents([]);
        setDcArtAllNightEvents([]);
      } finally {
        finishLoad();
      }
    })();
    return () => ac.abort();
  }, [city.id, year, monthIndex]);

  useEffect(() => {
    if (city.id !== "la") {
      setLaplEvents([]);
      setLyricHyperionEvents([]);
      setLaAnnualEvents([]);
      setLastBookstoreEvents([]);
      setSkylightBooksEvents([]);
      setWritegirlEvents([]);
      setDaPoetryLoungeEvents([]);
      setWorldStageEvents([]);
      setStoriesLaEvents([]);
      setLaPoetSocietyEvents([]);
      setLaCuratedEvents([]);
      return;
    }
    const y = year;
    const m = monthIndex + 1;
    const ac = new AbortController();
    const finishLoad = beginSourceLoad(loadEpochRef, pendingLoadsRef, setSourcesLoading);
    (async () => {
      try {
        const [
          laplRes,
          lyricRes,
          annualRes,
          lastBookstoreRes,
          skylightRes,
          writegirlRes,
          daPoetryLoungeRes,
          worldStageRes,
          storiesLaRes,
          laPoetSocietyRes,
          laCuratedRes,
        ] = await Promise.all([
          fetch(`/api/lapl/events?year=${y}&month=${m}`, { signal: ac.signal }),
          fetch(`/api/lyric-hyperion/events?year=${y}&month=${m}`, {
            signal: ac.signal,
          }),
          fetch(`/api/la-literature/annual-events?year=${y}&month=${m}`, {
            signal: ac.signal,
          }),
          fetch(`/api/last-bookstore/events?year=${y}&month=${m}`, {
            signal: ac.signal,
          }),
          fetch(`/api/skylight-books/events?year=${y}&month=${m}`, {
            signal: ac.signal,
          }),
          fetch(`/api/writegirl/events?year=${y}&month=${m}`, {
            signal: ac.signal,
          }),
          fetch(`/api/da-poetry-lounge-open-mic/events?year=${y}&month=${m}`, {
            signal: ac.signal,
          }),
          fetch(`/api/world-stage/events?year=${y}&month=${m}`, {
            signal: ac.signal,
          }),
          fetch(`/api/stories-la/events?year=${y}&month=${m}`, {
            signal: ac.signal,
          }),
          fetch(`/api/la-poet-society/events?year=${y}&month=${m}`, {
            signal: ac.signal,
          }),
          fetch(`/api/la-curated/events?year=${y}&month=${m}`, {
            signal: ac.signal,
          }),
        ]);

        const laplBody = laplRes.ok
          ? ((await laplRes.json()) as { events?: WorkshopEvent[] })
          : {};
        const lyricBody = lyricRes.ok
          ? ((await lyricRes.json()) as { events?: WorkshopEvent[] })
          : {};
        const annualBody = annualRes.ok
          ? ((await annualRes.json()) as { events?: WorkshopEvent[] })
          : {};
        const lastBookstoreBody = lastBookstoreRes.ok
          ? ((await lastBookstoreRes.json()) as { events?: WorkshopEvent[] })
          : {};
        const skylightBody = skylightRes.ok
          ? ((await skylightRes.json()) as { events?: WorkshopEvent[] })
          : {};
        const writegirlBody = writegirlRes.ok
          ? ((await writegirlRes.json()) as { events?: WorkshopEvent[] })
          : {};
        const daPoetryLoungeBody = daPoetryLoungeRes.ok
          ? ((await daPoetryLoungeRes.json()) as { events?: WorkshopEvent[] })
          : {};
        const worldStageBody = worldStageRes.ok
          ? ((await worldStageRes.json()) as { events?: WorkshopEvent[] })
          : {};
        const storiesLaBody = storiesLaRes.ok
          ? ((await storiesLaRes.json()) as { events?: WorkshopEvent[] })
          : {};
        const laPoetSocietyBody = laPoetSocietyRes.ok
          ? ((await laPoetSocietyRes.json()) as { events?: WorkshopEvent[] })
          : {};
        const laCuratedBody = laCuratedRes.ok
          ? ((await laCuratedRes.json()) as { events?: WorkshopEvent[] })
          : {};

        setLaplEvents(Array.isArray(laplBody.events) ? laplBody.events : []);
        setLyricHyperionEvents(
          Array.isArray(lyricBody.events) ? lyricBody.events : [],
        );
        setLaAnnualEvents(
          Array.isArray(annualBody.events) ? annualBody.events : [],
        );
        setLastBookstoreEvents(
          Array.isArray(lastBookstoreBody.events)
            ? lastBookstoreBody.events
            : [],
        );
        setSkylightBooksEvents(
          Array.isArray(skylightBody.events) ? skylightBody.events : [],
        );
        setWritegirlEvents(
          Array.isArray(writegirlBody.events) ? writegirlBody.events : [],
        );
        setDaPoetryLoungeEvents(
          Array.isArray(daPoetryLoungeBody.events)
            ? daPoetryLoungeBody.events
            : [],
        );
        setWorldStageEvents(
          Array.isArray(worldStageBody.events) ? worldStageBody.events : [],
        );
        setStoriesLaEvents(
          Array.isArray(storiesLaBody.events) ? storiesLaBody.events : [],
        );
        setLaPoetSocietyEvents(
          Array.isArray(laPoetSocietyBody.events)
            ? laPoetSocietyBody.events
            : [],
        );
        setLaCuratedEvents(
          Array.isArray(laCuratedBody.events) ? laCuratedBody.events : [],
        );
      } catch (e) {
        if ((e as Error).name === "AbortError") return;
        setLaplEvents([]);
        setLyricHyperionEvents([]);
        setLaAnnualEvents([]);
        setLastBookstoreEvents([]);
        setSkylightBooksEvents([]);
        setWritegirlEvents([]);
        setDaPoetryLoungeEvents([]);
        setWorldStageEvents([]);
        setStoriesLaEvents([]);
        setLaPoetSocietyEvents([]);
        setLaCuratedEvents([]);
      } finally {
        finishLoad();
      }
    })();
    return () => ac.abort();
  }, [city.id, year, monthIndex]);

  useEffect(() => {
    if (city.id !== "sf") {
      setSfplEvents([]);
      setWritingSalonEvents([]);
      setShutUpAndWriteEvents([]);
      setSfWritersWorkshopEvents([]);
      setDoTheBayOpenMicEvents([]);
      setBazaarCafeOpenMicEvents([]);
      setDecenteredOpenMicEvents([]);
      setGaleriaEvents([]);
      setCuratedSfEbEvents([]);
      setSfCuratedEvents([]);
      return;
    }
    const y = year;
    const m = monthIndex + 1;
    const ac = new AbortController();
    const finishLoad = beginSourceLoad(loadEpochRef, pendingLoadsRef, setSourcesLoading);
    (async () => {
      try {
        const [
          sfplRes,
          writingSalonRes,
          shutUpAndWriteRes,
          sfwwRes,
          doTheBayRes,
          bazaarCafeRes,
          decenteredRes,
          galeriaRes,
          curatedEbRes,
          sfCuratedRes,
        ] = await Promise.all([
          fetch(`/api/sfpl/events?year=${y}&month=${m}`, { signal: ac.signal }),
          fetch(`/api/writing-salon/events?year=${y}&month=${m}`, {
            signal: ac.signal,
          }),
          fetch(`/api/shut-up-and-write/events?year=${y}&month=${m}`, {
            signal: ac.signal,
          }),
          fetch(`/api/sf-writers-workshop/events?year=${y}&month=${m}`, {
            signal: ac.signal,
          }),
          fetch(`/api/dothebay-poetry-open-mic/events?year=${y}&month=${m}`, {
            signal: ac.signal,
          }),
          fetch(`/api/bazaar-cafe-open-mic/events?year=${y}&month=${m}`, {
            signal: ac.signal,
          }),
          fetch(`/api/decentered-open-mic/events?year=${y}&month=${m}`, {
            signal: ac.signal,
          }),
          fetch(`/api/galeria-de-la-raza/events?year=${y}&month=${m}`, {
            signal: ac.signal,
          }),
          fetch(`/api/curated-sf-eventbrite/events?year=${y}&month=${m}`, {
            signal: ac.signal,
          }),
          fetch(`/api/sf-curated/events?year=${y}&month=${m}`, {
            signal: ac.signal,
          }),
        ]);
        const sfplBody = sfplRes.ok
          ? ((await sfplRes.json()) as { events?: WorkshopEvent[] })
          : {};
        const writingSalonBody = writingSalonRes.ok
          ? ((await writingSalonRes.json()) as { events?: WorkshopEvent[] })
          : {};
        const shutUpAndWriteBody = shutUpAndWriteRes.ok
          ? ((await shutUpAndWriteRes.json()) as { events?: WorkshopEvent[] })
          : {};
        const sfwwBody = sfwwRes.ok
          ? ((await sfwwRes.json()) as { events?: WorkshopEvent[] })
          : {};
        const doTheBayBody = doTheBayRes.ok
          ? ((await doTheBayRes.json()) as { events?: WorkshopEvent[] })
          : {};
        const bazaarCafeBody = bazaarCafeRes.ok
          ? ((await bazaarCafeRes.json()) as { events?: WorkshopEvent[] })
          : {};
        const decenteredBody = decenteredRes.ok
          ? ((await decenteredRes.json()) as { events?: WorkshopEvent[] })
          : {};
        const galeriaBody = galeriaRes.ok
          ? ((await galeriaRes.json()) as { events?: WorkshopEvent[] })
          : {};
        const curatedEbBody = curatedEbRes.ok
          ? ((await curatedEbRes.json()) as { events?: WorkshopEvent[] })
          : {};
        const sfCuratedBody = sfCuratedRes.ok
          ? ((await sfCuratedRes.json()) as { events?: WorkshopEvent[] })
          : {};
        setSfplEvents(Array.isArray(sfplBody.events) ? sfplBody.events : []);
        setWritingSalonEvents(
          Array.isArray(writingSalonBody.events) ? writingSalonBody.events : [],
        );
        setShutUpAndWriteEvents(
          Array.isArray(shutUpAndWriteBody.events)
            ? shutUpAndWriteBody.events
            : [],
        );
        setSfWritersWorkshopEvents(
          Array.isArray(sfwwBody.events) ? sfwwBody.events : [],
        );
        setDoTheBayOpenMicEvents(
          Array.isArray(doTheBayBody.events) ? doTheBayBody.events : [],
        );
        setBazaarCafeOpenMicEvents(
          Array.isArray(bazaarCafeBody.events) ? bazaarCafeBody.events : [],
        );
        setDecenteredOpenMicEvents(
          Array.isArray(decenteredBody.events) ? decenteredBody.events : [],
        );
        setGaleriaEvents(
          Array.isArray(galeriaBody.events) ? galeriaBody.events : [],
        );
        setCuratedSfEbEvents(
          Array.isArray(curatedEbBody.events) ? curatedEbBody.events : [],
        );
        setSfCuratedEvents(
          Array.isArray(sfCuratedBody.events) ? sfCuratedBody.events : [],
        );
      } catch (e) {
        if ((e as Error).name === "AbortError") return;
        setSfplEvents([]);
        setWritingSalonEvents([]);
        setShutUpAndWriteEvents([]);
        setSfWritersWorkshopEvents([]);
        setDoTheBayOpenMicEvents([]);
        setBazaarCafeOpenMicEvents([]);
        setDecenteredOpenMicEvents([]);
        setGaleriaEvents([]);
        setCuratedSfEbEvents([]);
        setSfCuratedEvents([]);
      } finally {
        finishLoad();
      }
    })();
    return () => ac.abort();
  }, [city.id, year, monthIndex]);

  useEffect(() => {
    if (city.id !== "sf") {
      setWritersGrottoEvents([]);
      return;
    }
    const y = year;
    const m = monthIndex + 1;
    const ac = new AbortController();
    const finishLoad = beginSourceLoad(loadEpochRef, pendingLoadsRef, setSourcesLoading);
    (async () => {
      try {
        const res = await fetch(`/api/writers-grotto/events?year=${y}&month=${m}`, {
          signal: ac.signal,
        });
        if (!res.ok) {
          setWritersGrottoEvents([]);
          return;
        }
        const body = (await res.json()) as { events?: WorkshopEvent[] };
        setWritersGrottoEvents(Array.isArray(body.events) ? body.events : []);
      } catch (e) {
        if ((e as Error).name === "AbortError") return;
        setWritersGrottoEvents([]);
      } finally {
        finishLoad();
      }
    })();
    return () => ac.abort();
  }, [city.id, year, monthIndex]);

  useEffect(() => {
    if (city.id !== "sf") {
      setCatEvents([]);
      return;
    }
    const y = year;
    const m = monthIndex + 1;
    const ac = new AbortController();
    const finishLoad = beginSourceLoad(loadEpochRef, pendingLoadsRef, setSourcesLoading);
    (async () => {
      try {
        const res = await fetch(`/api/cat/events?year=${y}&month=${m}`, {
          signal: ac.signal,
        });
        if (!res.ok) {
          setCatEvents([]);
          return;
        }
        const body = (await res.json()) as { events?: WorkshopEvent[] };
        setCatEvents(Array.isArray(body.events) ? body.events : []);
      } catch (e) {
        if ((e as Error).name === "AbortError") return;
        setCatEvents([]);
      } finally {
        finishLoad();
      }
    })();
    return () => ac.abort();
  }, [city.id, year, monthIndex]);

  useEffect(() => {
    if (city.id !== "nyc") {
      setNyplEvents([]);
      return;
    }
    const y = year;
    const m = monthIndex + 1;
    const ac = new AbortController();
    const finishLoad = beginSourceLoad(loadEpochRef, pendingLoadsRef, setSourcesLoading);
    (async () => {
      try {
        const res = await fetch(`/api/nypl/events?year=${y}&month=${m}`, {
          signal: ac.signal,
        });
        if (!res.ok) {
          setNyplEvents([]);
          return;
        }
        const body = (await res.json()) as { events?: WorkshopEvent[] };
        setNyplEvents(Array.isArray(body.events) ? body.events : []);
      } catch (e) {
        if ((e as Error).name === "AbortError") return;
        setNyplEvents([]);
      } finally {
        finishLoad();
      }
    })();
    return () => ac.abort();
  }, [city.id, year, monthIndex]);

  useEffect(() => {
    if (city.id !== "nyc") {
      setCenterForFictionEvents([]);
      return;
    }
    const y = year;
    const m = monthIndex + 1;
    const ac = new AbortController();
    const finishLoad = beginSourceLoad(loadEpochRef, pendingLoadsRef, setSourcesLoading);
    (async () => {
      try {
        const res = await fetch(
          `/api/center-for-fiction/events?year=${y}&month=${m}`,
          { signal: ac.signal },
        );
        if (!res.ok) {
          setCenterForFictionEvents([]);
          return;
        }
        const body = (await res.json()) as { events?: WorkshopEvent[] };
        setCenterForFictionEvents(Array.isArray(body.events) ? body.events : []);
      } catch (e) {
        if ((e as Error).name === "AbortError") return;
        setCenterForFictionEvents([]);
      } finally {
        finishLoad();
      }
    })();
    return () => ac.abort();
  }, [city.id, year, monthIndex]);

  useEffect(() => {
    if (city.id !== "nyc") {
      setJustBuffaloEvents([]);
      return;
    }
    const y = year;
    const m = monthIndex + 1;
    const ac = new AbortController();
    const finishLoad = beginSourceLoad(loadEpochRef, pendingLoadsRef, setSourcesLoading);
    (async () => {
      try {
        const res = await fetch(`/api/just-buffalo/events?year=${y}&month=${m}`, {
          signal: ac.signal,
        });
        if (!res.ok) {
          setJustBuffaloEvents([]);
          return;
        }
        const body = (await res.json()) as { events?: WorkshopEvent[] };
        setJustBuffaloEvents(Array.isArray(body.events) ? body.events : []);
      } catch (e) {
        if ((e as Error).name === "AbortError") return;
        setJustBuffaloEvents([]);
      } finally {
        finishLoad();
      }
    })();
    return () => ac.abort();
  }, [city.id, year, monthIndex]);

  useEffect(() => {
    if (city.id !== "nyc") {
      setPoetsHouseEvents([]);
      return;
    }
    const y = year;
    const m = monthIndex + 1;
    const ac = new AbortController();
    const finishLoad = beginSourceLoad(loadEpochRef, pendingLoadsRef, setSourcesLoading);
    (async () => {
      try {
        const res = await fetch(`/api/poets-house/events?year=${y}&month=${m}`, {
          signal: ac.signal,
        });
        if (!res.ok) {
          setPoetsHouseEvents([]);
          return;
        }
        const body = (await res.json()) as { events?: WorkshopEvent[] };
        setPoetsHouseEvents(Array.isArray(body.events) ? body.events : []);
      } catch (e) {
        if ((e as Error).name === "AbortError") return;
        setPoetsHouseEvents([]);
      } finally {
        finishLoad();
      }
    })();
    return () => ac.abort();
  }, [city.id, year, monthIndex]);

  useEffect(() => {
    if (city.id !== "nyc") {
      setStrandEvents([]);
      return;
    }
    const y = year;
    const m = monthIndex + 1;
    const ac = new AbortController();
    const finishLoad = beginSourceLoad(loadEpochRef, pendingLoadsRef, setSourcesLoading);
    (async () => {
      try {
        const res = await fetch(`/api/strand/events?year=${y}&month=${m}`, {
          signal: ac.signal,
        });
        if (!res.ok) {
          setStrandEvents([]);
          return;
        }
        const body = (await res.json()) as { events?: WorkshopEvent[] };
        setStrandEvents(Array.isArray(body.events) ? body.events : []);
      } catch (e) {
        if ((e as Error).name === "AbortError") return;
        setStrandEvents([]);
      } finally {
        finishLoad();
      }
    })();
    return () => ac.abort();
  }, [city.id, year, monthIndex]);

  useEffect(() => {
    if (city.id !== "nyc") {
      setNy92Events([]);
      return;
    }
    const y = year;
    const m = monthIndex + 1;
    const ac = new AbortController();
    const finishLoad = beginSourceLoad(loadEpochRef, pendingLoadsRef, setSourcesLoading);
    (async () => {
      try {
        const res = await fetch(`/api/92ny/events?year=${y}&month=${m}`, {
          signal: ac.signal,
        });
        if (!res.ok) {
          setNy92Events([]);
          return;
        }
        const body = (await res.json()) as { events?: WorkshopEvent[] };
        setNy92Events(Array.isArray(body.events) ? body.events : []);
      } catch (e) {
        if ((e as Error).name === "AbortError") return;
        setNy92Events([]);
      } finally {
        finishLoad();
      }
    })();
    return () => ac.abort();
  }, [city.id, year, monthIndex]);

  useEffect(() => {
    if (city.id !== "nyc") {
      setNuyoricanEvents([]);
      return;
    }
    const y = year;
    const m = monthIndex + 1;
    const ac = new AbortController();
    const finishLoad = beginSourceLoad(loadEpochRef, pendingLoadsRef, setSourcesLoading);
    (async () => {
      try {
        const res = await fetch(`/api/nuyorican/events?year=${y}&month=${m}`, {
          signal: ac.signal,
        });
        if (!res.ok) {
          setNuyoricanEvents([]);
          return;
        }
        const body = (await res.json()) as { events?: WorkshopEvent[] };
        setNuyoricanEvents(Array.isArray(body.events) ? body.events : []);
      } catch (e) {
        if ((e as Error).name === "AbortError") return;
        setNuyoricanEvents([]);
      } finally {
        finishLoad();
      }
    })();
    return () => ac.abort();
  }, [city.id, year, monthIndex]);

  useEffect(() => {
    if (city.id !== "tn") {
      setTennesseeEvents([]);
      return;
    }
    const y = year;
    const m = monthIndex + 1;
    const ac = new AbortController();
    const finishLoad = beginSourceLoad(loadEpochRef, pendingLoadsRef, setSourcesLoading);
    (async () => {
      try {
        const res = await fetch(`/api/tennessee/events?year=${y}&month=${m}`, {
          signal: ac.signal,
        });
        if (!res.ok) {
          setTennesseeEvents([]);
          return;
        }
        const body = (await res.json()) as { events?: WorkshopEvent[] };
        setTennesseeEvents(Array.isArray(body.events) ? body.events : []);
      } catch (e) {
        if ((e as Error).name === "AbortError") return;
        setTennesseeEvents([]);
      } finally {
        finishLoad();
      }
    })();
    return () => ac.abort();
  }, [city.id, year, monthIndex]);

  useEffect(() => {
    if (
      city.id !== "dmv" &&
      city.id !== "nyc" &&
      city.id !== "la" &&
      city.id !== "sf"
    ) {
      setEventbriteEvents([]);
      setEventbriteMeta(null);
      return;
    }
    const y = year;
    const m = monthIndex + 1;
    const ac = new AbortController();
    const finishLoad = beginSourceLoad(loadEpochRef, pendingLoadsRef, setSourcesLoading);
    const q = `cityId=${encodeURIComponent(city.id)}&year=${y}&month=${m}`;
    (async () => {
      try {
        const res = await fetch(`/api/eventbrite/events?${q}`, {
          signal: ac.signal,
        });
        if (!res.ok) {
          setEventbriteEvents([]);
          setEventbriteMeta(null);
          return;
        }
        const body = (await res.json()) as {
          events?: WorkshopEvent[];
          meta?: typeof eventbriteMeta extends infer T ? T : unknown;
        };
        setEventbriteEvents(Array.isArray(body.events) ? body.events : []);
        setEventbriteMeta(
          body.meta && typeof body.meta === "object" ? (body.meta as any) : null,
        );
      } catch (e) {
        if ((e as Error).name === "AbortError") return;
        setEventbriteEvents([]);
        setEventbriteMeta(null);
      } finally {
        finishLoad();
      }
    })();
    return () => ac.abort();
  }, [city.id, year, monthIndex]);

  const cityEvents = useMemo(() => {
    const base = eventsForCity(city.id);
    const lib = city.id === "dmv" ? libnetEvents : [];
    const twc = city.id === "dmv" ? writersCenterEvents : [];
    const pnp = city.id === "dmv" ? politicsProseEvents : [];
    const scrawl = city.id === "dmv" ? scrawlBooksEvents : [];
    const busboys = city.id === "dmv" ? busboysPoetsEvents : [];
    const mdHum = city.id === "dmv" ? mdHumanitiesEvents : [];
    const pw = city.id === "dmv" ? planetWordEvents : [];
    const writeToRight = city.id === "dmv" ? writeToRightEvents : [];
    const dcArtAllNight = city.id === "dmv" ? dcArtAllNightEvents : [];
    const lapl = city.id === "la" ? laplEvents : [];
    const lyric = city.id === "la" ? lyricHyperionEvents : [];
    const annual = city.id === "la" ? laAnnualEvents : [];
    const lastBookstore = city.id === "la" ? lastBookstoreEvents : [];
    const skylight = city.id === "la" ? skylightBooksEvents : [];
    const writegirl = city.id === "la" ? writegirlEvents : [];
    const daPoetryLounge = city.id === "la" ? daPoetryLoungeEvents : [];
    const worldStage = city.id === "la" ? worldStageEvents : [];
    const storiesLa = city.id === "la" ? storiesLaEvents : [];
    const laPoetSociety = city.id === "la" ? laPoetSocietyEvents : [];
    const laCurated = city.id === "la" ? laCuratedEvents : [];
    const sfpl = city.id === "sf" ? sfplEvents : [];
    const writingSalon = city.id === "sf" ? writingSalonEvents : [];
    const shutUpAndWrite = city.id === "sf" ? shutUpAndWriteEvents : [];
    const doTheBayOpenMic = city.id === "sf" ? doTheBayOpenMicEvents : [];
    const bazaarCafeOpenMic = city.id === "sf" ? bazaarCafeOpenMicEvents : [];
    const decenteredOpenMic = city.id === "sf" ? decenteredOpenMicEvents : [];
    const galeria = city.id === "sf" ? galeriaEvents : [];
    const curatedSfEb = city.id === "sf" ? curatedSfEbEvents : [];
    const sfCurated = city.id === "sf" ? sfCuratedEvents : [];
    const sfww = city.id === "sf" ? sfWritersWorkshopEvents : [];
    const wg = city.id === "sf" ? writersGrottoEvents : [];
    const cat = city.id === "sf" ? catEvents : [];
    const nypl = city.id === "nyc" ? nyplEvents : [];
    const cff = city.id === "nyc" ? centerForFictionEvents : [];
    const jb = city.id === "nyc" ? justBuffaloEvents : [];
    const ph = city.id === "nyc" ? poetsHouseEvents : [];
    const strand = city.id === "nyc" ? strandEvents : [];
    const ny92 = city.id === "nyc" ? ny92Events : [];
    const nycafe = city.id === "nyc" ? nuyoricanEvents : [];
    const tn = city.id === "tn" ? tennesseeEvents : [];
    const eb =
      city.id === "dmv" ||
      city.id === "nyc" ||
      city.id === "la" ||
      city.id === "sf"
        ? eventbriteEvents
        : [];
    return [
      ...base,
      ...lib,
      ...twc,
      ...pnp,
      ...scrawl,
      ...busboys,
      ...mdHum,
      ...pw,
      ...writeToRight,
      ...dcArtAllNight,
      ...lapl,
      ...lyric,
      ...annual,
      ...lastBookstore,
      ...skylight,
      ...writegirl,
      ...daPoetryLounge,
      ...worldStage,
      ...storiesLa,
      ...laPoetSociety,
      ...laCurated,
      ...sfpl,
      ...writingSalon,
      ...shutUpAndWrite,
      ...doTheBayOpenMic,
      ...bazaarCafeOpenMic,
      ...decenteredOpenMic,
      ...galeria,
      ...curatedSfEb,
      ...sfCurated,
      ...sfww,
      ...wg,
      ...cat,
      ...nypl,
      ...cff,
      ...jb,
      ...ph,
      ...strand,
      ...ny92,
      ...nycafe,
      ...tn,
      ...eb,
    ];
  }, [
    city.id,
    libnetEvents,
    writersCenterEvents,
    politicsProseEvents,
    scrawlBooksEvents,
    busboysPoetsEvents,
    mdHumanitiesEvents,
    planetWordEvents,
    writeToRightEvents,
    dcArtAllNightEvents,
    laplEvents,
    lyricHyperionEvents,
    laAnnualEvents,
    lastBookstoreEvents,
    skylightBooksEvents,
    writegirlEvents,
    daPoetryLoungeEvents,
    worldStageEvents,
    storiesLaEvents,
    laPoetSocietyEvents,
    laCuratedEvents,
    sfplEvents,
    writingSalonEvents,
    shutUpAndWriteEvents,
    doTheBayOpenMicEvents,
    bazaarCafeOpenMicEvents,
    decenteredOpenMicEvents,
    galeriaEvents,
    curatedSfEbEvents,
    sfCuratedEvents,
    sfWritersWorkshopEvents,
    writersGrottoEvents,
    catEvents,
    nyplEvents,
    centerForFictionEvents,
    justBuffaloEvents,
    poetsHouseEvents,
    strandEvents,
    ny92Events,
    nuyoricanEvents,
    tennesseeEvents,
    eventbriteEvents,
  ]);
  const categoryOptions = useMemo(
    () => distinctCategories(cityEvents),
    [cityEvents],
  );

  const filtered = useMemo(
    () => applyEventFilters(cityEvents, filters, search),
    [cityEvents, filters, search],
  );

  const inVisibleMonth = useMemo(
    () => filtered.filter((e) => sameMonthAs(e, year, monthIndex)),
    [filtered, year, monthIndex],
  );

  const byDay = useMemo(() => {
    const map = new Map<string, WorkshopEvent[]>();
    for (const ev of inVisibleMonth) {
      const key = localDateKey(ev);
      const list = map.get(key) ?? [];
      list.push(ev);
      map.set(key, list);
    }
    for (const [, list] of map) {
      list.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
    }
    return map;
  }, [inVisibleMonth]);

  const listSorted = useMemo(() => {
    return [...filtered].sort(
      (a, b) => new Date(a.start).getTime() - new Date(b.start).getTime(),
    );
  }, [filtered]);

  const monthLabel = new Date(year, monthIndex, 1).toLocaleString("en-US", {
    month: "long",
    year: "numeric",
  });

  const grid = useMemo(
    () => buildMonthGrid(year, monthIndex),
    [year, monthIndex],
  );

  const goToToday = () => {
    const y = today.getFullYear();
    const m = today.getMonth();
    const r = monthRangeISO(y, m);
    setYear(y);
    setMonthIndex(m);
    setFilters((prev) => ({
      ...prev,
      rangeStart: r.start,
      rangeEnd: r.end,
    }));
  };

  const changeMonth = (delta: number) => {
    const n = shiftMonth(year, monthIndex, delta);
    const r = monthRangeISO(n.year, n.monthIndex);
    setYear(n.year);
    setMonthIndex(n.monthIndex);
    setFilters((prev) => ({
      ...prev,
      rangeStart: r.start,
      rangeEnd: r.end,
    }));
  };

  const isToday = (day: number | null) =>
    day !== null &&
    year === today.getFullYear() &&
    monthIndex === today.getMonth() &&
    day === today.getDate();

  const openEventDetail = (ev: WorkshopEvent) => {
    setDayPanelKey(null);
    setDetail(ev);
  };

  const weekAnchor = useMemo(() => {
    const viewingCurrentMonth =
      year === today.getFullYear() && monthIndex === today.getMonth();
    const anchor = viewingCurrentMonth
      ? DateTime.fromJSDate(today)
      : DateTime.local(year, monthIndex + 1, 1);
    return anchor.startOf("week");
  }, [today, year, monthIndex]);

  const weekRangeLabel = useMemo(() => {
    const end = weekAnchor.plus({ days: 6 });
    const sameMonth = weekAnchor.month === end.month;
    const left = weekAnchor.toFormat("LLL d");
    const right = end.toFormat(sameMonth ? "d" : "LLL d");
    return `${left}–${right}`;
  }, [weekAnchor]);

  const weeklyPool = useMemo(() => {
    const start = weekAnchor;
    const end = weekAnchor.plus({ days: 7 });
    return filtered.filter((ev) => {
      const dt = eventZonedDateTime(ev);
      return dt.isValid && dt >= start && dt < end;
    });
  }, [filtered, weekAnchor]);

  const weeklyHighlights = useMemo(
    () => pickWeeklyHighlights(weeklyPool, 5, 7),
    [weeklyPool],
  );

  const showCalendar = !isMobile && view === "calendar";
  const showList = isMobile || view === "list";

  const dayPanelEvents = dayPanelKey
    ? (byDay.get(dayPanelKey) ?? [])
    : [];

  // While sources are fetching, prefer a loading state over "no events" /
  // "filters" messaging — leftover events from the previous month still count
  // in cityEvents but get filtered out of the visible month.
  const showLoadingEvents = sourcesLoading && inVisibleMonth.length === 0;

  const emptyFiltered =
    !showLoadingEvents &&
    ((showCalendar && inVisibleMonth.length === 0) ||
      (showList && listSorted.length === 0));

  const emptyMessage = (() => {
    if (cityEvents.length > 0) {
      return "No events match your filters — try adjusting them.";
    }

    if (city.id === "dmv") {
      return "No DMV listings for this month from the libraries, Scrawl Books, Busboys and Poets, Maryland Humanities, Politics and Prose, The Writer's Center, Planet Word, Write to Right, DC Art All Night, or Eventbrite — or one of the feeds could not be reached. Try another month or check your connection.";
    }

    if (city.id === "la") {
      return "No LA listings for this month from LAPL, Lyric Hyperion, Los Angeles Literature (annual events index), The Last Bookstore, Skylight Books, WriteGirl, Da Poetry Lounge (Open Mic), The World Stage, Stories Books & Cafe, Los Angeles Poet Society, or Eventbrite, or a feed could not be reached. Try another month or check your connection.";
    }

    if (eventbriteMeta?.configured === false) {
      return (
        eventbriteMeta.message ??
        "Eventbrite ingestion is not configured on this deployment yet. Set EVENTBRITE_API_TOKEN (or EVENTBRITE_OAUTH_TOKEN) and optionally EVENTBRITE_ORGANIZATION_IDS."
      );
    }

    if (city.id === "nyc") {
      return "No New York listings were returned for this month from NYPL, The Center for Fiction, Just Buffalo, Poets House, Strand, 92NY, NuYorican Poets Cafe, or Eventbrite (your orgs / EVENTBRITE_ORGANIZATION_IDS), or a feed could not be reached. Try another month or check your connection.";
    }

    if (city.id === "sf") {
      return "No SF listings were returned for this month from SFPL, The Writing Salon, San Francisco Writers Workshop, The Writers Grotto, Shut Up & Write!® (Meetup), DoTheBay (Poetry Open Mic), Bazaar Cafe (Open Mic), Decentered Studio (Open Mic), Galería de la Raza, or Eventbrite. Try another month or check that Eventbrite org IDs include SF organizers.";
    }

    if (city.id === "tn") {
      return "No Tennessee listings for this month yet. Try another month or check your connection.";
    }

    return "No verified events loaded for this city yet. Wire ingestion (Eventbrite, library calendars, RSS, etc.) so only real dated listings appear here.";
  })();

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
      <div className="flex flex-col gap-5 rounded-sm border border-stone-200/90 bg-[var(--surface)] p-5 shadow-sm dark:border-stone-700/80 dark:bg-stone-900/40 sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0 flex-1">
            <label
              htmlFor="city-select"
              className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-stone-500 dark:text-stone-400"
            >
              Region
            </label>
            <select
              id="city-select"
              value={city.slug}
              onChange={(e) => {
                router.push(`/${e.target.value}`);
              }}
              className="mt-2 block w-full max-w-md rounded-sm border border-stone-200 bg-white px-3 py-2.5 text-sm text-stone-900 shadow-sm focus:border-rose-900/30 focus:outline-none focus:ring-2 focus:ring-rose-900/15 dark:border-stone-600 dark:bg-stone-950 dark:text-stone-100 sm:max-w-xs"
            >
              {CITIES.map((c) => (
                <option key={c.id} value={c.slug}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="min-w-0 flex-1 sm:max-w-md">
            <label
              htmlFor="event-search"
              className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-stone-500 dark:text-stone-400"
            >
              Search
            </label>
            <input
              id="event-search"
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Title, organizer, venue, description…"
              className="mt-2 w-full rounded-sm border border-stone-200 bg-white px-3 py-2.5 text-sm text-stone-900 placeholder:text-stone-400 focus:border-rose-900/30 focus:outline-none focus:ring-2 focus:ring-rose-900/15 dark:border-stone-600 dark:bg-stone-950 dark:text-stone-100"
            />
          </div>
        </div>
        <p className="text-xs leading-relaxed text-stone-500 dark:text-stone-400">
          {cityTimeNote(city)}
        </p>

        <div
          className="border-t border-stone-200/80 pt-5 dark:border-stone-700/80"
          role="search"
          aria-label="Filter events"
        >
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
            <p className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-stone-500 dark:text-stone-400">
              Filters
            </p>
            <div className="flex items-center gap-1.5 text-xs text-stone-500 dark:text-stone-400">
              <button
                type="button"
                onClick={() =>
                  setFilters((prev) => ({ ...prev, ...allFilterSelections() }))
                }
                className="font-medium text-stone-600 underline-offset-2 hover:text-stone-900 hover:underline dark:text-stone-400 dark:hover:text-stone-200"
              >
                Select All
              </button>
              <span aria-hidden className="text-stone-300 dark:text-stone-600">
                |
              </span>
              <button
                type="button"
                onClick={() =>
                  setFilters((prev) => ({ ...prev, ...noFilterSelections() }))
                }
                className="font-medium text-stone-600 underline-offset-2 hover:text-stone-900 hover:underline dark:text-stone-400 dark:hover:text-stone-200"
              >
                Clear All
              </button>
            </div>
          </div>
          <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:flex-wrap lg:items-start lg:gap-6">
            <fieldset className="min-w-0">
              <legend className="text-xs text-stone-600 dark:text-stone-400">
                Format
              </legend>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {ALL_EVENT_FORMATS.map((f) => (
                  <FilterPill
                    key={f}
                    label={FORMAT_LABELS[f]}
                    selected={filters.formats.has(f)}
                    onToggle={() =>
                      setFilters((prev) => ({
                        ...prev,
                        formats: toggleFilterInSet(prev.formats, f),
                      }))
                    }
                  />
                ))}
              </div>
            </fieldset>
            <fieldset className="min-w-0">
              <legend className="text-xs text-stone-600 dark:text-stone-400">
                Price
              </legend>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {ALL_PRICE_KINDS.map((p) => (
                  <FilterPill
                    key={p}
                    label={PRICE_LABELS[p]}
                    selected={filters.prices.has(p)}
                    onToggle={() =>
                      setFilters((prev) => ({
                        ...prev,
                        prices: toggleFilterInSet(prev.prices, p),
                      }))
                    }
                  />
                ))}
              </div>
            </fieldset>
            <fieldset className="min-w-0 flex-1">
              <legend className="text-xs text-stone-600 dark:text-stone-400">
                Event type
              </legend>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {categoryOptions.map((c) => (
                  <FilterPill
                    key={c}
                    label={CATEGORY_LABELS[c]}
                    selected={filters.categoryIncluded.has(c)}
                    onToggle={() =>
                      setFilters((prev) => ({
                        ...prev,
                        categoryIncluded: toggleFilterInSet(
                          prev.categoryIncluded,
                          c,
                        ),
                      }))
                    }
                  />
                ))}
              </div>
            </fieldset>
          </div>

          <details className="mt-4 rounded-sm border border-stone-200/70 dark:border-stone-700/70">
            <summary className="cursor-pointer px-3 py-2.5 text-sm font-medium text-stone-700 dark:text-stone-300">
              More filters — dates
            </summary>
            <div className="space-y-4 border-t border-stone-200/70 px-3 py-4 dark:border-stone-700/70">
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="flex flex-col gap-1 text-sm">
                  <span className="text-xs text-stone-500">From</span>
                  <input
                    type="date"
                    value={filters.rangeStart}
                    onChange={(e) =>
                      setFilters((prev) => ({
                        ...prev,
                        rangeStart: e.target.value,
                      }))
                    }
                    className="rounded-sm border border-stone-200 bg-white px-3 py-2 text-sm dark:border-stone-600 dark:bg-stone-950"
                  />
                </label>
                <label className="flex flex-col gap-1 text-sm">
                  <span className="text-xs text-stone-500">Through</span>
                  <input
                    type="date"
                    value={filters.rangeEnd}
                    onChange={(e) =>
                      setFilters((prev) => ({
                        ...prev,
                        rangeEnd: e.target.value,
                      }))
                    }
                    className="rounded-sm border border-stone-200 bg-white px-3 py-2 text-sm dark:border-stone-600 dark:bg-stone-950"
                  />
                </label>
              </div>
            </div>
          </details>
        </div>

        {!isMobile ? (
          <div
            className="flex flex-wrap gap-2 border-t border-stone-200/80 pt-4 dark:border-stone-700/80"
            role="group"
            aria-label="View mode"
          >
            {(
              [
                ["calendar", "Month"],
                ["list", "Agenda"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setView(id)}
                className={[
                  "min-h-11 min-w-[5.5rem] rounded-sm px-4 py-2 text-sm font-medium transition",
                  view === id
                    ? "bg-stone-900 text-[var(--surface)] dark:bg-stone-100 dark:text-stone-900"
                    : "border border-stone-200 bg-white text-stone-700 hover:bg-stone-50 dark:border-stone-600 dark:bg-stone-950 dark:text-stone-200 dark:hover:bg-stone-900",
                ].join(" ")}
              >
                {label}
              </button>
            ))}
          </div>
        ) : (
          <p className="border-t border-stone-200/80 pt-4 text-sm text-stone-600 dark:border-stone-700/80 dark:text-stone-400">
            Agenda view on small screens — comfortable to scan and tap.
          </p>
        )}
      </div>

      {!showLoadingEvents && weeklyHighlights.length > 0 ? (
        <section
          aria-label="This week’s picks"
          className="rounded-sm border border-stone-200/90 bg-[var(--surface)] p-5 shadow-sm dark:border-stone-700/80 dark:bg-stone-900/30"
        >
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <div>
              <h2 className="font-serif text-xl font-semibold tracking-tight text-stone-900 dark:text-stone-50">
                This Week&apos;s Picks
              </h2>
              <p className="mt-1 text-sm text-stone-600 dark:text-stone-400">
                {weekRangeLabel} · {weeklyHighlights.length} standout{" "}
                {weeklyHighlights.length === 1 ? "event" : "events"}
              </p>
            </div>
          </div>

          <div className="mt-4 -mx-5 overflow-x-auto px-5">
            <div className="flex min-w-full gap-3 pb-1">
              {weeklyHighlights.map((ev) => {
                const whenLabel = formatEventWhenCompact(ev, city);
                const whenStatus = eventWhenStatus(ev);
                return (
                  <button
                    key={ev.id}
                    type="button"
                    onClick={() => openEventDetail(ev)}
                    className={[
                      "group min-h-14 w-[min(22rem,85vw)] shrink-0 rounded-sm border border-stone-200/90 bg-white/90 p-4 text-left shadow-sm transition hover:border-stone-300 hover:bg-stone-50 dark:border-stone-700/80 dark:bg-stone-950/60 dark:hover:bg-stone-900/40",
                      eventWhenChipClasses(whenStatus),
                    ].join(" ")}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <FormatGlyph format={ev.format} />
                          <span
                            className={[
                              "inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                              CATEGORY_TAG_STYLES[ev.category].tag,
                            ].join(" ")}
                          >
                            {CATEGORY_LABELS[ev.category]}
                          </span>
                        </div>
                        <p className="mt-2 line-clamp-2 font-serif text-base font-semibold text-stone-900 dark:text-stone-50">
                          {ev.title}
                        </p>
                        <p className="mt-1 line-clamp-2 text-sm text-stone-600 dark:text-stone-400">
                          {ev.tagline || ev.organizer}
                        </p>
                        <p className="mt-2 text-xs text-stone-500 dark:text-stone-500">
                          {whenLabel}
                          {ev.venue ? ` · ${ev.venue}` : ""}
                        </p>
                      </div>
                      <EventStatusLabel when={whenStatus} />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </section>
      ) : null}

      <div className="flex flex-col gap-0 lg:flex-row lg:items-start">
        <div className="min-w-0 flex-1 rounded-sm border border-stone-200/90 bg-[var(--surface)] shadow-sm dark:border-stone-700/80 dark:bg-stone-900/30">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-200/80 px-4 py-4 sm:px-5 dark:border-stone-700/80">
            <h2 className="font-serif text-xl font-semibold tracking-tight text-stone-900 dark:text-stone-50 sm:text-2xl">
              {monthLabel}
            </h2>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={goToToday}
                className="min-h-11 rounded-sm border border-rose-900/15 bg-rose-50/90 px-3 py-2 text-sm font-medium text-rose-950 hover:bg-rose-100/90 dark:border-rose-400/20 dark:bg-rose-950/40 dark:text-rose-100 dark:hover:bg-rose-950/60"
              >
                Today
              </button>
              <button
                type="button"
                onClick={() => changeMonth(-1)}
                className="min-h-11 rounded-sm border border-stone-200 px-3 py-2 text-sm font-medium text-stone-800 hover:bg-stone-50 dark:border-stone-600 dark:text-stone-200 dark:hover:bg-stone-900"
              >
                Prev
              </button>
              <button
                type="button"
                onClick={() => changeMonth(1)}
                className="min-h-11 rounded-sm border border-stone-200 px-3 py-2 text-sm font-medium text-stone-800 hover:bg-stone-50 dark:border-stone-600 dark:text-stone-200 dark:hover:bg-stone-900"
              >
                Next
              </button>
            </div>
          </div>

          <div className="p-3 sm:p-5">
            {showLoadingEvents ? (
              <div
                className="flex flex-col items-center justify-center gap-3 py-16"
                role="status"
                aria-live="polite"
              >
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-stone-300 border-t-rose-900/80 dark:border-stone-600 dark:border-t-rose-300/80" />
                <p className="text-sm text-stone-600 dark:text-stone-400">
                  Loading calendar…
                </p>
              </div>
            ) : emptyFiltered ? (
              <p className="py-16 text-center text-sm leading-relaxed text-stone-600 dark:text-stone-400">
                {emptyMessage}
              </p>
            ) : showCalendar ? (
              <>
                <div className="mb-2 grid grid-cols-7 gap-px text-center">
                  {WEEKDAYS.map((d) => (
                    <div
                      key={d}
                      className="py-2 text-[0.65rem] font-semibold uppercase tracking-[0.15em] text-stone-500 dark:text-stone-400"
                    >
                      {d}
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-px rounded-sm bg-stone-200/50 p-px dark:bg-stone-700/50">
                  {grid.map((day, i) => {
                    const key =
                      day !== null
                        ? `${year}-${pad2(monthIndex + 1)}-${pad2(day)}`
                        : null;
                    const dayEvents = key ? (byDay.get(key) ?? []) : [];
                    const visible = dayEvents.slice(0, 3);
                    const more = dayEvents.length - visible.length;
                    const dayWhen = key ? dateKeyWhenStatus(key) : null;
                    const cellIsToday = day !== null && isToday(day);

                    return (
                      <div
                        key={`${year}-${monthIndex}-${i}`}
                        className={[
                          "min-h-[8.25rem] sm:min-h-[10.5rem]",
                          day === null
                            ? "bg-[var(--paper)] dark:bg-stone-950/50"
                            : "relative bg-[var(--surface)]",
                        ].join(" ")}
                      >
                        {day !== null ? (
                          <div
                            onClick={() =>
                              dayEvents.length && key && setDayPanelKey(key)
                            }
                            className={[
                              "flex h-full min-h-[8.25rem] w-full flex-col rounded-[1px] p-2 text-left transition sm:min-h-[10.5rem] sm:p-2.5",
                              dayEvents.length
                                ? "cursor-pointer hover:bg-rose-50/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-900/25 dark:hover:bg-stone-800/60"
                                : "cursor-default",
                              dayWhen === "past"
                                ? "bg-stone-50/70 dark:bg-stone-900/20"
                                : "",
                              cellIsToday
                                ? "ring-1 ring-rose-900/30 ring-inset dark:ring-rose-400/30"
                                : "",
                            ].join(" ")}
                          >
                            <div className="flex shrink-0 items-center justify-end gap-1">
                              {cellIsToday ? (
                                <span className="rounded-full bg-rose-900/10 px-1.5 py-px text-[8px] font-semibold uppercase tracking-wide text-rose-900 dark:bg-rose-400/15 dark:text-rose-200 sm:text-[9px]">
                                  Today
                                </span>
                              ) : null}
                              <span
                                className={[
                                  "text-xs font-semibold tabular-nums",
                                  dayWhen === "past"
                                    ? "text-stone-400 dark:text-stone-500"
                                    : "text-stone-600 dark:text-stone-300",
                                ].join(" ")}
                              >
                                {day}
                              </span>
                            </div>
                            <div className="mt-1 flex min-h-0 flex-1 flex-col gap-1 overflow-hidden">
                              {visible.map((ev) => {
                                const evWhen = eventWhenStatus(ev);
                                return (
                                <div key={ev.id} className="min-w-0">
                                  <button
                                    type="button"
                                    title={evWhen === "past" ? "Past event" : undefined}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      openEventDetail(ev);
                                    }}
                                    className={[
                                      "group relative w-full rounded-[2px] border border-stone-200/90 bg-white/90 px-1.5 py-1 text-left shadow-sm transition hover:border-stone-300 hover:shadow dark:border-stone-600 dark:bg-stone-950/80 dark:hover:border-stone-500",
                                      eventWhenChipClasses(evWhen),
                                    ].join(" ")}
                                  >
                                    <div className="flex items-start gap-1">
                                      <FormatGlyph format={ev.format} />
                                      <div className="min-w-0 flex-1">
                                        <p className="line-clamp-2 text-[11px] font-semibold leading-snug text-stone-900 dark:text-stone-100 sm:text-xs">
                                          {ev.title}
                                        </p>
                                        <span
                                          className={[
                                            "mt-0.5 inline-block max-w-full truncate rounded border px-1 py-px text-[9px] font-medium sm:text-[10px]",
                                            CATEGORY_TAG_STYLES[ev.category].tag,
                                          ].join(" ")}
                                        >
                                          {CATEGORY_LABELS[ev.category]}
                                        </span>
                                      </div>
                                    </div>
                                    {evWhen === "past" ? (
                                      <span className="pointer-events-none absolute right-1 top-1 hidden rounded bg-stone-600/85 px-1 py-px text-[8px] font-semibold uppercase tracking-wide text-white group-hover:inline">
                                        Past
                                      </span>
                                    ) : null}
                                  </button>
                                </div>
                              );
                              })}
                              {more > 0 ? (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (key) setDayPanelKey(key);
                                  }}
                                  className="mt-0.5 text-left text-[10px] font-medium text-rose-900/80 underline-offset-2 hover:underline dark:text-rose-300/90 sm:text-xs"
                                >
                                  +{more} more
                                </button>
                              ) : null}
                            </div>
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </>
            ) : (
              <ul className="scroll-smooth divide-y divide-stone-200/90 dark:divide-stone-700/80">
                {listSorted.map((ev) => {
                  const evWhen = eventWhenStatus(ev);
                  return (
                  <li key={ev.id} className="py-4 first:pt-0">
                    <button
                      type="button"
                      onClick={() => openEventDetail(ev)}
                      className={[
                        "flex w-full min-h-12 flex-col gap-2 rounded-sm px-1 text-left transition hover:bg-rose-50/50 dark:hover:bg-stone-800/40 sm:flex-row sm:items-start sm:justify-between sm:gap-4",
                        eventWhenItemClasses(evWhen),
                        evWhen === "today"
                          ? "ring-1 ring-rose-900/15 ring-inset dark:ring-rose-400/20"
                          : "",
                      ].join(" ")}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <FormatGlyph format={ev.format} />
                          <span
                            className={[
                              "rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                              CATEGORY_TAG_STYLES[ev.category].tag,
                            ].join(" ")}
                          >
                            {CATEGORY_LABELS[ev.category]}
                          </span>
                        </div>
                        <p className="mt-1 font-serif text-base font-semibold text-stone-900 dark:text-stone-50">
                          {ev.title}
                        </p>
                        <p className="mt-0.5 text-sm text-stone-600 dark:text-stone-400">
                          {ev.tagline}
                        </p>
                        <p className="mt-2 text-xs text-stone-500 dark:text-stone-500">
                          {formatEventWhen(ev, city)}
                          {" · "}
                          {PRICE_LABELS[ev.price]}
                          {ev.neighborhood ? ` · ${ev.neighborhood}` : ""}
                        </p>
                      </div>
                      <EventStatusLabel when={evWhen} />
                    </button>
                  </li>
                );
                })}
              </ul>
            )}
          </div>
        </div>

        {dayPanelKey && !isMobile ? (
          <aside
            className="sticky top-4 hidden w-[min(100%,380px)] shrink-0 border-l border-stone-200/90 bg-[var(--surface)] shadow-sm dark:border-stone-700/80 dark:bg-stone-900/40 lg:block"
            aria-label="Events this day"
          >
            <DayPanelBody
              dateKey={dayPanelKey}
              city={city}
              events={dayPanelEvents}
              onClose={() => setDayPanelKey(null)}
              onPick={openEventDetail}
            />
          </aside>
        ) : null}
      </div>

      {dayPanelKey && isMobile ? (
        <DayEventsOverlay
          dateKey={dayPanelKey}
          city={city}
          events={dayPanelEvents}
          onClose={() => setDayPanelKey(null)}
          onPick={openEventDetail}
        />
      ) : null}

      {detail ? (
        <EventDetailModal
          event={detail}
          city={city}
          onClose={() => setDetail(null)}
        />
      ) : null}
    </div>
  );
}

function DayPanelBody({
  dateKey,
  city,
  events,
  onClose,
  onPick,
}: {
  dateKey: string;
  city: City;
  events: WorkshopEvent[];
  onClose: () => void;
  onPick: (ev: WorkshopEvent) => void;
}) {
  const d = new Date(dateKey + "T12:00:00");
  const heading = d.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  const dayWhen = dateKeyWhenStatus(dateKey);

  return (
    <div className="flex max-h-[calc(100vh-6rem)] flex-col">
      <div className="flex items-start justify-between gap-3 border-b border-stone-200/80 px-4 py-4 dark:border-stone-700/80">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-stone-500">
              This day
            </p>
            {dayWhen !== "future" ? <EventStatusLabel when={dayWhen} /> : null}
          </div>
          <p className="mt-1 font-serif text-lg font-semibold text-stone-900 dark:text-stone-50">
            {heading}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-sm border border-stone-200 px-2 py-1 text-sm text-stone-600 hover:bg-stone-50 dark:border-stone-600 dark:text-stone-300 dark:hover:bg-stone-900"
        >
          Close
        </button>
      </div>
      <ul className="flex-1 overflow-y-auto px-3 py-3">
        {events.map((ev) => {
          const evWhen = eventWhenStatus(ev);
          return (
          <li key={ev.id} className="border-b border-stone-100 py-3 last:border-0 dark:border-stone-800">
            <button
              type="button"
              onClick={() => onPick(ev)}
              className={[
                "flex w-full flex-col gap-1 text-left",
                eventWhenItemClasses(evWhen),
              ].join(" ")}
            >
              <div className="flex items-center gap-2">
                <FormatGlyph format={ev.format} />
                <span
                  className={[
                    "rounded border px-1.5 py-0.5 text-[10px] font-semibold",
                    CATEGORY_TAG_STYLES[ev.category].tag,
                  ].join(" ")}
                >
                  {CATEGORY_LABELS[ev.category]}
                </span>
                {evWhen !== "future" ? (
                  <EventStatusLabel
                    when={evWhen}
                    className={
                      evWhen === "today"
                        ? "rounded-full bg-rose-900/10 px-1.5 py-px text-[9px] font-semibold uppercase tracking-wide text-rose-900 dark:bg-rose-400/15 dark:text-rose-200"
                        : "rounded-full bg-stone-200/90 px-1.5 py-px text-[9px] font-semibold uppercase tracking-wide text-stone-600 dark:bg-stone-700/90 dark:text-stone-300"
                    }
                  />
                ) : null}
              </div>
              <span className="font-serif text-sm font-semibold text-stone-900 dark:text-stone-50">
                {ev.title}
              </span>
              <span className="text-xs text-stone-500">
                {formatEventWhen(ev, city)} · {PRICE_LABELS[ev.price]}
              </span>
            </button>
          </li>
        );
        })}
      </ul>
    </div>
  );
}

function DayEventsOverlay({
  dateKey,
  city,
  events,
  onClose,
  onPick,
}: {
  dateKey: string;
  city: City;
  events: WorkshopEvent[];
  onClose: () => void;
  onPick: (ev: WorkshopEvent) => void;
}) {
  useEscapeKey(onClose);
  return (
    <div
      className="fixed inset-0 z-40 flex flex-col bg-black/40 lg:hidden"
      role="dialog"
      aria-modal="true"
    >
      <button
        type="button"
        className="min-h-0 flex-1 cursor-default"
        aria-label="Close"
        onClick={onClose}
      />
      <div className="max-h-[85vh] overflow-hidden rounded-t-2xl border border-stone-200 bg-[var(--surface)] shadow-2xl dark:border-stone-700 dark:bg-stone-950">
        <DayPanelBody
          dateKey={dateKey}
          city={city}
          events={events}
          onClose={onClose}
          onPick={onPick}
        />
      </div>
    </div>
  );
}

function useEscapeKey(onClose: () => void) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
}

function FilterPill({
  label,
  selected,
  onToggle,
}: {
  label: string;
  selected: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={selected}
      onClick={onToggle}
      className={[
        "rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
        selected
          ? "border border-stone-800 bg-stone-800 text-stone-50 dark:border-stone-200 dark:bg-stone-200 dark:text-stone-900"
          : "border border-stone-300 bg-transparent text-stone-600 hover:border-stone-400 dark:border-stone-600 dark:text-stone-400 dark:hover:border-stone-500",
      ].join(" ")}
    >
      {label}
    </button>
  );
}

function locationSummary(event: WorkshopEvent): string {
  if (event.format === "virtual") {
    return event.virtualLabel
      ? `Virtual (${event.virtualLabel})`
      : "Virtual";
  }
  if (event.format === "hybrid") {
    const online = event.virtualLabel ?? "Online";
    const place = event.venue
      ? `${event.venue}${event.address ? `, ${event.address}` : ""}`
      : "In-person location TBA";
    return `${online} · ${place}`;
  }
  if (event.venue) {
    return `${event.venue}${event.address ? ` — ${event.address}` : ""}${
      event.neighborhood ? ` (${event.neighborhood})` : ""
    }`;
  }
  return "Venue to be announced";
}

function EventDetailModal({
  event,
  city,
  onClose,
}: {
  event: WorkshopEvent;
  city: City;
  onClose: () => void;
}) {
  useEscapeKey(onClose);

  const isSample = event.listingProvenance === "sample";
  const whenStatus = eventWhenStatus(event);
  const [synopsis, setSynopsis] = useState<string | null>(null);

  useEffect(() => {
    setSynopsis(null);
    if (
      !event.rsvpUrl ||
      !event.rsvpUrl.includes("politics-prose.com") ||
      event.organizer !== "Politics and Prose"
    ) {
      return;
    }
    const ac = new AbortController();
    (async () => {
      try {
        const res = await fetch(event.rsvpUrl!, { signal: ac.signal });
        if (!res.ok) return;
        const html = await res.text();
        const og =
          html.match(/property=["']og:description["'][^>]*content=["']([^"']+)["']/i)?.[1] ??
          html.match(/name=["']description["'][^>]*content=["']([^"']+)["']/i)?.[1] ??
          null;
        const cleaned = decodeHtmlEntities(og ?? "").replace(/\s+/g, " ").trim();
        if (cleaned) setSynopsis(cleaned);
      } catch (e) {
        if ((e as Error).name === "AbortError") return;
      }
    })();
    return () => ac.abort();
  }, [event.organizer, event.rsvpUrl]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="event-detail-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-stone-900/45 backdrop-blur-[2px]"
        aria-label="Close"
        onClick={onClose}
      />
      <div className="relative z-10 max-h-[min(92vh,900px)] w-full max-w-lg overflow-y-auto rounded-t-2xl border border-stone-200 bg-[var(--surface)] shadow-2xl dark:border-stone-700 dark:bg-stone-950 sm:rounded-sm">
        <div className="border-b border-stone-200/90 px-6 pb-5 pt-6 dark:border-stone-700/80">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-stone-500 dark:text-stone-400">
                  {CATEGORY_LABELS[event.category]}
                  {" · "}
                  {FORMAT_LABELS[event.format]}
                </p>
                {whenStatus !== "future" ? (
                  <EventStatusLabel when={whenStatus} />
                ) : null}
              </div>
              <h2
                id="event-detail-title"
                className="mt-3 font-serif text-2xl font-semibold leading-snug tracking-tight text-stone-900 dark:text-stone-50 sm:text-3xl"
              >
                {event.title}
              </h2>
              <p className="mt-3 text-base leading-relaxed text-stone-700 dark:text-stone-300">
                {event.tagline}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="shrink-0 rounded-sm border border-stone-200 px-2.5 py-1.5 text-sm text-stone-600 hover:bg-stone-50 dark:border-stone-600 dark:text-stone-300 dark:hover:bg-stone-900"
            >
              Close
            </button>
          </div>
        </div>

        <div className="space-y-6 px-6 py-6">
          {isSample ? (
            <div
              role="status"
              className="rounded-sm border border-amber-200/90 bg-amber-50/90 px-3 py-2.5 text-sm text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-50"
            >
              <strong>Demo listing</strong> — not synced from a live source. Do
              not treat dates or venues as real.
            </div>
          ) : null}

          <div>
            <p className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-stone-500 dark:text-stone-400">
              Date &amp; time
            </p>
            <p className="mt-2 text-sm leading-relaxed text-stone-800 dark:text-stone-200">
              {formatEventDateTimeDetail(event, city)}
            </p>
          </div>

          <div>
            <p className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-stone-500 dark:text-stone-400">
              Location
            </p>
            <p className="mt-2 text-sm leading-relaxed text-stone-800 dark:text-stone-200">
              {locationSummary(event)}
            </p>
          </div>

          <div>
            <p className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-stone-500 dark:text-stone-400">
              About
            </p>
            <p className="mt-2 text-sm leading-relaxed text-stone-700 dark:text-stone-300">
              {synopsis ?? stripHtmlAndDecode(event.description)}
            </p>
          </div>

          <div>
            <p className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-stone-500 dark:text-stone-400">
              Organizer
            </p>
            <p className="mt-2 text-sm font-medium text-stone-900 dark:text-stone-100">
              {event.organizer}
            </p>
          </div>

          {event.rsvpUrl ? (
            <div className="space-y-2">
              {event.rsvpIsGeneralCalendar ? (
                <p className="text-sm text-stone-500 dark:text-stone-400">
                  No direct link to this event — the full events list is here:
                </p>
              ) : null}
              <a
                href={event.rsvpUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-12 w-full items-center justify-center rounded-sm bg-stone-900 px-5 py-3 text-sm font-semibold text-[var(--surface)] transition hover:bg-stone-800 dark:bg-stone-100 dark:text-stone-900 dark:hover:bg-white"
              >
                {event.rsvpIsGeneralCalendar
                  ? "View full events calendar"
                  : "RSVP / Learn more"}
              </a>
            </div>
          ) : (
            <p className="text-sm text-stone-500 dark:text-stone-400">
              No direct link on file — visit the organizer&apos;s site.
            </p>
          )}

        </div>
      </div>
    </div>
  );
}
