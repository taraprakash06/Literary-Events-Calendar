import { DateTime } from "luxon";
import { inferEventCategory } from "@/lib/event-category";
import type { WorkshopEvent } from "@/lib/workshop-types";
import { stripHtmlAndDecode, toShortOverview } from "@/lib/text";

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

type EbPublicBasicInfo = {
  id?: string;
  name?: string;
  summary?: string;
  url?: string;
  isFree?: boolean;
  startDate?: { timezone?: string; local?: string; utc?: string };
  endDate?: { timezone?: string; local?: string; utc?: string };
  organizer?: { name?: string };
  venue?: {
    name?: string;
    address?: {
      localizedMultiLineAddressDisplay?: string[];
      city?: string;
      region?: string;
    };
  };
};

type EbPublicContext = {
  basicInfo?: EbPublicBasicInfo;
  structuredContent?: {
    modules?: { type?: string; text?: string }[];
  };
};

function parseNextData(html: string): EbPublicContext | null {
  const m = html.match(
    /<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/i,
  );
  if (!m) return null;
  try {
    const data = JSON.parse(m[1]) as {
      props?: { pageProps?: { context?: EbPublicContext } };
    };
    return data.props?.pageProps?.context ?? null;
  } catch {
    return null;
  }
}

function descriptionFromContext(ctx: EbPublicContext): string {
  const modules = ctx.structuredContent?.modules ?? [];
  const html = modules
    .filter((mod) => mod.type === "text" && mod.text)
    .map((mod) => mod.text!)
    .join("\n");
  const plain = stripHtmlAndDecode(html).replace(/\s+/g, " ").trim();
  if (plain) return plain;
  return ctx.basicInfo?.summary?.trim() || "Details on Eventbrite.";
}

export async function fetchEventbritePublicEvent(
  eventUrl: string,
  signal?: AbortSignal,
): Promise<EbPublicContext | null> {
  const res = await fetch(eventUrl, {
    signal,
    headers: {
      Accept: "text/html,application/xhtml+xml",
      "Accept-Language": "en-US,en;q=0.9",
      "User-Agent": UA,
    },
    next: { revalidate: 600 },
  });
  if (!res.ok) {
    throw new Error(`Eventbrite public page HTTP ${res.status}`);
  }
  const html = await res.text();
  return parseNextData(html);
}

export function mapEventbritePublicToWorkshop(
  ctx: EbPublicContext,
  cityId: string,
): WorkshopEvent | null {
  const info = ctx.basicInfo;
  if (!info?.startDate?.local) return null;

  const tz = info.startDate.timezone?.trim() || "America/Los_Angeles";
  const start = DateTime.fromISO(info.startDate.local, { zone: tz });
  if (!start.isValid) return null;

  const end = info.endDate?.local
    ? DateTime.fromISO(info.endDate.local, { zone: tz })
    : start.plus({ hours: 3 });
  const endValid = end.isValid ? end : start.plus({ hours: 3 });

  const title = info.name?.trim() || "Eventbrite event";
  const description = descriptionFromContext(ctx);
  const organizer = info.organizer?.name?.trim() || "Eventbrite organizer";
  const venueName = info.venue?.name?.trim();
  const addressLines = info.venue?.address?.localizedMultiLineAddressDisplay ?? [];
  const address = addressLines.join(", ").trim() || undefined;

  return {
    id: `eventbrite-public-${info.id ?? start.toFormat("yyyyLLdd")}`,
    cityId,
    title,
    tagline: organizer,
    description: toShortOverview(description, 420) || description,
    start: start.toISO() ?? start.toString(),
    end: endValid.toISO() ?? undefined,
    timeZone: tz,
    format: "in-person",
    price: info.isFree ? "free" : "paid",
    category: inferEventCategory(title, description),
    organizer,
    venue: venueName,
    address,
    neighborhood: info.venue?.address?.city?.trim() || undefined,
    rsvpUrl: info.url?.trim() || undefined,
    source: "Eventbrite",
    sourceChannel: "eventbrite",
    listingProvenance: "live",
  };
}

export function eventInMonth(
  startIso: string,
  timeZone: string,
  year: number,
  monthIndex: number,
): boolean {
  const dt = DateTime.fromISO(startIso, { setZone: true }).setZone(timeZone);
  if (!dt.isValid) return false;
  return dt.year === year && dt.month === monthIndex + 1;
}
