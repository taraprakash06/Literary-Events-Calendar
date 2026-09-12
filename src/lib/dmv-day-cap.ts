import { DateTime } from "luxon";
import type { WorkshopEvent } from "@/lib/workshop-types";

const TZ = "America/New_York";
const MAX_PER_DAY = 5;
const CAP_YEAR = 2026;
const CAP_MONTHS = new Set([8, 9]);

function listingBlob(ev: WorkshopEvent): string {
  return [
    ev.title,
    ev.tagline,
    ev.description,
    ev.organizer,
    ev.venue,
    ev.source,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function localDayKey(ev: WorkshopEvent): string {
  const dt = DateTime.fromISO(ev.start, { setZone: true });
  const zoned = ev.timeZone ? dt.setZone(ev.timeZone) : dt.setZone(TZ);
  if (!zoned.isValid) return (ev.start || "").slice(0, 10);
  return zoned.toFormat("yyyy-LL-dd");
}

function isCappedMonthDay(dayKey: string): boolean {
  const [year, month] = dayKey.split("-").map(Number);
  return year === CAP_YEAR && CAP_MONTHS.has(month);
}

function normalizeTitleKey(title: string): string {
  let t = title.toLowerCase();
  t = t.replace(
    /\s*[-–—|:]\s*(in-?person|virtual|hybrid|online).*$/i,
    "",
  );
  t = t.replace(/[^a-z0-9]+/g, " ");
  t = t.replace(/\b(the|a|an|at|with|in|for|and)\b/g, " ");
  t = t.replace(/\s+/g, " ").trim();
  if (/write to right/.test(t)) return "write to right";
  if (/paletero/.test(t)) return "paletero man";
  if (/little falls literary salon/.test(t)) return "little falls salon";
  return t;
}

function isSlam(title: string): boolean {
  return /\bslam\b/i.test(title);
}

function isWeeklyOpenMic(title: string): boolean {
  if (isSlam(title)) return false;
  return (
    /\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\s+night open mic\b/i.test(
      title,
    ) || /\bopen mic hosted by\b/i.test(title)
  );
}

function hasNamedGuest(title: string): boolean {
  return (
    /\b(w\/|with)\s+[A-Z][A-Za-z.''-]+/.test(title) ||
    /\bpresents\b/i.test(title) ||
    /\bin conversation\b/i.test(title) ||
    /\bauthor talk\b/i.test(title) ||
    /\bbook (launch|release)\b/i.test(title)
  );
}

function isGenericBookClub(title: string): boolean {
  if (hasNamedGuest(title)) return false;
  if (/\b(author|poet|book launch|book release|in conversation)\b/i.test(title)) {
    return false;
  }
  return /\b(book (discussion|clubs?|talks?|group)|page turners|no pressure book|never-ending tbr|what have you read lately|novel views|tales of yesterday|book clubs for kids|my first book club|middle school book club|book crew|wild readers|cover to cover|no shelf control|silent book club)\b/i.test(
    title,
  );
}

function isDropInWritingSpace(title: string): boolean {
  return /writing space/i.test(title) || /free write meetup/i.test(title);
}

function isRetailOrTrivia(title: string): boolean {
  return /\b(wine wednesday|sales tax holiday|crafting club|trivia|bookstore romance day)\b/i.test(
    title,
  );
}

function isNonLiteraryFiller(title: string): boolean {
  return /\b(socrates cafe|sat strategies|1600-scorer|art discussion group|mini jewish film|from script to screen|documentary filmmaking|application story lab|info session)\b/i.test(
    title,
  );
}

function isLowValueFiller(ev: WorkshopEvent): boolean {
  const title = ev.title;
  return (
    isRetailOrTrivia(title) ||
    isDropInWritingSpace(title) ||
    isNonLiteraryFiller(title) ||
    /hosted by hosted by/i.test(title)
  );
}

function isWritersCenter(ev: WorkshopEvent): boolean {
  return /writer'?s center/i.test(listingBlob(ev));
}

function organizerKey(ev: WorkshopEvent): string {
  return (ev.organizer || ev.source || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function eventKey(ev: WorkshopEvent): string {
  return `${ev.id}::${ev.start}`;
}

/** Higher = more worth keeping on a crowded DMV day. */
export function dmvEventPriorityScore(ev: WorkshopEvent): number {
  const title = ev.title;
  const blob = listingBlob(ev);
  let score = 30;

  if (/dmv curated/i.test(ev.source ?? "")) score += 55;
  if (/st\.? john'?s|maryland hall|writers'? roundtable/i.test(blob)) score += 40;
  if (/politics and prose/i.test(blob)) score += 38;
  if (/planet word/i.test(blob)) score += 32;
  if (
    /maryland humanities|one maryland one book|great reads from great places/i.test(
      blob,
    )
  ) {
    score += 28;
  }
  if (/scrawl books/i.test(blob) && ev.category === "reading") score += 22;
  if (isWritersCenter(ev)) score += 16;
  if (/busboys/i.test(blob) && ev.category === "reading") score += 26;
  if (
    /dc public library/i.test(blob) &&
    /author|presents|book talk/i.test(title)
  ) {
    score += 24;
  }
  if (/write to right/i.test(blob)) score += 22;

  if (ev.category === "reading") score += 10;
  if (ev.category === "open-mic") score += 12;
  if (ev.category === "workshop") score += 8;

  if (hasNamedGuest(title)) score += 22;
  if (/\b(poetry|poem|poet|open mic|slam)\b/i.test(title)) score += 10;
  if (/\b(writing workshop|writers? group|teen writ)/i.test(title)) score += 10;
  if (isSlam(title)) score += 18;

  if (isWeeklyOpenMic(title)) score -= 6;
  if (isGenericBookClub(title)) score -= 36;
  if (isDropInWritingSpace(title)) score -= 42;
  if (isRetailOrTrivia(title)) score -= 50;
  if (isNonLiteraryFiller(title)) score -= 48;
  if (/hosted by hosted by/i.test(title)) score -= 50;
  if (!ev.rsvpUrl) score -= 4;
  if ((ev.description?.length ?? 0) < 50) score -= 6;
  if (ev.format === "virtual" && isGenericBookClub(title)) score -= 6;

  return score;
}

function dedupeDay(events: WorkshopEvent[]): WorkshopEvent[] {
  const best = new Map<string, WorkshopEvent>();
  for (const ev of events) {
    const key = normalizeTitleKey(ev.title);
    const prev = best.get(key);
    if (!prev || dmvEventPriorityScore(ev) > dmvEventPriorityScore(prev)) {
      best.set(key, ev);
    }
  }
  return [...best.values()];
}

function pickBestFive(events: WorkshopEvent[]): WorkshopEvent[] {
  const ranked = dedupeDay(events).sort((a, b) => {
    const delta = dmvEventPriorityScore(b) - dmvEventPriorityScore(a);
    if (delta !== 0) return delta;
    return a.start.localeCompare(b.start) || a.title.localeCompare(b.title);
  });

  const chosen: WorkshopEvent[] = [];
  const used = new Set<string>();
  let bookClubs = 0;
  let weeklyMics = 0;
  let twcWorkshops = 0;
  const byOrganizer = new Map<string, number>();

  const tryAdd = (
    ev: WorkshopEvent,
    opts: { capClubs: boolean; capWeeklyMics: boolean; capTwc: boolean },
  ): boolean => {
    if (chosen.length >= MAX_PER_DAY) return false;
    if (isLowValueFiller(ev)) return false;
    const key = eventKey(ev);
    if (used.has(key)) return false;

    const club = isGenericBookClub(ev.title);
    const weeklyMic = isWeeklyOpenMic(ev.title);
    const twcWorkshop = isWritersCenter(ev) && ev.category === "workshop";
    const org = organizerKey(ev);

    if (opts.capClubs && club && bookClubs >= 1) return false;
    if (opts.capWeeklyMics && weeklyMic && weeklyMics >= 1) return false;
    if (opts.capTwc && twcWorkshop && twcWorkshops >= 2) return false;
    if ((byOrganizer.get(org) ?? 0) >= 4) return false;

    chosen.push(ev);
    used.add(key);
    byOrganizer.set(org, (byOrganizer.get(org) ?? 0) + 1);
    if (club) bookClubs += 1;
    if (weeklyMic) weeklyMics += 1;
    if (twcWorkshop) twcWorkshops += 1;
    return true;
  };

  const strict = { capClubs: true, capWeeklyMics: true, capTwc: true };
  for (const ev of ranked) tryAdd(ev, strict);

  // Fill remaining slots with the next-best literary listings, including a
  // second book club if needed — never with drop-ins, retail, or info sessions.
  if (chosen.length < MAX_PER_DAY) {
    const fill = { capClubs: false, capWeeklyMics: true, capTwc: false };
    for (const ev of ranked) tryAdd(ev, fill);
  }

  return chosen.slice(0, MAX_PER_DAY);
}

/**
 * For August–September 2026 DMV days with more than five listings, keep the
 * five strongest literary events and drop the rest.
 */
export function capDmvCrowdedDays(events: WorkshopEvent[]): WorkshopEvent[] {
  const byDay = new Map<string, WorkshopEvent[]>();
  const passthrough: WorkshopEvent[] = [];

  for (const ev of events) {
    const key = localDayKey(ev);
    if (!isCappedMonthDay(key)) {
      passthrough.push(ev);
      continue;
    }
    const list = byDay.get(key) ?? [];
    list.push(ev);
    byDay.set(key, list);
  }

  const kept = new Set<WorkshopEvent>(passthrough);
  for (const list of byDay.values()) {
    const selected = list.length <= MAX_PER_DAY ? list : pickBestFive(list);
    for (const ev of selected) kept.add(ev);
  }

  return events.filter((ev) => kept.has(ev));
}
