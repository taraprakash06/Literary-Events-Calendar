"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type MutableRefObject } from "react";
import { DateTime } from "luxon";
import { CITIES } from "@/data/cities";
import { eventsForCity } from "@/data/workshop-events";
import { CATEGORY_TAG_STYLES } from "@/lib/category-styles";
import { polishAboutText, stripHtmlAndDecode } from "@/lib/text";
import { isSparseEventDescription } from "@/lib/rsvp-page-enrichment";
import {
  applyEventFilters,
  distinctCategories,
  enrichEventAccessFromCopy,
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
import {
  fetchDmvMonthSources,
  monthCacheKey,
  type DmvMonthSources,
  type DmvSourceKey,
} from "@/lib/dmv-month-fetch";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

/** Client-side cache so revisiting a month (or prefetch) skips the empty loading state. */
const dmvMonthCache = new Map<string, DmvMonthSources>();

function applyDmvSourcePartial(
  key: DmvSourceKey,
  events: WorkshopEvent[],
  setters: {
    setLibnetEvents: (e: WorkshopEvent[]) => void;
    setWritersCenterEvents: (e: WorkshopEvent[]) => void;
    setPoliticsProseEvents: (e: WorkshopEvent[]) => void;
    setScrawlBooksEvents: (e: WorkshopEvent[]) => void;
    setBusboysPoetsEvents: (e: WorkshopEvent[]) => void;
    setMdHumanitiesEvents: (e: WorkshopEvent[]) => void;
    setPlanetWordEvents: (e: WorkshopEvent[]) => void;
    setWriteToRightEvents: (e: WorkshopEvent[]) => void;
    setDcArtAllNightEvents: (e: WorkshopEvent[]) => void;
    setDmvCuratedEvents: (e: WorkshopEvent[]) => void;
  },
) {
  switch (key) {
    case "libnet":
      setters.setLibnetEvents(events);
      break;
    case "writersCenter":
      setters.setWritersCenterEvents(events);
      break;
    case "politicsProse":
      setters.setPoliticsProseEvents(events);
      break;
    case "scrawlBooks":
      setters.setScrawlBooksEvents(events);
      break;
    case "busboysPoets":
      setters.setBusboysPoetsEvents(events);
      break;
    case "mdHumanities":
      setters.setMdHumanitiesEvents(events);
      break;
    case "planetWord":
      setters.setPlanetWordEvents(events);
      break;
    case "writeToRight":
      setters.setWriteToRightEvents(events);
      break;
    case "dcArtAllNight":
      setters.setDcArtAllNightEvents(events);
      break;
    case "dmvCurated":
      setters.setDmvCuratedEvents(events);
      break;
    case "eventbrite":
      break;
  }
}

function applyDmvMonthSources(
  sources: DmvMonthSources,
  setters: Parameters<typeof applyDmvSourcePartial>[2],
) {
  setters.setLibnetEvents(sources.libnet);
  setters.setWritersCenterEvents(sources.writersCenter);
  setters.setPoliticsProseEvents(sources.politicsProse);
  setters.setScrawlBooksEvents(sources.scrawlBooks);
  setters.setBusboysPoetsEvents(sources.busboysPoets);
  setters.setMdHumanitiesEvents(sources.mdHumanities);
  setters.setPlanetWordEvents(sources.planetWord);
  setters.setWriteToRightEvents(sources.writeToRight);
  setters.setDcArtAllNightEvents(sources.dcArtAllNight);
  setters.setDmvCuratedEvents(sources.dmvCurated);
}

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
    return [base, "ring-1 ring-[var(--accent)]/25"].filter(Boolean).join(" ");
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

/** Clear facet checkboxes — empty sets mean no restriction (show all). */
function clearFilterSelections(): Pick<
  EventFilters,
  "formats" | "prices" | "categoryIncluded" | "registrationRequiredOnly"
> {
  return {
    formats: new Set(),
    prices: new Set(),
    categoryIncluded: new Set(),
    registrationRequiredOnly: false,
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
          "shrink-0 text-xs font-semibold text-[var(--accent)]"
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
          "shrink-0 bg-[var(--accent-soft)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--accent-ink)]"
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
        "shrink-0 bg-[var(--paper)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)]"
      }
    >
      Past
    </span>
  );
}

