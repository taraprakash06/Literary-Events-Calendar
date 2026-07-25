import type { City } from "@/lib/workshop-types";

/**
 * Add cities here as the product grows. `slug` is used in URLs: /[slug]
 */
export const CITIES: City[] = [
  {
    id: "dmv",
    slug: "dmv",
    name: "DMV — DC, Maryland & Virginia (incl. Baltimore)",
    label: "DMV",
    timeZone: "America/New_York",
  },
  {
    id: "nyc",
    slug: "new-york",
    name: "New York, NY",
    label: "New York",
    timeZone: "America/New_York",
  },
  {
    id: "la",
    slug: "los-angeles",
    name: "Los Angeles, CA",
    label: "LA",
    timeZone: "America/Los_Angeles",
  },
  {
    id: "sf",
    slug: "san-francisco",
    name: "San Francisco Bay Area, CA",
    label: "SF",
    timeZone: "America/Los_Angeles",
  },
  {
    id: "tn",
    slug: "tennessee",
    name: "Tennessee",
    label: "TN",
    timeZone: "America/Chicago",
    multiTimeZone: true,
  },
];

const bySlug = new Map(CITIES.map((c) => [c.slug, c] as const));

export function getCityBySlug(slug: string): City | undefined {
  return bySlug.get(slug);
}

export const DEFAULT_CITY_SLUG = "dmv";
