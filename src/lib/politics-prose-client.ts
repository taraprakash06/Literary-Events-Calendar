/**
 * Politics and Prose embeds FullCalendar event data in the monthly calendar page
 * (`/events/calendar/{year}/{month}`) inside Drupal `drupalSettings.fullCalendarView`.
 * Source aligned with their public listings:
 * https://politics-prose.com/upcoming-events
 */

export const POLITICS_PROSE_ORIGIN = "https://politics-prose.com";

export type PnpFullCalendarEvent = {
  title?: string;
  start?: string;
  end?: string;
  url?: string;
  eid?: string;
  des?: string;
  allDay?: boolean;
};

function extractDrupalSettingsJson(html: string): unknown | null {
  const m = html.match(
    /<script type="application\/json" data-drupal-selector="drupal-settings-json">([\s\S]*?)<\/script>/,
  );
  if (!m) return null;
  try {
    return JSON.parse(m[1]) as unknown;
  } catch {
    return null;
  }
}

/**
 * Fetches the public month calendar HTML and returns FullCalendar `events` entries.
 */
export async function fetchPoliticsProseCalendarEvents(
  year: number,
  monthIndex: number,
  signal?: AbortSignal,
): Promise<PnpFullCalendarEvent[]> {
  const month = String(monthIndex + 1).padStart(2, "0");
  const url = `${POLITICS_PROSE_ORIGIN}/events/calendar/${year}/${month}`;
  const res = await fetch(url, {
    signal,
    headers: {
      Accept: "text/html",
      "User-Agent": "calendar_literary/1.0 (events aggregation)",
    },
    next: { revalidate: 600 },
  });
  if (!res.ok) {
    throw new Error(`Politics and Prose calendar HTTP ${res.status}`);
  }
  const html = await res.text();
  const settings = extractDrupalSettingsJson(html);
  if (!settings || typeof settings !== "object") {
    throw new Error("Politics and Prose: could not parse drupalSettings JSON");
  }
  const fcv = (settings as { fullCalendarView?: unknown }).fullCalendarView;
  if (!Array.isArray(fcv) || fcv.length === 0) {
    return [];
  }
  const first = fcv[0] as { calendar_options?: string };
  if (!first.calendar_options || typeof first.calendar_options !== "string") {
    return [];
  }
  let calendarOpts: { events?: PnpFullCalendarEvent[] };
  try {
    calendarOpts = JSON.parse(first.calendar_options) as {
      events?: PnpFullCalendarEvent[];
    };
  } catch {
    throw new Error("Politics and Prose: could not parse calendar_options JSON");
  }
  return Array.isArray(calendarOpts.events) ? calendarOpts.events : [];
}
