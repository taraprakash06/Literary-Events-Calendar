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