function FormatGlyph({ format }: { format: EventFormat }) {
  const common = "h-3 w-3 shrink-0 text-[var(--muted)]";
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
  /** About/price filled from RSVP pages when the feed only had a stub. */
  const [rsvpEnrichments, setRsvpEnrichments] = useState<
    Record<string, { description?: string; price?: PriceKind; priceDetail?: string }>
  >({});

  const [filters, setFilters] = useState<EventFilters>(() => {
    const r = monthRangeISO(today.getFullYear(), today.getMonth());
    return {
      formats: new Set(),
      prices: new Set(),
      categoryIncluded: new Set(),
      registrationRequiredOnly: false,
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
  const [dmvCuratedEvents, setDmvCuratedEvents] = useState<WorkshopEvent[]>([]);
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
  const [nebraskaEvents, setNebraskaEvents] = useState<WorkshopEvent[]>([]);
  const [omahaLibraryEvents, setOmahaLibraryEvents] = useState<WorkshopEvent[]>([]);
  const [sanDiegoEvents, setSanDiegoEvents] = useState<WorkshopEvent[]>([]);
  const [sdclLibraryEvents, setSdclLibraryEvents] = useState<WorkshopEvent[]>([]);

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
      setDmvCuratedEvents([]);
      return;
    }
    const ac = new AbortController();
    const finishLoad = beginSourceLoad(loadEpochRef, pendingLoadsRef, setSourcesLoading);
    const setters = {
      setLibnetEvents,
      setWritersCenterEvents,
      setPoliticsProseEvents,
      setScrawlBooksEvents,
      setBusboysPoetsEvents,
      setMdHumanitiesEvents,
      setPlanetWordEvents,
      setWriteToRightEvents,
      setDcArtAllNightEvents,
      setDmvCuratedEvents,
    };
    const cacheKey = monthCacheKey("dmv", year, monthIndex);
    const cached = dmvMonthCache.get(cacheKey);
    if (cached) {
      // Instant paint from a prior visit / prefetch — still refresh below.
      applyDmvMonthSources(cached, setters);
    }

    // Prefetch neighbors ASAP (don't wait for the current month to finish) so
    // Next/Prev can paint from cache instead of an empty "Loading calendar…".
    for (const n of [shiftMonth(year, monthIndex, -1), shiftMonth(year, monthIndex, 1)]) {
      const nKey = monthCacheKey("dmv", n.year, n.monthIndex);
      if (dmvMonthCache.has(nKey)) continue;
      void fetchDmvMonthSources(n.year, n.monthIndex).then((s) => {
        dmvMonthCache.set(nKey, s);
      });
    }

    (async () => {
      try {
        const sources = await fetchDmvMonthSources(year, monthIndex, {
          signal: ac.signal,
          onPartial: (key, events) => {
            applyDmvSourcePartial(key, events, setters);
          },
        });
        dmvMonthCache.set(cacheKey, sources);
      } catch (e) {
        if ((e as Error).name === "AbortError") return;
        if (!cached) {
          setLibnetEvents([]);
          setWritersCenterEvents([]);
          setPoliticsProseEvents([]);
          setScrawlBooksEvents([]);
          setBusboysPoetsEvents([]);
          setMdHumanitiesEvents([]);
          setPlanetWordEvents([]);
          setWriteToRightEvents([]);
          setDcArtAllNightEvents([]);
          setDmvCuratedEvents([]);
        }
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
    if (city.id !== "ne") {
      setNebraskaEvents([]);
      return;
    }
    const y = year;
    const m = monthIndex + 1;
    const ac = new AbortController();
    const finishLoad = beginSourceLoad(loadEpochRef, pendingLoadsRef, setSourcesLoading);
    (async () => {
      try {
        const res = await fetch(`/api/nebraska/events?year=${y}&month=${m}`, {
          signal: ac.signal,
        });
        if (!res.ok) {
          setNebraskaEvents([]);
          return;
        }
        const body = (await res.json()) as { events?: WorkshopEvent[] };
        setNebraskaEvents(Array.isArray(body.events) ? body.events : []);
      } catch (e) {
        if ((e as Error).name === "AbortError") return;
        setNebraskaEvents([]);
      } finally {
        finishLoad();
      }
    })();
    return () => ac.abort();
  }, [city.id, year, monthIndex]);

  useEffect(() => {
    if (city.id !== "ne") {
      setOmahaLibraryEvents([]);
      return;
    }
    const y = year;
    const m = monthIndex + 1;
    const ac = new AbortController();
    const finishLoad = beginSourceLoad(loadEpochRef, pendingLoadsRef, setSourcesLoading);
    (async () => {
      try {
        const res = await fetch(
          `/api/omaha-public-library/events?year=${y}&month=${m}`,
          { signal: ac.signal },
        );
        if (!res.ok) {
          setOmahaLibraryEvents([]);
          return;
        }
        const body = (await res.json()) as { events?: WorkshopEvent[] };
        setOmahaLibraryEvents(Array.isArray(body.events) ? body.events : []);
      } catch (e) {
        if ((e as Error).name === "AbortError") return;
        setOmahaLibraryEvents([]);
      } finally {
        finishLoad();
      }
    })();
    return () => ac.abort();
  }, [city.id, year, monthIndex]);

  useEffect(() => {
    if (city.id !== "sd") {
      setSanDiegoEvents([]);
      return;
    }
    const y = year;
    const m = monthIndex + 1;
    const ac = new AbortController();
    const finishLoad = beginSourceLoad(loadEpochRef, pendingLoadsRef, setSourcesLoading);
    (async () => {
      try {
        const res = await fetch(`/api/san-diego/events?year=${y}&month=${m}`, {
          signal: ac.signal,
        });
        if (!res.ok) {
          setSanDiegoEvents([]);
          return;
        }
        const body = (await res.json()) as { events?: WorkshopEvent[] };
        setSanDiegoEvents(Array.isArray(body.events) ? body.events : []);
      } catch (e) {
        if ((e as Error).name === "AbortError") return;
        setSanDiegoEvents([]);
      } finally {
        finishLoad();
      }
    })();
    return () => ac.abort();
  }, [city.id, year, monthIndex]);

  useEffect(() => {
    if (city.id !== "sd") {
      setSdclLibraryEvents([]);
      return;
    }
    const y = year;
    const m = monthIndex + 1;
    const ac = new AbortController();
    const finishLoad = beginSourceLoad(loadEpochRef, pendingLoadsRef, setSourcesLoading);
    (async () => {
      try {
        const res = await fetch(`/api/sdcl/events?year=${y}&month=${m}`, {
          signal: ac.signal,
        });
        if (!res.ok) {
          setSdclLibraryEvents([]);
          return;
        }
        const body = (await res.json()) as { events?: WorkshopEvent[] };
        setSdclLibraryEvents(Array.isArray(body.events) ? body.events : []);
      } catch (e) {
        if ((e as Error).name === "AbortError") return;
        setSdclLibraryEvents([]);
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
    const dmvCurated = city.id === "dmv" ? dmvCuratedEvents : [];
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
    const ne = city.id === "ne" ? nebraskaEvents : [];
    const opl = city.id === "ne" ? omahaLibraryEvents : [];
    const sd = city.id === "sd" ? sanDiegoEvents : [];
    const sdcl = city.id === "sd" ? sdclLibraryEvents : [];
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
      ...dmvCurated,
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
      ...ne,
      ...opl,
      ...sd,
      ...sdcl,
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
    dmvCuratedEvents,
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
    nebraskaEvents,
    omahaLibraryEvents,
    sanDiegoEvents,
    sdclLibraryEvents,
    eventbriteEvents,
  ]);
  const categoryOptions = useMemo(
    () => distinctCategories(cityEvents),
    [cityEvents],
  );

  const cityEventsEnriched = useMemo(() => {
    return cityEvents.map((ev) => {
      const patch = rsvpEnrichments[ev.id];
      const merged = patch ? { ...ev, ...patch } : ev;
      return enrichEventAccessFromCopy(merged);
    });
  }, [cityEvents, rsvpEnrichments]);

  const filtered = useMemo(
    () => applyEventFilters(cityEventsEnriched, filters, search),
    [cityEventsEnriched, filters, search],
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
    const patch = rsvpEnrichments[ev.id];
    const merged = patch ? { ...ev, ...patch } : ev;
    setDetail(enrichEventAccessFromCopy(merged));
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
      return "No DMV listings for this month from the libraries, Scrawl Books, Busboys and Poets, Maryland Humanities, Politics and Prose, The Writer's Center, Planet Word, Write to Right, curated campus events, DC Art All Night, or Eventbrite — or one of the feeds could not be reached. Try another month or check your connection.";
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
    if (city.id === "ne") {
      return "No Omaha / Lincoln listings for this month from curated bookstores, Nebraska Writers Collective, or Omaha Public Library — or a feed could not be reached. Try another month or check your connection.";
    }
    if (city.id === "sd") {
      return "No San Diego listings for this month from curated sources or San Diego County Library — or a feed could not be reached. Try another month or check your connection.";
    }

    return "No verified events loaded for this city yet. Wire ingestion (Eventbrite, library calendars, RSS, etc.) so only real dated listings appear here.";
  })();

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col">
      <div className="flex flex-col gap-5 border-b border-[var(--line)] pb-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between md:gap-10">
          <div className="min-w-0 md:max-w-sm">
            <label
              htmlFor="city-select"
              className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-[var(--muted)]"
            >
              City
            </label>
            <select
              id="city-select"
              value={city.slug}
              onChange={(e) => {
                router.push(`/${e.target.value}`);
              }}
              className="mt-1.5 block w-full border-0 border-b border-[var(--line)] bg-transparent px-0 py-2 text-sm text-[var(--ink)] focus:border-[var(--accent)] focus:outline-none focus:ring-0"
            >
              {CITIES.map((c) => (
                <option key={c.id} value={c.slug}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="min-w-0 flex-1 md:max-w-md">
            <label
              htmlFor="event-search"
              className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-[var(--muted)]"
            >
              Search
            </label>
            <input
              id="event-search"
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Title, organizer, venue…"
              className="mt-1.5 w-full border-0 border-b border-[var(--line)] bg-transparent px-0 py-2 text-sm text-[var(--ink)] placeholder:text-[var(--muted)]/65 focus:border-[var(--accent)] focus:outline-none focus:ring-0"
            />
          </div>
        </div>
        <p className="text-sm leading-relaxed text-[var(--muted)]">
          {cityTimeNote(city)}
        </p>

        <div role="search" aria-label="Filter events" className="pt-1">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
            <p className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
              Filters
            </p>
            <button
              type="button"
              onClick={() =>
                setFilters((prev) => ({ ...prev, ...clearFilterSelections() }))
              }
              className="text-xs font-medium text-[var(--muted)] underline-offset-2 hover:text-[var(--ink)] hover:underline"
            >
              Clear filters
            </button>
          </div>
          <div className="mt-3 flex flex-col gap-3.5 lg:flex-row lg:flex-wrap lg:items-start lg:gap-x-8 lg:gap-y-3">
            <fieldset className="min-w-0">
              <legend className="text-xs text-[var(--muted)]">
                Format
              </legend>
              <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1.5">
                {ALL_EVENT_FORMATS.map((f) => (
                  <FilterCheckbox
                    key={f}
                    label={FORMAT_LABELS[f]}
                    checked={filters.formats.has(f)}
                    onChange={() =>
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
              <legend className="text-xs text-[var(--muted)]">
                Price
              </legend>
              <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1.5">
                {ALL_PRICE_KINDS.map((p) => (
                  <FilterCheckbox
                    key={p}
                    label={PRICE_LABELS[p]}
                    checked={filters.prices.has(p)}
                    onChange={() =>
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
              <legend className="text-xs text-[var(--muted)]">
                Event type
              </legend>
              <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1.5">
                {categoryOptions.map((c) => (
                  <FilterCheckbox
                    key={c}
                    label={CATEGORY_LABELS[c]}
                    checked={filters.categoryIncluded.has(c)}
                    onChange={() =>
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
            <fieldset className="min-w-0">
              <legend className="text-xs text-[var(--muted)]">
                Access
              </legend>
              <label className="mt-1.5 flex cursor-pointer items-start gap-2 text-sm text-[var(--ink)]">
                <input
                  type="checkbox"
                  checked={filters.registrationRequiredOnly}
                  onChange={(e) =>
                    setFilters((prev) => ({
                      ...prev,
                      registrationRequiredOnly: e.target.checked,
                    }))
                  }
                  className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--accent)]"
                />
                <span>RSVP/registration-required events only</span>
              </label>
            </fieldset>
          </div>

          <details className="mt-3">
            <summary className="cursor-pointer py-1.5 text-sm text-[var(--muted)] underline-offset-2 hover:text-[var(--ink)] hover:underline">
              Date range
            </summary>
            <div className="mt-2 grid max-w-lg gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-xs text-[var(--muted)]">From</span>
                <input
                  type="date"
                  value={filters.rangeStart}
                  onChange={(e) =>
                    setFilters((prev) => ({
                      ...prev,
                      rangeStart: e.target.value,
                    }))
                  }
                  className="border-0 border-b border-[var(--line)] bg-transparent px-0 py-1.5 text-sm focus:border-[var(--accent)] focus:outline-none"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-xs text-[var(--muted)]">Through</span>
                <input
                  type="date"
                  value={filters.rangeEnd}
                  onChange={(e) =>
                    setFilters((prev) => ({
                      ...prev,
                      rangeEnd: e.target.value,
                    }))
                  }
                  className="border-0 border-b border-[var(--line)] bg-transparent px-0 py-1.5 text-sm focus:border-[var(--accent)] focus:outline-none"
                />
              </label>
            </div>
          </details>
        </div>

        {!isMobile ? (
          <div
            className="flex flex-wrap gap-x-5 gap-y-1 pt-1"
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
                  "min-h-9 border-b-2 px-0.5 pb-1 text-sm transition",
                  view === id
                    ? "border-[var(--ink)] font-medium text-[var(--ink)]"
                    : "border-transparent text-[var(--muted)] hover:text-[var(--ink)]",
                ].join(" ")}
              >
                {label}
              </button>
            ))}
          </div>
        ) : (
          <p className="pt-1 text-sm text-[var(--muted)]">
            Agenda view on small screens.
          </p>
        )}
      </div>

      {!showLoadingEvents && weeklyHighlights.length > 0 ? (
        <section
          aria-label="This week’s picks"
          className="mt-9 border-b border-[var(--line)] pb-8"
        >
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <div>
              <h2 className="font-serif text-2xl font-normal tracking-tight text-[var(--ink)]">
                This week in {city.label}
              </h2>
              <p className="mt-1.5 text-sm text-[var(--muted)]">
                {weekRangeLabel} · {weeklyHighlights.length}{" "}
                {weeklyHighlights.length === 1 ? "event" : "events"} worth
                opening first
              </p>
            </div>
          </div>

          <div className="mt-4 overflow-x-auto">
            <div className="flex min-w-full gap-5 pb-1">
              {weeklyHighlights.map((ev) => {
                const whenLabel = formatEventWhenCompact(ev, city);
                const whenStatus = eventWhenStatus(ev);
                return (
                  <button
                    key={ev.id}
                    type="button"
                    onClick={() => openEventDetail(ev)}
                    className={[
                      "group min-h-14 w-[min(20rem,82vw)] shrink-0 border-b border-[var(--line)] pb-4 text-left transition hover:border-[var(--accent)]",
                      eventWhenChipClasses(whenStatus),
                    ].join(" ")}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <FormatGlyph format={ev.format} />
                          <span
                            className={[
                              "inline-flex items-center border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                              CATEGORY_TAG_STYLES[ev.category].tag,
                            ].join(" ")}
                          >
                            {CATEGORY_LABELS[ev.category]}
                          </span>
                        </div>
                        <p className="mt-2 line-clamp-2 font-serif text-[1.05rem] font-normal text-[var(--ink)]">
                          {ev.title}
                        </p>
                        <p className="mt-1 line-clamp-2 text-sm text-[var(--muted)]">
                          {ev.tagline || ev.organizer}
                        </p>
                        <p className="mt-2 text-xs text-[var(--muted)]">
                          {whenLabel}
                          {ev.venue
                            ? ` · ${stripHtmlAndDecode(ev.venue)}`
                            : ""}
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

      <div className="mt-8 flex flex-col gap-0 lg:mt-10 lg:flex-row lg:items-start">
        <div className="min-w-0 flex-1">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <h2 className="font-serif text-[1.85rem] font-normal tracking-tight text-[var(--ink)] sm:text-3xl">
              {monthLabel}
            </h2>
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={goToToday}
                className="min-h-9 text-sm font-medium text-[var(--accent)] underline-offset-4 hover:underline"
              >
                Today
              </button>
              <button
                type="button"
                onClick={() => changeMonth(-1)}
                className="min-h-9 text-sm text-[var(--muted)] hover:text-[var(--ink)]"
              >
                Prev
              </button>
              <button
                type="button"
                onClick={() => changeMonth(1)}
                className="min-h-9 text-sm text-[var(--muted)] hover:text-[var(--ink)]"
              >
                Next
              </button>
            </div>
          </div>

          <div>
            {showLoadingEvents ? (
              <div
                className="flex flex-col items-center justify-center gap-3 py-20"
                role="status"
                aria-live="polite"
              >
                <div className="h-5 w-5 animate-spin rounded-full border border-[var(--line)] border-t-[var(--accent)]" />
                <p className="text-sm text-[var(--muted)]">
                  Loading calendar…
                </p>
              </div>
            ) : emptyFiltered ? (
              <p className="max-w-xl py-16 text-sm leading-relaxed text-[var(--muted)]">
                {emptyMessage}
              </p>
            ) : showCalendar ? (
              <>
                <div className="mb-1 grid grid-cols-7 text-center">
                  {WEEKDAYS.map((d) => (
                    <div
                      key={d}
                      className="py-2 text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]"
                    >
                      {d}
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-px border-t border-[var(--line)] bg-[var(--line)]">
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
                          "min-h-[8.5rem] sm:min-h-[11rem]",
                          day === null
                            ? "bg-[var(--paper)]"
                            : cellIsToday
                              ? "relative bg-[var(--accent-soft)]/55"
                              : "relative bg-[var(--paper)]",
                        ].join(" ")}
                      >
                        {day !== null ? (
                          <div
                            onClick={() =>
                              dayEvents.length && key && setDayPanelKey(key)
                            }
                            className={[
                              "flex h-full min-h-[8.5rem] w-full flex-col p-1.5 text-left transition sm:min-h-[11rem] sm:p-2",
                              dayEvents.length
                                ? "cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]/30"
                                : "cursor-default",
                            ].join(" ")}
                          >
                            <div className="mb-1.5 flex shrink-0 items-center justify-end gap-1">
                              {cellIsToday ? (
                                <span className="bg-[var(--surface)] px-1.5 py-px text-[8px] font-semibold uppercase tracking-wide text-[var(--accent-ink)] sm:text-[9px]">
                                  Today
                                </span>
                              ) : null}
                              <span
                                className={[
                                  "text-xs font-semibold tabular-nums",
                                  dayWhen === "past"
                                    ? "text-[var(--muted)]/70"
                                    : "text-[var(--ink)]",
                                ].join(" ")}
                              >
                                {day}
                              </span>
                            </div>
                            <div className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-hidden">
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
                                      "group relative w-full rounded-md border border-[var(--line)] bg-[var(--surface)] px-1.5 py-1.5 text-left shadow-[0_1px_2px_rgba(17,17,17,0.06)] transition hover:border-[var(--ink)]/25 hover:shadow-[0_2px_6px_rgba(17,17,17,0.08)]",
                                      evWhen === "past" ? "opacity-75" : "",
                                      eventWhenChipClasses(evWhen),
                                    ].join(" ")}
                                  >
                                    <div className="flex items-start gap-1">
                                      <FormatGlyph format={ev.format} />
                                      <div className="min-w-0 flex-1">
                                        <p className="line-clamp-2 text-[11px] font-semibold leading-snug text-[var(--ink)] sm:text-xs">
                                          {ev.title}
                                        </p>
                                        <span
                                          className={[
                                            "mt-1 inline-block max-w-full truncate rounded-full border px-1.5 py-px text-[9px] font-medium sm:text-[10px]",
                                            CATEGORY_TAG_STYLES[ev.category].tag,
                                          ].join(" ")}
                                        >
                                          {CATEGORY_LABELS[ev.category]}
                                        </span>
                                      </div>
                                    </div>
                                    {evWhen === "past" ? (
                                      <span className="pointer-events-none absolute right-1 top-1 hidden rounded bg-[var(--ink)]/80 px-1 py-px text-[8px] font-semibold uppercase tracking-wide text-[var(--surface)] group-hover:inline">
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
                                  className="mt-0.5 text-left text-[10px] font-medium text-[var(--accent)] underline-offset-2 hover:underline sm:text-xs"
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
                        "flex w-full min-h-12 flex-col gap-2 px-1 text-left transition hover:bg-[var(--accent-soft)]/40 sm:flex-row sm:items-start sm:justify-between sm:gap-4",
                        eventWhenItemClasses(evWhen),
                        evWhen === "today"
                          ? "ring-1 ring-[var(--accent)]/20 ring-inset"
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
                          {priceSummary(ev)}
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
          onEnrich={(patch) => {
            setRsvpEnrichments((prev) => ({
              ...prev,
              [detail.id]: { ...prev[detail.id], ...patch },
            }));
            setDetail((prev) =>
              prev ? enrichEventAccessFromCopy({ ...prev, ...patch }) : prev,
            );
          }}
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
                        ? "bg-[var(--accent-soft)] px-1.5 py-px text-[9px] font-semibold uppercase tracking-wide text-[var(--accent-ink)]"
                        : "rounded-full bg-stone-200/90 px-1.5 py-px text-[9px] font-semibold uppercase tracking-wide text-stone-600 dark:bg-stone-700/90 dark:text-stone-300"
                    }
                  />
                ) : null}
              </div>
              <span className="font-serif text-sm font-semibold text-stone-900 dark:text-stone-50">
                {ev.title}
              </span>
              <span className="text-xs text-stone-500">
                {formatEventWhen(ev, city)} · {priceSummary(ev)}
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

function FilterCheckbox({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-sm text-[var(--ink)]">
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="h-4 w-4 shrink-0 accent-[var(--accent)]"
      />
      <span>{label}</span>
    </label>
  );
}

function locationSummary(event: WorkshopEvent): string {
  const venue = stripHtmlAndDecode(event.venue ?? "")
    .replace(/\s+/g, " ")
    .trim();
  const address = stripHtmlAndDecode(event.address ?? "")
    .replace(/\s+/g, " ")
    .trim();
  const neighborhood = stripHtmlAndDecode(event.neighborhood ?? "")
    .replace(/\s+/g, " ")
    .trim();

  if (event.format === "virtual") {
    const label = event.virtualLabel?.trim();
    if (!label) return "Virtual";
    if (/^zoom$/i.test(label) || /\bon\s+zoom\b/i.test(label)) {
      return "Virtual on Zoom";
    }
    if (/^virtual\b/i.test(label)) return label;
    return `Virtual (${label})`;
  }
  if (event.format === "hybrid") {
    const online = event.virtualLabel ?? "Online";
    const place = venue
      ? `${venue}${address && !venue.includes(address) ? `, ${address}` : ""}`
      : "In-person location TBA";
    return `${online} · ${place}`;
  }
  if (venue) {
    // Writer's Center (and similar) already bake street/city into venue as
    // "Name · 4508 Walsh Street, Bethesda, MD, 20815" — don't append again.
    if (venue.includes("·") && /\d/.test(venue)) {
      return venue;
    }
    const addressPart =
      address && !venue.includes(address) ? ` — ${address}` : "";
    const neighborhoodPart =
      neighborhood &&
      !venue.toLowerCase().includes(neighborhood.toLowerCase())
        ? ` (${neighborhood})`
        : "";
    return `${venue}${addressPart}${neighborhoodPart}`;
  }
  return "Venue to be announced";
}

function priceSummary(event: WorkshopEvent): string {
  const enriched = enrichEventAccessFromCopy(event);
  if (enriched.priceDetail?.trim()) return enriched.priceDetail.trim();
  return PRICE_LABELS[enriched.price];
}

function EventDetailModal({
  event,
  city,
  onClose,
  onEnrich,
}: {
  event: WorkshopEvent;
  city: City;
  onClose: () => void;
  onEnrich?: (patch: {
    description?: string;
    price?: PriceKind;
    priceDetail?: string;
  }) => void;
}) {
  useEscapeKey(onClose);

  const isSample = event.listingProvenance === "sample";
  const whenStatus = eventWhenStatus(event);

  useEffect(() => {
    const url = event.rsvpUrl?.trim();
    if (!url || event.rsvpIsGeneralCalendar) return;
    if (
      !isSparseEventDescription(event.description) &&
      event.price !== "unknown" &&
      event.priceDetail
    ) {
      return;
    }

    const ac = new AbortController();
    (async () => {
      try {
        const res = await fetch(
          `/api/event-page-enrich?url=${encodeURIComponent(url)}`,
          { signal: ac.signal, headers: { Accept: "application/json" } },
        );
        if (!res.ok) return;
        const parsed = (await res.json()) as {
          description?: string;
          price?: PriceKind;
          priceDetail?: string;
        };
        const patch: {
          description?: string;
          price?: PriceKind;
          priceDetail?: string;
        } = {};
        if (
          parsed.description &&
          isSparseEventDescription(event.description) &&
          parsed.description.length > (event.description?.length ?? 0)
        ) {
          patch.description = parsed.description;
        }
        if (parsed.price && event.price === "unknown") {
          patch.price = parsed.price;
        }
        if (parsed.priceDetail && !event.priceDetail) {
          patch.priceDetail = parsed.priceDetail;
          if (parsed.price) patch.price = parsed.price;
        }
        if (patch.description || patch.price || patch.priceDetail) onEnrich?.(patch);
      } catch (e) {
        if ((e as Error).name === "AbortError") return;
      }
    })();
    return () => ac.abort();
    // Intentionally omit onEnrich — parent passes an inline callback.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    event.id,
    event.rsvpUrl,
    event.rsvpIsGeneralCalendar,
    event.description,
    event.price,
    event.priceDetail,
  ]);

  const aboutText = polishAboutText(
    /<[a-z]/i.test(event.description)
      ? stripHtmlAndDecode(event.description)
      : event.description,
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="event-detail-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-[var(--ink)]/45 backdrop-blur-[2px]"
        aria-label="Close"
        onClick={onClose}
      />
      <div className="relative z-10 max-h-[min(92vh,900px)] w-full max-w-lg overflow-y-auto border border-[var(--line)] bg-[var(--surface)] sm:rounded-none">
        <div className="border-b border-[var(--line)] px-6 pb-5 pt-6">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
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
                className="mt-3 font-serif text-2xl font-medium leading-snug tracking-tight text-[var(--ink)] sm:text-3xl"
              >
                {event.title}
              </h2>
              <p className="mt-3 text-base leading-relaxed text-[var(--muted)]">
                {event.tagline}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="shrink-0 border border-[var(--line)] px-2.5 py-1.5 text-sm text-[var(--muted)] hover:bg-[var(--paper)] hover:text-[var(--ink)]"
            >
              Close
            </button>
          </div>
        </div>

        <div className="space-y-6 px-6 py-6">
          {isSample ? (
            <div
              role="status"
              className="border border-[var(--accent)]/25 bg-[var(--accent-soft)] px-3 py-2.5 text-sm text-[var(--accent-ink)]"
            >
              <strong>Demo listing</strong> — not synced from a live source. Do
              not treat dates or venues as real.
            </div>
          ) : null}

          <div>
            <p className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
              Date &amp; time
            </p>
            <p className="mt-2 text-sm leading-relaxed text-[var(--ink)]">
              {formatEventDateTimeDetail(event, city)}
            </p>
          </div>

          <div>
            <p className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
              Price
            </p>
            <p className="mt-2 text-sm leading-relaxed text-[var(--ink)]">
              {priceSummary(event)}
            </p>
          </div>

          <div>
            <p className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
              Location
            </p>
            <p className="mt-2 text-sm leading-relaxed text-[var(--ink)]">
              {locationSummary(event)}
            </p>
          </div>

          <div>
            <p className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
              About
            </p>
            <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-[var(--muted)]">
              {aboutText}
            </p>
          </div>

          <div>
            <p className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
              Organizer
            </p>
            <p className="mt-2 text-sm font-medium text-[var(--ink)]">
              {event.organizer}
            </p>
          </div>

          {event.rsvpUrl ? (
            <div className="space-y-2">
              {event.rsvpIsGeneralCalendar ? (
                <p className="text-sm text-[var(--muted)]">
                  No direct link to this event — the full events list is here:
                </p>
              ) : null}
              <a
                href={event.rsvpUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-12 w-full items-center justify-center bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-[var(--surface)] transition hover:bg-[var(--accent-ink)]"
              >
                {event.rsvpIsGeneralCalendar
                  ? "View full events calendar"
                  : "RSVP / Learn more"}
              </a>
            </div>
          ) : (
            <p className="text-sm text-[var(--muted)]">
              No direct link on file — visit the organizer&apos;s site.
            </p>
          )}

        </div>
      </div>
    </div>
  );
}
