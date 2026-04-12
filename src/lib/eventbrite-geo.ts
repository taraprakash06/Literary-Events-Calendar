/**
 * Map Eventbrite venue coordinates or address into app city ids.
 * Baltimore and the DC metro are both `dmv` (Maryland + DC + Northern VA).
 */

export type AppCityId = "dmv" | "nyc" | "la" | "sf";

type Box = { south: number; north: number; west: number; east: number };

/** DMV + Greater Baltimore (Maryland) in one region. */
const DMV: Box = { south: 38.72, north: 39.72, west: -77.72, east: -76.22 };

const NYC: Box = { south: 40.48, north: 40.93, west: -74.28, east: -73.68 };

const LA: Box = { south: 33.55, north: 34.42, west: -118.72, east: -117.88 };

/** Bay Area (SF, East Bay, Peninsula core). */
const SF: Box = { south: 37.15, north: 38.05, west: -122.72, east: -121.88 };

function inBox(lat: number, lng: number, b: Box): boolean {
  return lat >= b.south && lat <= b.north && lng >= b.west && lng <= b.east;
}

const NYC_CITIES = new Set(
  [
    "new york",
    "brooklyn",
    "queens",
    "bronx",
    "staten island",
    "manhattan",
    "flushing",
    "jamaica",
    "long island city",
    "astoria",
    "williamsburg",
    "bushwick",
    "harlem",
    "yonkers",
    "new rochelle",
    "mount vernon",
    "white plains",
    "jersey city",
    "hoboken",
    "newark",
  ].map((s) => s.toLowerCase()),
);

const DMV_MD_CITIES = new Set(
  [
    "baltimore",
    "towson",
    "columbia",
    "silver spring",
    "bethesda",
    "rockville",
    "gaithersburg",
    "germantown",
    "wheaton",
    "takoma park",
    "hyattsville",
    "college park",
    "greenbelt",
    "bowie",
    "laurel",
    "upper marlboro",
    "chevy chase",
    "potomac",
    "kensington",
    "olney",
    "aspen hill",
    "glenmont",
    "white oak",
    "damascus",
    "clarksburg",
    "montgomery village",
    "annapolis",
    "ellicott city",
  ].map((s) => s.toLowerCase()),
);

const DMV_VA_CITIES = new Set(
  [
    "arlington",
    "alexandria",
    "falls church",
    "mclean",
    "tysons",
    "tysons corner",
    "reston",
    "herndon",
    "vienna",
    "fairfax",
    "annandale",
    "springfield",
    "burke",
    "centreville",
    "chantilly",
    "sterling",
    "ashburn",
    "leesburg",
  ].map((s) => s.toLowerCase()),
);

const LA_CITIES = new Set(
  [
    "los angeles",
    "santa monica",
    "pasadena",
    "glendale",
    "burbank",
    "culver city",
    "west hollywood",
    "long beach",
    "torrance",
    "inglewood",
  ].map((s) => s.toLowerCase()),
);

const SF_CITIES = new Set(
  [
    "san francisco",
    "oakland",
    "berkeley",
    "san mateo",
    "palo alto",
    "mountain view",
    "sunnyvale",
    "san jose",
    "redwood city",
    "fremont",
    "hayward",
    "richmond",
    "alameda",
    "daly city",
  ].map((s) => s.toLowerCase()),
);

function normalizeCity(city: string): string {
  return city.trim().toLowerCase();
}

/**
 * Classify from venue lat/lng, else city + region strings.
 * Returns `null` if the event is not in one of the configured regions.
 */
export function classifyEventbriteLocation(input: {
  latitude?: string | number | null;
  longitude?: string | number | null;
  city?: string | null;
  region?: string | null;
}): AppCityId | null {
  const latRaw = input.latitude;
  const lngRaw = input.longitude;
  if (latRaw != null && latRaw !== "" && lngRaw != null && lngRaw !== "") {
    const lat = typeof latRaw === "number" ? latRaw : Number.parseFloat(String(latRaw));
    const lng = typeof lngRaw === "number" ? lngRaw : Number.parseFloat(String(lngRaw));
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      if (inBox(lat, lng, SF)) return "sf";
      if (inBox(lat, lng, LA)) return "la";
      if (inBox(lat, lng, NYC)) return "nyc";
      if (inBox(lat, lng, DMV)) return "dmv";
    }
  }

  const city = normalizeCity(input.city ?? "");
  const region = (input.region ?? "").trim().toUpperCase();

  if (region === "DC" || region === "D.C." || region === "DISTRICT OF COLUMBIA") {
    return "dmv";
  }
  if (city === "washington" && region === "DC") return "dmv";

  if (region === "NY" && NYC_CITIES.has(city)) return "nyc";
  if (NYC_CITIES.has(city) && (region === "NY" || region === "NJ")) return "nyc";

  if (region === "MD") {
    if (DMV_MD_CITIES.has(city) || city.includes("baltimore")) return "dmv";
    if (city.includes("montgomery") || city.includes("prince george")) return "dmv";
  }

  if (region === "VA") {
    if (DMV_VA_CITIES.has(city)) return "dmv";
    if (city.includes("arlington") || city.includes("alexandria")) return "dmv";
  }

  if (region === "CA") {
    if (LA_CITIES.has(city)) return "la";
    if (SF_CITIES.has(city)) return "sf";
  }

  return null;
}
