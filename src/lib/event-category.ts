import type { WorkshopEvent, WorkshopEventCategory } from "@/lib/workshop-types";

/** LibNet / library calendar tags for staged performances. */
export function isLibNetTheaterTags(tags: string[] | undefined): boolean {
  const t = new Set((tags ?? []).map((x) => x.toLowerCase()));
  return t.has("theater") || t.has("theatre");
}

/**
 * True when text describes a staged performance (not literary programming).
 * Keeps poetry readings, open mics, and author events at theater venues.
 */
export function isTheaterEventText(...parts: (string | undefined)[]): boolean {
  const b = parts.filter(Boolean).join(" ").toLowerCase();
  if (!b.trim()) return false;

  if (
    /\b(poetry reading|open mic|book club|author talk|writing workshop|literary|spoken word|read-?a-?loud)\b/.test(
      b,
    )
  ) {
    return false;
  }

  return (
    /\b(theater|theatre|theatrical)\b/.test(b) ||
    /\b(broadway|off-?broadway|musical|opera|ballet|cabaret)\b/.test(b) ||
    /\b(stage play|live theater|community theater|children'?s theater)\b/.test(b) ||
    /\b(one-?act|two-?act|full-?length play)\b/.test(b) ||
    (/\bplay\b/.test(b) &&
      !/\b(play group|playtime|role.?play|playlist|display|play chess|play games)\b/.test(
        b,
      ))
  );
}

export function isTheaterWorkshopEvent(ev: WorkshopEvent): boolean {
  return isTheaterEventText(ev.title, ev.tagline, ev.description, ev.organizer);
}

/**
 * True when the event is solely visual-art programming (exhibitions, studio
 * crafts, gallery openings) with no literary / writing signal.
 */
export function isVisualArtOnlyEventText(
  ...parts: (string | undefined)[]
): boolean {
  const b = parts.filter(Boolean).join(" ").toLowerCase();
  if (!b.trim()) return false;

  if (
    /\b(book|author|poet|poetry|writer|writing|literary|open\s*mic|memoir|novel|essay|fiction|zine|spoken\s*word|slam|manuscript|publish|storytime|story\s*time|reading group|book club|creative writing|letterpress)\b/.test(
      b,
    )
  ) {
    return false;
  }

  return (
    /\b(artomatic|art\s+all\s+night|visual\s+arts?|fine\s+arts?)\b/.test(b) ||
    /\b(art\s+(exhibition|show|opening|walk|fair|gallery|reception|market))\b/.test(
      b,
    ) ||
    /\b(gallery\s+opening|photography\s+exhibit|photo\s+exhibit)\b/.test(b) ||
    /\b(watercolor|ceramics?|pottery|sculpture|printmaking)\b/.test(b) ||
    /\b(painting|drawing)\s+(workshop|class|studio)\b/.test(b) ||
    /\bartist\s+(talk|meet|meeting|reception|demo|demonstration)\b/.test(b) ||
    (/\bexhibition\b/.test(b) && /\b(art|artist|gallery|painter|painting)\b/.test(b))
  );
}

export function isVisualArtOnlyWorkshopEvent(ev: WorkshopEvent): boolean {
  return isVisualArtOnlyEventText(
    ev.title,
    ev.tagline,
    ev.description,
    ev.organizer,
    ev.venue,
    ev.category,
  );
}

/**
 * True when the event is film/cinema programming (screenings, filmmaker panels)
 * with no literary / writing signal. Keeps book–film hybrids and author events.
 */
export function isFilmOnlyEventText(
  ...parts: (string | undefined)[]
): boolean {
  const b = parts.filter(Boolean).join(" ").toLowerCase();
  if (!b.trim()) return false;

  if (
    /\b(book|author|poet|poetry|writer|writing|literary|open\s*mic|memoir|novel|essay|fiction|zine|spoken\s*word|slam|manuscript|publish|storytime|story\s*time|reading group|book club|creative writing|graphic novel)\b/.test(
      b,
    )
  ) {
    return false;
  }

  return (
    /\bfilm\s*screening\b/.test(b) ||
    /\bfilmmaker\b/.test(b) ||
    /\b(movie|cinema)\s+(screening|night|panel)\b/.test(b) ||
    (/\bfilm\b/.test(b) &&
      /\b(panel|screening|festival|premiere|documentary)\b/.test(b))
  );
}

export function isFilmOnlyWorkshopEvent(ev: WorkshopEvent): boolean {
  return isFilmOnlyEventText(
    ev.title,
    ev.tagline,
    ev.description,
    ev.organizer,
    ev.venue,
    ev.category,
  );
}

/** Map title + optional context strings to one of four calendar categories. */
export function inferEventCategory(
  title: string,
  ...context: (string | undefined)[]
): WorkshopEventCategory {
  const b = [title, ...context].filter(Boolean).join(" ").toLowerCase();

  if (/\bopen\s*mic\b|\bpoetry slam\b/.test(b)) return "open-mic";
  if (
    /\b(workshops?|writing class|write-?in|writers?\s+group|creative writing|course|retreat|songwriting)\b/.test(
      b,
    )
  ) {
    return "workshop";
  }
  if (
    /\b(reading|book club|author talk|book signing|story\s*time|poetry reading|memoir reading|reads aloud|read aloud|storytime|book launch|launch party|debut)\b/.test(
      b,
    )
  ) {
    return "reading";
  }
  return "other";
}
