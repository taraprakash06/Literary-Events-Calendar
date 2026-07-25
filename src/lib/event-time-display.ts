import { DateTime } from "luxon";
import type { City, WorkshopEvent } from "@/lib/workshop-types";

/** Prefer stable regional labels (ET/PT) over seasonal EDT/PDT. */
const IANA_TO_ABBR: Record<string, string> = {
  "America/New_York": "ET",
  "America/Detroit": "ET",
  "America/Toronto": "ET",
  "America/Chicago": "CT",
  "America/Mexico_City": "CT",
  "America/Denver": "MT",
  "America/Phoenix": "MST",
  "America/Los_Angeles": "PT",
  "America/Vancouver": "PT",
  "Pacific/Honolulu": "HT",
  "Europe/London": "UK",
  "Europe/Dublin": "IST",
  "Europe/Paris": "CET",
  "Europe/Berlin": "CET",
  "UTC": "UTC",
};

export function timezoneAbbreviation(
  iana: string,
  at: DateTime = DateTime.now(),
): string {
  const mapped = IANA_TO_ABBR[iana];
  if (mapped === "UK") {
    // BST in summer, GMT in winter
    const zoned = at.setZone(iana);
    return zoned.isInDST ? "BST" : "GMT";
  }
  if (mapped) return mapped;
  const zoned = at.setZone(iana);
  if (!zoned.isValid) return iana;
  return zoned.offsetNameShort || zoned.toFormat("ZZZZ") || iana;
}

export function eventDisplayZone(
  ev: Pick<WorkshopEvent, "start" | "timeZone" | "format">,
  city: City,
): string {
  const organizerZone = ev.timeZone?.trim() || null;
  const isRemote = ev.format === "virtual" || ev.format === "hybrid";

  if (isRemote) {
    return organizerZone ?? city.timeZone;
  }

  // Multi-zone regions (e.g. Tennessee): keep each venue's local zone.
  if (city.multiTimeZone) {
    return organizerZone ?? city.timeZone;
  }

  return city.timeZone;
}

export function shouldShowTimezoneAbbr(
  ev: Pick<WorkshopEvent, "format">,
  city: City,
): boolean {
  if (ev.format === "virtual" || ev.format === "hybrid") return true;
  return Boolean(city.multiTimeZone);
}

export function eventDisplayDateTime(
  ev: Pick<WorkshopEvent, "start" | "end" | "timeZone" | "format">,
  city: City,
): { start: DateTime; end: DateTime | null; zone: string; showAbbr: boolean } {
  const zone = eventDisplayZone(ev, city);
  const startRaw = DateTime.fromISO(ev.start, { setZone: true });
  const start = startRaw.isValid ? startRaw.setZone(zone) : startRaw;
  const end = ev.end
    ? (() => {
        const endRaw = DateTime.fromISO(ev.end, { setZone: true });
        return endRaw.isValid ? endRaw.setZone(zone) : endRaw;
      })()
    : null;
  return {
    start,
    end,
    zone,
    showAbbr: shouldShowTimezoneAbbr(ev, city),
  };
}

function appendAbbr(label: string, zone: string, showAbbr: boolean, at: DateTime): string {
  if (!showAbbr) return label;
  return `${label} ${timezoneAbbreviation(zone, at)}`;
}

/** Compact list/chip style: "Wed, Jul 25, 1:30 PM ET" */
export function formatEventWhen(ev: WorkshopEvent, city: City): string {
  const { start, zone, showAbbr } = eventDisplayDateTime(ev, city);
  if (!start.isValid) return new Date(ev.start).toLocaleString("en-US");
  const base = start.toFormat("ccc, LLL d, h:mm a");
  return appendAbbr(base, zone, showAbbr, start);
}

/** Weekly picks style: "Wed, Jul 25 · 1:30 PM ET" */
export function formatEventWhenCompact(ev: WorkshopEvent, city: City): string {
  const { start, zone, showAbbr } = eventDisplayDateTime(ev, city);
  if (!start.isValid) return "";
  const base = start.toFormat("ccc, LLL d · h:mm a");
  return appendAbbr(base, zone, showAbbr, start);
}

/** Detail modal style. */
export function formatEventDateTimeDetail(ev: WorkshopEvent, city: City): string {
  const { start, end, zone, showAbbr } = eventDisplayDateTime(ev, city);
  if (!start.isValid) {
    return new Date(ev.start).toLocaleString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  }

  let label = start.toFormat("cccc, LLLL d, yyyy 'at' h:mm a");
  if (end?.isValid) {
    label += ` · ends ${end.toFormat("h:mm a")}`;
  }
  return appendAbbr(label, zone, showAbbr, start);
}

export function cityTimeNote(city: City): string {
  if (city.multiTimeZone) {
    return "Tennessee spans Eastern and Central Time — each event shows its local zone (ET or CT).";
  }
  return "All times shown in the selected area's local time.";
}
