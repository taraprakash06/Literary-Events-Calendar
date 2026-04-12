/**
 * Ingestion channel definitions + env-based configuration checks.
 */

import type { SourceChannel } from "@/lib/workshop-types";

export type ConnectorStatus = {
  id: SourceChannel;
  title: string;
  blurb: string;
  envKeys: string[];
  allRequired?: boolean;
  configured: boolean;
  detail: string;
};

function envSet(name: string): boolean {
  const v = process.env[name];
  return typeof v === "string" && v.trim().length > 0;
}

function anyEnv(keys: string[]): boolean {
  return keys.some(envSet);
}

function allEnv(keys: string[]): boolean {
  return keys.length > 0 && keys.every(envSet);
}

const DEFINITIONS: Omit<ConnectorStatus, "configured" | "detail">[] = [
  {
    id: "eventbrite",
    title: "Eventbrite",
    blurb: "Private token for /users/me/owned_events; optional EVENTBRITE_ORGANIZATION_IDS for org feeds.",
    envKeys: ["EVENTBRITE_API_TOKEN", "EVENTBRITE_OAUTH_TOKEN"],
  },
  {
    id: "google_public",
    title: "Google public / community events",
    blurb: "Published calendars, venue feeds, or Programmable Search for curated pages.",
    envKeys: [
      "GOOGLE_CALENDAR_FEED_URLS",
      "GOOGLE_CUSTOM_SEARCH_JSON_API_KEY",
      "GOOGLE_PUBLIC_EVENTS_PAGE_URLS",
    ],
  },
  {
    id: "library",
    title: "Public library calendars",
    blurb: "iCal / ICS or stable RSS from library branches.",
    envKeys: ["PUBLIC_LIBRARY_ICAL_URLS", "PUBLIC_LIBRARY_RSS_URLS"],
  },
  {
    id: "literary_org",
    title: "Literary organizations",
    blurb: "Member orgs, residencies, and workshop series (RSS or partner API).",
    envKeys: ["LITERARY_ORG_RSS_URLS", "LITERARY_ORG_API_BASE_URL"],
  },
  {
    id: "theater_arts",
    title: "Theater & arts venues",
    blurb: "Venue calendars, arts council listings, or partner feeds.",
    envKeys: ["THEATER_ICAL_URLS", "THEATER_RSS_URLS"],
  },
  {
    id: "bookstore",
    title: "Bookstore calendars",
    blurb: "Indie chains and local shops with public calendars.",
    envKeys: ["BOOKSTORE_ICAL_URLS", "BOOKSTORE_EVENT_PAGE_URLS"],
  },
  {
    id: "news_roundup",
    title: "News & arts roundups",
    blurb: "Weekly columns and city guides via RSS.",
    envKeys: ["NEWS_ARTS_RSS_URLS"],
  },
  {
    id: "instagram",
    title: "Instagram-linked public events",
    blurb: "Meta Graph API or manually curated links when API access is limited.",
    envKeys: ["INSTAGRAM_GRAPH_USER_ACCESS_TOKEN", "INSTAGRAM_CURATED_EVENT_URLS"],
  },
];

export function getIngestionConnectorStatuses(): ConnectorStatus[] {
  return DEFINITIONS.map((d) => {
    const configured = d.allRequired
      ? allEnv(d.envKeys)
      : anyEnv(d.envKeys);
    const detail = configured
      ? "Environment variables detected for this path."
      : `Set one of: ${d.envKeys.join(", ")}`;
    return { ...d, configured, detail };
  });
}

export const SOURCE_CHANNEL_LABELS: Record<SourceChannel, string> = {
  eventbrite: "Eventbrite",
  google_public: "Google public / community events",
  library: "Public library calendars",
  literary_org: "Literary organizations",
  theater_arts: "Theater & arts websites",
  bookstore: "Bookstore calendars",
  news_roundup: "News & arts roundups",
  instagram: "Instagram-linked public events",
};
