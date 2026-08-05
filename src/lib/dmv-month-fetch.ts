import type { WorkshopEvent } from "@/lib/workshop-types";

export type DmvMonthSources = {
  libnet: WorkshopEvent[];
  writersCenter: WorkshopEvent[];
  politicsProse: WorkshopEvent[];
  scrawlBooks: WorkshopEvent[];
  busboysPoets: WorkshopEvent[];
  mdHumanities: WorkshopEvent[];
  planetWord: WorkshopEvent[];
  writeToRight: WorkshopEvent[];
  dcArtAllNight: WorkshopEvent[];
  dmvCurated: WorkshopEvent[];
  eventbrite: WorkshopEvent[];
};

export function emptyDmvMonthSources(): DmvMonthSources {
  return {
    libnet: [],
    writersCenter: [],
    politicsProse: [],
    scrawlBooks: [],
    busboysPoets: [],
    mdHumanities: [],
    planetWord: [],
    writeToRight: [],
    dcArtAllNight: [],
    dmvCurated: [],
    eventbrite: [],
  };
}

export function flattenDmvMonthSources(s: DmvMonthSources): WorkshopEvent[] {
  return [
    ...s.libnet,
    ...s.writersCenter,
    ...s.politicsProse,
    ...s.scrawlBooks,
    ...s.busboysPoets,
    ...s.mdHumanities,
    ...s.planetWord,
    ...s.writeToRight,
    ...s.dcArtAllNight,
    ...s.dmvCurated,
    ...s.eventbrite,
  ];
}

async function fetchEventsJson(
  url: string,
  signal?: AbortSignal,
): Promise<WorkshopEvent[]> {
  try {
    const res = await fetch(url, { signal });
    if (!res.ok) return [];
    const body = (await res.json()) as { events?: WorkshopEvent[] };
    return Array.isArray(body.events) ? body.events : [];
  } catch (e) {
    if ((e as Error).name === "AbortError") throw e;
    return [];
  }
}

export type DmvSourceKey = keyof DmvMonthSources;

/**
 * Fetch all DMV month sources, invoking `onPartial` as each completes so the
 * calendar can render before the slowest feed finishes.
 */
export async function fetchDmvMonthSources(
  year: number,
  monthIndex: number,
  opts?: {
    signal?: AbortSignal;
    onPartial?: (key: DmvSourceKey, events: WorkshopEvent[]) => void;
    includeEventbrite?: boolean;
  },
): Promise<DmvMonthSources> {
  const y = year;
  const m = monthIndex + 1;
  const q = `year=${y}&month=${m}&cityId=dmv`;
  const signal = opts?.signal;
  const onPartial = opts?.onPartial;
  const out = emptyDmvMonthSources();

  type Job = { key: DmvSourceKey; url: string; libnetPart?: "dcpl" | "mcpl" };
  const jobs: Job[] = [
    { key: "libnet", libnetPart: "dcpl", url: `/api/dcpl/events?${q}` },
    { key: "libnet", libnetPart: "mcpl", url: `/api/mcpl/events?${q}` },
    { key: "writersCenter", url: `/api/writers-center/events?year=${y}&month=${m}` },
    { key: "politicsProse", url: `/api/politics-prose/events?year=${y}&month=${m}` },
    { key: "scrawlBooks", url: `/api/scrawl-books/events?year=${y}&month=${m}` },
    { key: "busboysPoets", url: `/api/busboys-poets/events?year=${y}&month=${m}` },
    { key: "mdHumanities", url: `/api/mdhumanities/events?year=${y}&month=${m}` },
    { key: "planetWord", url: `/api/planet-word/events?year=${y}&month=${m}` },
    { key: "writeToRight", url: `/api/write-to-right/events?year=${y}&month=${m}` },
    { key: "dcArtAllNight", url: `/api/dc-art-all-night/events?year=${y}&month=${m}` },
    { key: "dmvCurated", url: `/api/dmv-curated/events?year=${y}&month=${m}` },
  ];
  if (opts?.includeEventbrite === true) {
    jobs.push({
      key: "eventbrite",
      url: `/api/eventbrite/events?cityId=dmv&year=${y}&month=${m}`,
    });
  }

  // DCPL + MCPL both write libnet — merge as each arrives.
  let libnetDc: WorkshopEvent[] = [];
  let libnetMc: WorkshopEvent[] = [];

  await Promise.all(
    jobs.map(async (job) => {
      const events = await fetchEventsJson(job.url, signal);
      if (job.libnetPart === "dcpl") {
        libnetDc = events;
        out.libnet = [...libnetDc, ...libnetMc];
        onPartial?.("libnet", out.libnet);
        return;
      }
      if (job.libnetPart === "mcpl") {
        libnetMc = events;
        out.libnet = [...libnetDc, ...libnetMc];
        onPartial?.("libnet", out.libnet);
        return;
      }
      out[job.key] = events;
      onPartial?.(job.key, events);
    }),
  );

  return out;
}

export function monthCacheKey(
  cityId: string,
  year: number,
  monthIndex: number,
): string {
  return `${cityId}:${year}:${monthIndex}`;
}
