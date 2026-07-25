import { DateTime } from "luxon";
import type {
  WorkshopEvent,
  WorkshopEventCategory,
} from "@/lib/workshop-types";

/** East Tennessee (Knoxville, Tri-Cities) uses Eastern; Middle/West uses Central. */
const TZ_EAST = "America/New_York";
const TZ_CENTRAL = "America/Chicago";

const NPL_EVENTS_URL =
  "https://events.library.nashville.org/cal/main/showEventList.rdo";

type CuratedSpec = {
  id: string;
  year: number;
  monthIndex: number;
  day: number;
  hour: number;
  minute: number;
  endHour?: number;
  endMinute?: number;
  timeZone: string;
  timeTbd?: boolean;
  canceled?: boolean;
  title: string;
  tagline: string;
  description: string;
  category: WorkshopEventCategory;
  organizer: string;
  venue: string;
  address: string;
  neighborhood: string;
  rsvpUrl: string;
  sourceChannel: WorkshopEvent["sourceChannel"];
  price?: WorkshopEvent["price"];
};

type NplRow = {
  /** yyyy-mm-dd */
  date: string;
  hour: number;
  minute: number;
  title: string;
  branch: string;
  address?: string;
  canceled?: boolean;
  category?: WorkshopEventCategory;
  description?: string;
  /** Optional list/chip preview; defaults to NPL · branch. */
  tagline?: string;
  /** Optional deep link; defaults to the NPL events list. */
  rsvpUrl?: string;
  slug: string;
};

const BRANCH: Record<
  string,
  { venue: string; address: string; neighborhood: string }
> = {
  Bellevue: {
    venue: "Bellevue Branch Library",
    address: "Bellevue, Nashville, TN",
    neighborhood: "Bellevue",
  },
  Bordeaux: {
    venue: "Bordeaux Branch Library",
    address: "Bordeaux, Nashville, TN",
    neighborhood: "Bordeaux",
  },
  Madison: {
    venue: "Madison Branch Library",
    address: "Madison, Nashville, TN",
    neighborhood: "Madison",
  },
  Hermitage: {
    venue: "Hermitage Branch Library",
    address: "Hermitage, Nashville, TN",
    neighborhood: "Hermitage",
  },
  "Hadley Park": {
    venue: "Hadley Park Branch Library",
    address: "Hadley Park, Nashville, TN",
    neighborhood: "Hadley Park",
  },
  Donelson: {
    venue: "Donelson Branch Library",
    address: "Donelson, Nashville, TN",
    neighborhood: "Donelson",
  },
  "Sevier Park": {
    venue: "Sevier Park Community Center",
    address: "3021 Lealand Ln, Nashville, TN 37204",
    neighborhood: "Sevier Park",
  },
  "Main Library": {
    venue: "Main Library — Special Collections Center, 2nd Floor",
    address: "Nashville, TN",
    neighborhood: "Downtown Nashville",
  },
};

function nplEvent(row: NplRow): CuratedSpec {
  const [y, m, d] = row.date.split("-").map(Number);
  const loc = BRANCH[row.branch] ?? {
    venue: row.branch,
    address: row.address ?? "Nashville, TN",
    neighborhood: row.branch,
  };
  const category = row.category ?? "workshop";
  const canceledNote = row.canceled
    ? " This session is canceled — check the Nashville Public Library calendar for updates."
    : "";

  return {
    id: `tn-npl-${row.slug}-${row.date.replaceAll("-", "")}`,
    year: y,
    monthIndex: m - 1,
    day: d,
    hour: row.hour,
    minute: row.minute,
    timeZone: TZ_CENTRAL,
    canceled: row.canceled,
    title: row.title,
    tagline: row.tagline ?? `Nashville Public Library · ${row.branch}`,
    description:
      (row.description ??
        `${row.title} at Nashville Public Library (${row.branch}).`) +
      canceledNote,
    category,
    organizer: `Nashville Public Library — ${row.branch}`,
    venue: loc.venue,
    address: row.address ?? loc.address,
    neighborhood: loc.neighborhood,
    rsvpUrl: row.rsvpUrl ?? NPL_EVENTS_URL,
    sourceChannel: "library",
  };
}

/** Writing-topic listings from Nashville Public Library event calendar. */
const NPL_WRITING_EVENTS: CuratedSpec[] = [
  nplEvent({
    date: "2026-07-23",
    hour: 0,
    minute: 0,
    title: "Creative Writing Club: Unearthed Summer Reading Challenge Edition",
    branch: "Bordeaux",
    canceled: true,
    slug: "creative-writing-club-unearthed",
  }),
  // July 24 Bellevue Creative Writing Club is listed below with full description + deep link.
  nplEvent({
    date: "2026-07-26",
    hour: 14,
    minute: 30,
    title: "Madison Carnegie Writers Group",
    branch: "Madison",
    category: "other",
    slug: "madison-carnegie-writers",
    tagline:
      "Every 4th Sunday · write, share readings & grow as writers · Free · Madison Library",
    description:
      "Every 4th Sunday. We write, talk about writing, listen to readings, and guest speakers, " +
      "collaborate, and grow as creative and professional writers. Free to attend. Come join us, " +
      "and invite a family member or friend, too.",
    rsvpUrl:
      "https://events.library.nashville.org/cal/event/eventView.do?b=de&href=/public/cals/MainCal/CAL-8a3e8e4c-9d1c2614-019d-20b8785b-000070c9.ics%2320260726T193000Z",
  }),
  nplEvent({
    date: "2026-07-27",
    hour: 16,
    minute: 0,
    title: "Pen Pal Club",
    branch: "Sevier Park",
    canceled: true,
    slug: "pen-pal-club",
  }),
  nplEvent({
    date: "2026-07-29",
    hour: 17,
    minute: 30,
    title: "Hermitage Write-In",
    branch: "Hermitage",
    category: "workshop",
    slug: "hermitage-write-in",
    rsvpUrl:
      "https://events.library.nashville.org/cal/event/eventView.do?b=de&href=/public/cals/MainCal/CAL-8a3e8e4b-9e2e7865-019e-3c778ff0-000022fb.ics%2320260729T223000Z",
  }),
  nplEvent({
    date: "2026-08-03",
    hour: 16,
    minute: 0,
    title: "Pen Pal Club",
    branch: "Sevier Park",
    canceled: true,
    slug: "pen-pal-club",
  }),
  nplEvent({
    date: "2026-08-04",
    hour: 18,
    minute: 0,
    title: "Bellevue Writers Group",
    branch: "Bellevue",
    category: "other",
    slug: "bellevue-writers-group",
  }),
  nplEvent({
    date: "2026-08-05",
    hour: 17,
    minute: 30,
    title: "Writer Support Group",
    branch: "Hermitage",
    category: "other",
    slug: "writer-support-group",
  }),
  nplEvent({
    date: "2026-08-06",
    hour: 15,
    minute: 0,
    title: "Creative Writing Club",
    branch: "Bordeaux",
    canceled: true,
    slug: "creative-writing-club",
  }),
  nplEvent({
    date: "2026-08-07",
    hour: 15,
    minute: 0,
    title: "Playwriting Workshop",
    branch: "Hadley Park",
    slug: "playwriting-workshop",
  }),
  nplEvent({
    date: "2026-08-08",
    hour: 14,
    minute: 30,
    title: "Carnegie Writers",
    branch: "Donelson",
    category: "other",
    slug: "carnegie-writers",
  }),
  nplEvent({
    date: "2026-08-10",
    hour: 16,
    minute: 0,
    title: "Pen Pal Club",
    branch: "Sevier Park",
    canceled: true,
    slug: "pen-pal-club",
  }),
  nplEvent({
    date: "2026-08-12",
    hour: 17,
    minute: 30,
    title: "Hermitage Write-In",
    branch: "Hermitage",
    slug: "hermitage-write-in",
  }),
  nplEvent({
    date: "2026-08-17",
    hour: 16,
    minute: 0,
    title: "Pen Pal Club",
    branch: "Sevier Park",
    canceled: true,
    slug: "pen-pal-club",
  }),
  nplEvent({
    date: "2026-08-18",
    hour: 18,
    minute: 0,
    title: "Bellevue Writers Group",
    branch: "Bellevue",
    category: "other",
    slug: "bellevue-writers-group",
  }),
  nplEvent({
    date: "2026-08-19",
    hour: 17,
    minute: 30,
    title: "Writer Support Group",
    branch: "Hermitage",
    category: "other",
    slug: "writer-support-group",
  }),
  nplEvent({
    date: "2026-08-23",
    hour: 14,
    minute: 30,
    title: "Madison Carnegie Writers Group",
    branch: "Madison",
    category: "other",
    slug: "madison-carnegie-writers",
    tagline:
      "Every 4th Sunday · write, share readings & grow as writers · Free · Madison Library",
    description:
      "Every 4th Sunday. We write, talk about writing, listen to readings, and guest speakers, " +
      "collaborate, and grow as creative and professional writers. Free to attend. Come join us, " +
      "and invite a family member or friend, too.",
  }),
  nplEvent({
    date: "2026-08-24",
    hour: 16,
    minute: 0,
    title: "Pen Pal Club",
    branch: "Sevier Park",
    canceled: true,
    slug: "pen-pal-club",
  }),
  nplEvent({
    date: "2026-08-26",
    hour: 17,
    minute: 30,
    title: "Hermitage Write-In",
    branch: "Hermitage",
    slug: "hermitage-write-in",
  }),
  nplEvent({
    date: "2026-08-27",
    hour: 17,
    minute: 0,
    title: "Creative Writing Club",
    branch: "Bordeaux",
    slug: "creative-writing-club",
  }),
  nplEvent({
    date: "2026-09-01",
    hour: 18,
    minute: 0,
    title: "Bellevue Writers Group",
    branch: "Bellevue",
    category: "other",
    slug: "bellevue-writers-group",
  }),
  nplEvent({
    date: "2026-09-04",
    hour: 15,
    minute: 0,
    title: "Playwriting Workshop",
    branch: "Hadley Park",
    slug: "playwriting-workshop",
  }),
  nplEvent({
    date: "2026-09-12",
    hour: 14,
    minute: 30,
    title: "Carnegie Writers",
    branch: "Donelson",
    category: "other",
    slug: "carnegie-writers",
  }),
  nplEvent({
    date: "2026-09-15",
    hour: 18,
    minute: 0,
    title: "Bellevue Writers Group",
    branch: "Bellevue",
    category: "other",
    slug: "bellevue-writers-group",
  }),
  nplEvent({
    date: "2026-09-27",
    hour: 14,
    minute: 30,
    title: "Madison Carnegie Writers Group",
    branch: "Madison",
    category: "other",
    slug: "madison-carnegie-writers",
    tagline:
      "Every 4th Sunday · write, share readings & grow as writers · Free · Madison Library",
    description:
      "Every 4th Sunday. We write, talk about writing, listen to readings, and guest speakers, " +
      "collaborate, and grow as creative and professional writers. Free to attend. Come join us, " +
      "and invite a family member or friend, too.",
  }),
  nplEvent({
    date: "2026-09-29",
    hour: 18,
    minute: 0,
    title: "Bellevue Writers Group",
    branch: "Bellevue",
    category: "other",
    slug: "bellevue-writers-group",
  }),
  nplEvent({
    date: "2026-10-02",
    hour: 15,
    minute: 0,
    title: "Playwriting Workshop",
    branch: "Hadley Park",
    slug: "playwriting-workshop",
  }),
  nplEvent({
    date: "2026-10-06",
    hour: 18,
    minute: 0,
    title: "Bellevue Writers Group",
    branch: "Bellevue",
    category: "other",
    slug: "bellevue-writers-group",
  }),
  nplEvent({
    date: "2026-10-20",
    hour: 18,
    minute: 0,
    title: "Bellevue Writers Group",
    branch: "Bellevue",
    category: "other",
    slug: "bellevue-writers-group",
  }),
  nplEvent({
    date: "2026-10-25",
    hour: 14,
    minute: 30,
    title: "Madison Carnegie Writers Group",
    branch: "Madison",
    category: "other",
    slug: "madison-carnegie-writers",
    tagline:
      "Every 4th Sunday · write, share readings & grow as writers · Free · Madison Library",
    description:
      "Every 4th Sunday. We write, talk about writing, listen to readings, and guest speakers, " +
      "collaborate, and grow as creative and professional writers. Free to attend. Come join us, " +
      "and invite a family member or friend, too.",
  }),
  nplEvent({
    date: "2026-11-03",
    hour: 18,
    minute: 0,
    title: "Bellevue Writers Group",
    branch: "Bellevue",
    category: "other",
    slug: "bellevue-writers-group",
  }),
  nplEvent({
    date: "2026-11-13",
    hour: 15,
    minute: 0,
    title: "Playwriting Workshop",
    branch: "Hadley Park",
    slug: "playwriting-workshop",
  }),
  nplEvent({
    date: "2026-11-17",
    hour: 18,
    minute: 0,
    title: "Bellevue Writers Group",
    branch: "Bellevue",
    category: "other",
    slug: "bellevue-writers-group",
  }),
  nplEvent({
    date: "2026-12-01",
    hour: 18,
    minute: 0,
    title: "Bellevue Writers Group",
    branch: "Bellevue",
    category: "other",
    slug: "bellevue-writers-group",
  }),
  nplEvent({
    date: "2026-12-15",
    hour: 18,
    minute: 0,
    title: "Bellevue Writers Group",
    branch: "Bellevue",
    category: "other",
    slug: "bellevue-writers-group",
  }),
  nplEvent({
    date: "2026-12-29",
    hour: 18,
    minute: 0,
    title: "Bellevue Writers Group",
    branch: "Bellevue",
    category: "other",
    slug: "bellevue-writers-group",
  }),
];

const UNION_AVE_ADDRESS = "517 Union Ave, Knoxville, TN 37902";

/** Union Ave Books (Knoxville) — excludes Audiobook Craft Night & Consignment Orientation. */
const UNION_AVE_EVENTS: CuratedSpec[] = [
  {
    id: "tn-uab-grandma-joy-brad-ryan-20260707",
    year: 2026,
    monthIndex: 6,
    day: 7,
    hour: 18,
    minute: 0,
    timeZone: TZ_EAST,
    title: "Grandma Joy and Brad Ryan — Grandma Joy and Me",
    tagline: "Union Ave Books · Knoxville · Free · RSVP",
    description:
      "Union Ave Books presents Grandma Joy and Brad Ryan for Grandma Joy and Me: A Journey of Healing, " +
      "One National Park at a Time. Free; please RSVP.",
    category: "reading",
    organizer: "Union Ave Books",
    venue: "Union Ave Books",
    address: UNION_AVE_ADDRESS,
    neighborhood: "Knoxville",
    rsvpUrl: "https://unionavebooks.com/event/2026-07-07/grandma-joy-and-brad-ryan",
    sourceChannel: "bookstore",
    price: "free",
  },
  {
    id: "tn-uab-miranda-smith-darby-bozeman-20260716",
    year: 2026,
    monthIndex: 6,
    day: 16,
    hour: 18,
    minute: 0,
    endHour: 19,
    endMinute: 0,
    timeZone: TZ_EAST,
    title: "Miranda Smith in conversation with Darby Bozeman — Scary Movie Night",
    tagline: "Union Ave Books · Knoxville · Free · RSVP",
    description:
      "Union Ave Books presents Miranda Smith in conversation with Darby Bozeman for Scary Movie Night. " +
      "Free; please RSVP.",
    category: "reading",
    organizer: "Union Ave Books",
    venue: "Union Ave Books",
    address: UNION_AVE_ADDRESS,
    neighborhood: "Knoxville",
    rsvpUrl:
      "https://unionavebooks.com/event/2026-07-16/miranda-smith-conversation-darby-bozeman",
    sourceChannel: "bookstore",
    price: "free",
  },
  {
    id: "tn-uab-pages-pours-tern-20260722",
    year: 2026,
    monthIndex: 6,
    day: 22,
    hour: 18,
    minute: 0,
    endHour: 20,
    endMinute: 0,
    timeZone: TZ_EAST,
    title: "Pages & Pours at Tern Club",
    tagline: "Union Ave Books · Tern Club · Knoxville · RSVP",
    description:
      "Union Ave Books' cozy, queer, reading-focused happy hour — drinking, snacking, and reading at Tern Club. " +
      "Bring a book from your TBR or pick from a curated selection. Space is limited; please RSVP.",
    category: "other",
    organizer: "Union Ave Books",
    venue: "Tern Club",
    address: "135 S Gay St, Knoxville, TN 37902",
    neighborhood: "Knoxville",
    rsvpUrl: "https://unionavebooks.com/event/2026-07-22/pages-pours-tern-club",
    sourceChannel: "bookstore",
  },
  {
    id: "tn-uab-book-club-20260727",
    year: 2026,
    monthIndex: 6,
    day: 27,
    hour: 19,
    minute: 30,
    endHour: 20,
    endMinute: 30,
    timeZone: TZ_EAST,
    title: "Union Ave Book Club",
    tagline: "Union Ave Books · Knoxville · Last Monday",
    description:
      "Monthly fiction and nonfiction book club at Union Ave Books (last Monday of the month). " +
      "Read one or both picks and join the discussion.",
    category: "other",
    organizer: "Union Ave Books",
    venue: "Union Ave Books",
    address: UNION_AVE_ADDRESS,
    neighborhood: "Knoxville",
    rsvpUrl: "https://unionavebooks.com/event/2026-07-27/union-ave-book-club",
    sourceChannel: "bookstore",
  },
  {
    id: "tn-uab-first-fridays-poetry-20260807",
    year: 2026,
    monthIndex: 7,
    day: 7,
    hour: 18,
    minute: 0,
    endHour: 19,
    endMinute: 30,
    timeZone: TZ_EAST,
    title: "August First Fridays Poetry Night",
    tagline: "Union Ave Books · Knoxville · Free · Poetry & fiction · RSVP",
    description:
      "Free First Fridays poetry and fiction reading featuring Connie Jordan Green " +
      "(Nameless as the Minnows), Jacob Lietz, Zuleyha Ozturk, and Spencer K.M. Brown. " +
      "6:00–7:30pm at Union Ave Books; please RSVP.",
    category: "reading",
    organizer: "Union Ave Books",
    venue: "Union Ave Books",
    address: UNION_AVE_ADDRESS,
    neighborhood: "Knoxville",
    rsvpUrl:
      "https://unionavebooks.com/event/2026-08-07/august-first-fridays-poetry-night",
    sourceChannel: "bookstore",
    price: "free",
  },
  {
    id: "tn-uab-yancy-wood-20260813",
    year: 2026,
    monthIndex: 7,
    day: 13,
    hour: 18,
    minute: 0,
    endHour: 19,
    endMinute: 0,
    timeZone: TZ_EAST,
    title: "Yancy Wood — Two Minutes Over Berlin",
    tagline: "Union Ave Books · Knoxville · Free · Fiction · RSVP",
    description:
      "Retired lieutenant colonel Yancy Wood presents Two Minutes Over Berlin, a WWII saga " +
      "based on the true story of ten volunteers who join the Army Air Corps amid staggering losses in Europe. " +
      "Free, 6:00–7:00pm; please RSVP.",
    category: "reading",
    organizer: "Union Ave Books",
    venue: "Union Ave Books",
    address: UNION_AVE_ADDRESS,
    neighborhood: "Knoxville",
    rsvpUrl: "https://unionavebooks.com/event/2026-08-13/yancy-wood",
    sourceChannel: "bookstore",
    price: "free",
  },
  {
    id: "tn-uab-pages-pours-fly-20260819",
    year: 2026,
    monthIndex: 7,
    day: 19,
    hour: 18,
    minute: 0,
    endHour: 20,
    endMinute: 0,
    timeZone: TZ_EAST,
    title: "Pages & Pours at Fly By Night",
    tagline: "Union Ave Books · Fly By Night · Knoxville · RSVP",
    description:
      "Union Ave Books' cozy, queer, reading-focused happy hour at Fly By Night " +
      "(906 Sevier Ave #126). Bring a book from your TBR or pick from a curated selection — " +
      "guess the month's theme for a prize. Space is limited; please RSVP. 6:00–8:00pm.",
    category: "other",
    organizer: "Union Ave Books",
    venue: "Fly By Night",
    address: "906 Sevier Ave #126, Knoxville, TN 37920",
    neighborhood: "Knoxville",
    rsvpUrl: "https://unionavebooks.com/event/2026-08-19/pages-pours-fly-night",
    sourceChannel: "bookstore",
  },
  {
    id: "tn-uab-noah-soltau-20260820",
    year: 2026,
    monthIndex: 7,
    day: 20,
    hour: 18,
    minute: 0,
    endHour: 19,
    endMinute: 0,
    timeZone: TZ_EAST,
    title: "Noah Soltau — Titanfall",
    tagline: "Union Ave Books · Knoxville · Free · Poetry · RSVP",
    description:
      "East Tennessee poet Noah Soltau (managing editor of The Red Branch Review) presents Titanfall, " +
      "a poetry collection exploring grief, identity, and mortality in a Christ-haunted Southern landscape — " +
      "shortlisted for the Arthur Smith Prize. Free, 6:00–7:00pm; please RSVP.",
    category: "reading",
    organizer: "Union Ave Books",
    venue: "Union Ave Books",
    address: UNION_AVE_ADDRESS,
    neighborhood: "Knoxville",
    rsvpUrl: "https://unionavebooks.com/event/2026-08-20/noah-soltau",
    sourceChannel: "bookstore",
    price: "free",
  },
  {
    id: "tn-uab-tim-disney-20260827",
    year: 2026,
    monthIndex: 7,
    day: 27,
    hour: 18,
    minute: 0,
    endHour: 19,
    endMinute: 0,
    timeZone: TZ_EAST,
    title: "Tim Disney — The A.R.C.",
    tagline: "Union Ave Books · Knoxville · Free · Fiction · RSVP",
    description:
      "Filmmaker Tim Disney presents The A.R.C., a satirical sci-fi graphic novel about a virus " +
      "that kills when you lie — in a world built on lies. Free, 6:00–7:00pm; please RSVP.",
    category: "reading",
    organizer: "Union Ave Books",
    venue: "Union Ave Books",
    address: UNION_AVE_ADDRESS,
    neighborhood: "Knoxville",
    rsvpUrl: "https://unionavebooks.com/event/2026-08-27/tim-disney",
    sourceChannel: "bookstore",
    price: "free",
  },
  {
    id: "tn-uab-book-club-20260831",
    year: 2026,
    monthIndex: 7,
    day: 31,
    hour: 19,
    minute: 30,
    endHour: 20,
    endMinute: 30,
    timeZone: TZ_EAST,
    title: "Union Ave Book Club",
    tagline: "Union Ave Books · Knoxville · Last Monday",
    description:
      "Monthly book club partnered with Fred's Around the Corner — each month a fiction and nonfiction pick; " +
      "read one or both. Meets the last Monday at 7:30pm at Union Ave Books. " +
      "Use code KNOXBREW for 15% off the month's books.",
    category: "other",
    organizer: "Union Ave Books",
    venue: "Union Ave Books",
    address: UNION_AVE_ADDRESS,
    neighborhood: "Knoxville",
    rsvpUrl: "https://unionavebooks.com/event/2026-08-31/union-ave-book-club",
    sourceChannel: "bookstore",
  },
  {
    id: "tn-uab-gerald-nicosia-rb-morris-20260910",
    year: 2026,
    monthIndex: 8,
    day: 10,
    hour: 18,
    minute: 0,
    endHour: 19,
    endMinute: 30,
    timeZone: TZ_EAST,
    title: "Gerald Nicosia featuring R.B. Morris — Last of the Lincolns",
    tagline: "Union Ave Books · Knoxville · Free · RSVP",
    description:
      "Gerald Nicosia reads from his poetry collection Last of the Lincolns, followed by a discussion " +
      "with R.B. Morris. Free; please RSVP.",
    category: "reading",
    organizer: "Union Ave Books",
    venue: "Union Ave Books",
    address: UNION_AVE_ADDRESS,
    neighborhood: "Knoxville",
    rsvpUrl:
      "https://unionavebooks.com/event/2026-09-10/gerald-nicosia-featuring-rb-morris",
    sourceChannel: "bookstore",
    price: "free",
  },
  {
    id: "tn-uab-john-brackett-20260924",
    year: 2026,
    monthIndex: 8,
    day: 24,
    hour: 18,
    minute: 0,
    endHour: 19,
    endMinute: 0,
    timeZone: TZ_EAST,
    title: "John Brackett — Touch of Grey",
    tagline: "Union Ave Books · Knoxville · Free · RSVP",
    description:
      "Union Ave Books presents John Brackett for Touch of Grey, or How the Grateful Dead Became Pop Stars. " +
      "Free; please RSVP.",
    category: "reading",
    organizer: "Union Ave Books",
    venue: "Union Ave Books",
    address: UNION_AVE_ADDRESS,
    neighborhood: "Knoxville",
    rsvpUrl: "https://unionavebooks.com/event/2026-09-24/john-brackett",
    sourceChannel: "bookstore",
    price: "free",
  },
  {
    id: "tn-uab-book-club-20260928",
    year: 2026,
    monthIndex: 8,
    day: 28,
    hour: 19,
    minute: 30,
    endHour: 20,
    endMinute: 30,
    timeZone: TZ_EAST,
    title: "Union Ave Book Club",
    tagline: "Union Ave Books · Knoxville · Last Monday",
    description:
      "Monthly fiction and nonfiction book club at Union Ave Books (last Monday of the month). " +
      "Read one or both picks and join the discussion.",
    category: "other",
    organizer: "Union Ave Books",
    venue: "Union Ave Books",
    address: UNION_AVE_ADDRESS,
    neighborhood: "Knoxville",
    rsvpUrl: "https://unionavebooks.com/event/2026-09-28/union-ave-book-club",
    sourceChannel: "bookstore",
  },
  {
    id: "tn-uab-amanda-mccracken-20261015",
    year: 2026,
    monthIndex: 9,
    day: 15,
    hour: 18,
    minute: 0,
    endHour: 19,
    endMinute: 30,
    timeZone: TZ_EAST,
    title:
      "Amanda McCracken in conversation with Dr. Camden Morgante — When Longing Becomes Your Lover",
    tagline: "Union Ave Books · Knoxville · Free · RSVP",
    description:
      "Union Ave Books presents Amanda McCracken in conversation with Dr. Camden Morgante for " +
      "When Longing Becomes Your Lover. Free; please RSVP.",
    category: "reading",
    organizer: "Union Ave Books",
    venue: "Union Ave Books",
    address: UNION_AVE_ADDRESS,
    neighborhood: "Knoxville",
    rsvpUrl:
      "https://unionavebooks.com/event/2026-10-15/amanda-mccracken-conversation-dr-camden-morgante",
    sourceChannel: "bookstore",
    price: "free",
  },
  {
    id: "tn-uab-silas-house-20261022",
    year: 2026,
    monthIndex: 9,
    day: 22,
    hour: 19,
    minute: 0,
    endHour: 20,
    endMinute: 0,
    timeZone: TZ_EAST,
    title: "Silas House in conversation with Bishop Brian Cole — The Tulip Poplars",
    tagline: "Union Ave Books · St. James Episcopal Church · Ticketed",
    description:
      "Union Ave Books and the Episcopal Diocese of East Tennessee welcome Silas House for his novel " +
      "The Tulip Poplars, in conversation with Bishop Brian Cole at St. James Episcopal Church. " +
      "Ticket includes a hardcover copy of the book and event admission.",
    category: "reading",
    organizer: "Union Ave Books",
    venue: "St. James Episcopal Church",
    address: "Knoxville, TN",
    neighborhood: "Knoxville",
    rsvpUrl:
      "https://unionavebooks.com/event/2026-10-22/silas-house-conversation-bishop-brian-cole",
    sourceChannel: "bookstore",
    price: "paid",
  },
  {
    id: "tn-uab-book-club-20261026",
    year: 2026,
    monthIndex: 9,
    day: 26,
    hour: 19,
    minute: 30,
    endHour: 20,
    endMinute: 30,
    timeZone: TZ_EAST,
    title: "Union Ave Book Club",
    tagline: "Union Ave Books · Knoxville · Last Monday",
    description:
      "Monthly fiction and nonfiction book club at Union Ave Books (last Monday of the month). " +
      "Read one or both picks and join the discussion.",
    category: "other",
    organizer: "Union Ave Books",
    venue: "Union Ave Books",
    address: UNION_AVE_ADDRESS,
    neighborhood: "Knoxville",
    rsvpUrl: "https://unionavebooks.com/event/2026-10-26/union-ave-book-club",
    sourceChannel: "bookstore",
  },
  {
    id: "tn-uab-erin-miller-reid-20261112",
    year: 2026,
    monthIndex: 10,
    day: 12,
    hour: 18,
    minute: 0,
    endHour: 19,
    endMinute: 30,
    timeZone: TZ_EAST,
    title: "Erin Miller Reid in conversation with Patricia Hudson — But for Longing",
    tagline: "Union Ave Books · Knoxville · Free · RSVP",
    description:
      "Union Ave Books presents Erin Miller Reid in conversation with Patricia Hudson for But for Longing. " +
      "Free; please RSVP.",
    category: "reading",
    organizer: "Union Ave Books",
    venue: "Union Ave Books",
    address: UNION_AVE_ADDRESS,
    neighborhood: "Knoxville",
    rsvpUrl:
      "https://unionavebooks.com/event/2026-11-12/erin-miller-reid-conversation-patricia-hudson",
    sourceChannel: "bookstore",
    price: "free",
  },
  {
    id: "tn-uab-book-club-20261130",
    year: 2026,
    monthIndex: 10,
    day: 30,
    hour: 19,
    minute: 30,
    endHour: 20,
    endMinute: 30,
    timeZone: TZ_EAST,
    title: "Union Ave Book Club",
    tagline: "Union Ave Books · Knoxville · Last Monday",
    description:
      "Monthly fiction and nonfiction book club at Union Ave Books (last Monday of the month). " +
      "Read one or both picks and join the discussion.",
    category: "other",
    organizer: "Union Ave Books",
    venue: "Union Ave Books",
    address: UNION_AVE_ADDRESS,
    neighborhood: "Knoxville",
    rsvpUrl: "https://unionavebooks.com/event/2026-11-30/union-ave-book-club",
    sourceChannel: "bookstore",
  },
];

const PLENTY_WRITE_IN_URL =
  "https://www.plentybookshop.com/event-details-registration/monthly-write-in-2026-04-07-18-00-1";
const PLENTY_EVENTS_URL = "https://www.plentybookshop.org/events";

/** First-Tuesday monthly write-ins at PLENTY Downtown Bookshop (Cookeville). */
const PLENTY_WRITE_INS: CuratedSpec[] = [
  "2026-07-07",
  "2026-08-04",
  "2026-09-01",
  "2026-10-06",
  "2026-11-03",
  "2026-12-01",
].map((date) => {
  const [y, m, d] = date.split("-").map(Number);
  return {
    id: `tn-plenty-write-in-${date.replaceAll("-", "")}`,
    year: y,
    monthIndex: m - 1,
    day: d,
    hour: 18,
    minute: 0,
    endHour: 20,
    endMinute: 0,
    timeZone: TZ_CENTRAL,
    title: "Monthly Write-In",
    tagline: "PLENTY Downtown Bookshop · Cookeville · Free · First Tuesday",
    description:
      "Join PLENTY Downtown Bookshop after hours on the first Tuesday of every month for a write-in. " +
      "The shop is closed to the general public during this time. There is a quiet zone for focused writing " +
      "and another area for conversation or background music. Open to all levels and types of writers — " +
      "novelists, bloggers, grant writers, poets, and more. Bring headphones and a snack. Free.",
    category: "workshop",
    organizer: "PLENTY Downtown Bookshop",
    venue: "PLENTY Downtown Bookshop",
    address: "41 W Broad St, Cookeville, TN 38501",
    neighborhood: "Cookeville",
    rsvpUrl: PLENTY_WRITE_IN_URL,
    sourceChannel: "bookstore",
    price: "free",
  };
});

/** Second-Saturday local author meet-and-greet / signing at PLENTY. */
const PLENTY_SECOND_SATURDAYS: CuratedSpec[] = [
  "2026-07-11",
  "2026-08-08",
  "2026-09-12",
  "2026-10-10",
  "2026-11-14",
  "2026-12-12",
].map((date) => {
  const [y, m, d] = date.split("-").map(Number);
  return {
    id: `tn-plenty-second-saturdays-${date.replaceAll("-", "")}`,
    year: y,
    monthIndex: m - 1,
    day: d,
    hour: 14,
    minute: 0,
    endHour: 16,
    endMinute: 0,
    timeZone: TZ_CENTRAL,
    title: "Second Saturdays — Local Author Meet & Sign",
    tagline: "PLENTY Downtown Bookshop · Cookeville · Free · Second Saturday",
    description:
      "On the second Saturday of each month, PLENTY Downtown Bookshop hosts two different local authors " +
      "for an informal meet-and-greet and book signing. Stop by anytime between 2:00 and 4:00 PM to meet " +
      "the authors and pick up a signed copy. Free.",
    category: "reading",
    organizer: "PLENTY Downtown Bookshop",
    venue: "PLENTY Downtown Bookshop",
    address: "41 W Broad St, Cookeville, TN 38501",
    neighborhood: "Cookeville",
    rsvpUrl: PLENTY_EVENTS_URL,
    sourceChannel: "bookstore",
    price: "free",
  };
});

/** Monthly Writers Workshop (typically first Friday) at PLENTY — $20, preregistration required. */
const PLENTY_WRITERS_WORKSHOPS: CuratedSpec[] = [
  "2026-07-03",
  "2026-08-07",
  "2026-09-04",
  "2026-10-02",
  "2026-11-06",
  "2026-12-04",
].map((date) => {
  const [y, m, d] = date.split("-").map(Number);
  return {
    id: `tn-plenty-writers-workshop-${date.replaceAll("-", "")}`,
    year: y,
    monthIndex: m - 1,
    day: d,
    hour: 11,
    minute: 0,
    endHour: 12,
    endMinute: 15,
    timeZone: TZ_CENTRAL,
    title: "Writers Workshop",
    tagline: "PLENTY Downtown Bookshop · Cookeville · $20 · Preregistration required",
    description:
      "A structured workshop for writers of any age and stage, with rotating themes, hands-on activities, and prompts. " +
      "Often led by Tennessee Tech faculty or local authors. $20 per participant (includes a drink from Plenty's Neighborhood Cafe). " +
      "Preregistration required at plentybookshop.com/events.",
    category: "workshop",
    organizer: "PLENTY Downtown Bookshop",
    venue: "PLENTY Downtown Bookshop",
    address: "41 W Broad St, Cookeville, TN 38501",
    neighborhood: "Cookeville",
    rsvpUrl: "https://www.plentybookshop.com/events",
    sourceChannel: "bookstore",
    price: "paid",
  };
});

/** Tales on the Trail — monthly audiobook walk (meet at the bookshop). */
const PLENTY_TALES_ON_THE_TRAIL: CuratedSpec[] = [
  "2026-08-01",
  "2026-09-05",
  "2026-10-03",
  "2026-11-07",
  "2026-12-05",
].map((date) => {
  const [y, m, d] = date.split("-").map(Number);
  return {
    id: `tn-plenty-tales-on-the-trail-${date.replaceAll("-", "")}`,
    year: y,
    monthIndex: m - 1,
    day: d,
    hour: 9,
    minute: 0,
    endHour: 10,
    endMinute: 0,
    timeZone: TZ_CENTRAL,
    title: "Tales on the Trail — Monthly Audiobook Walk",
    tagline: "PLENTY Downtown Bookshop · Cookeville · Meet at the bookshop",
    description:
      "A monthly audiobook walk with Plenty. Meet at the bookshop for this community reading-on-the-move event.",
    category: "other",
    organizer: "PLENTY Downtown Bookshop",
    venue: "PLENTY Downtown Bookshop (meet-up)",
    address: "41 W Broad St, Cookeville, TN 38501",
    neighborhood: "Cookeville",
    rsvpUrl: PLENTY_EVENTS_URL,
    sourceChannel: "bookstore",
  };
});

/** Booked and Unplugged — every third Friday. */
const PLENTY_BOOKED_AND_UNPLUGGED: CuratedSpec[] = [
  "2026-08-17",
  "2026-09-18",
  "2026-10-16",
  "2026-11-20",
  "2026-12-18",
].map((date) => {
  const [y, m, d] = date.split("-").map(Number);
  return {
    id: `tn-plenty-booked-and-unplugged-${date.replaceAll("-", "")}`,
    year: y,
    monthIndex: m - 1,
    day: d,
    hour: 18,
    minute: 30,
    endHour: 20,
    endMinute: 30,
    timeZone: TZ_CENTRAL,
    title: "Booked and Unplugged",
    tagline: "PLENTY Downtown Bookshop · Cookeville · Third Friday",
    description:
      "Booked and Unplugged at PLENTY Downtown Bookshop — every third Friday of the month.",
    category: "other",
    organizer: "PLENTY Downtown Bookshop",
    venue: "PLENTY Downtown Bookshop",
    address: "41 W Broad St, Cookeville, TN 38501",
    neighborhood: "Cookeville",
    rsvpUrl: PLENTY_EVENTS_URL,
    sourceChannel: "bookstore",
  };
});

const PLENTY_ONE_OFFS: CuratedSpec[] = [
  {
    id: "tn-plenty-sherry-hamby-20260724",
    year: 2026,
    monthIndex: 6,
    day: 24,
    hour: 17,
    minute: 0,
    endHour: 19,
    endMinute: 0,
    timeZone: TZ_CENTRAL,
    title: "Author Event: Dr. Sherry Hamby in Conversation with Dr. Katie Herman Turner",
    tagline: "PLENTY Downtown Bookshop · Cookeville · Stronger Than You Think",
    description:
      "Dr. Sherry Hamby discusses her book Stronger Than You Think in conversation with Dr. Katie Herman Turner.",
    category: "reading",
    organizer: "PLENTY Downtown Bookshop",
    venue: "PLENTY Downtown Bookshop",
    address: "41 W Broad St, Cookeville, TN 38501",
    neighborhood: "Cookeville",
    rsvpUrl: PLENTY_EVENTS_URL,
    sourceChannel: "bookstore",
  },
  {
    id: "tn-plenty-grace-helena-walz-20260725",
    year: 2026,
    monthIndex: 6,
    day: 25,
    hour: 17,
    minute: 0,
    endHour: 19,
    endMinute: 0,
    timeZone: TZ_CENTRAL,
    title: "Author Event: Grace Helena Walz — Pretty as a Peach",
    tagline: "PLENTY Downtown Bookshop · Cookeville",
    description:
      "Grace Helena Walz discusses her latest novel, Pretty as a Peach.",
    category: "reading",
    organizer: "PLENTY Downtown Bookshop",
    venue: "PLENTY Downtown Bookshop",
    address: "41 W Broad St, Cookeville, TN 38501",
    neighborhood: "Cookeville",
    rsvpUrl: PLENTY_EVENTS_URL,
    sourceChannel: "bookstore",
  },
  {
    id: "tn-plenty-lauren-nossett-20260807",
    year: 2026,
    monthIndex: 7,
    day: 7,
    hour: 17,
    minute: 0,
    endHour: 18,
    endMinute: 30,
    timeZone: TZ_CENTRAL,
    title: "Author Event: Lauren Nossett in Conversation with Rea Frey — Indie Darling",
    tagline: "PLENTY Downtown Bookshop · Cookeville",
    description:
      "Lauren Nossett discusses her book Indie Darling in conversation with Rea Frey.",
    category: "reading",
    organizer: "PLENTY Downtown Bookshop",
    venue: "PLENTY Downtown Bookshop",
    address: "41 W Broad St, Cookeville, TN 38501",
    neighborhood: "Cookeville",
    rsvpUrl: PLENTY_EVENTS_URL,
    sourceChannel: "bookstore",
  },
  {
    id: "tn-plenty-hannah-whitten-midnight-20260810",
    year: 2026,
    monthIndex: 7,
    day: 10,
    hour: 22,
    minute: 0,
    endHour: 23,
    endMinute: 59,
    timeZone: TZ_CENTRAL,
    title: "Midnight Release Party + Meet the Author: Reliquary by Hannah Whitten",
    tagline: "PLENTY Downtown Bookshop · Cookeville · Tickets",
    description:
      "Midnight release party and meet the author for Reliquary by Hannah Whitten. Event runs into the early morning of August 11.",
    category: "reading",
    organizer: "PLENTY Downtown Bookshop",
    venue: "PLENTY Downtown Bookshop",
    address: "41 W Broad St, Cookeville, TN 38501",
    neighborhood: "Cookeville",
    rsvpUrl: PLENTY_EVENTS_URL,
    sourceChannel: "bookstore",
    price: "paid",
  },
  {
    id: "tn-plenty-book-club-101-20260811",
    year: 2026,
    monthIndex: 7,
    day: 11,
    hour: 18,
    minute: 0,
    endHour: 19,
    endMinute: 0,
    timeZone: TZ_CENTRAL,
    title: "Book Club 101: Selecting the Right Book for Your Club",
    tagline: "PLENTY Downtown Bookshop · Cookeville · Free · Quarterly series",
    description:
      "Thinking about starting a book club but not sure where to begin? Join Plenty Downtown Bookshop for the second installment of the quarterly Book Club 101 series. " +
      "This free, conversational workshop is designed for anyone interested in building a thriving book club. " +
      "This session focuses on selecting the right book for your club — what makes for engaging discussions, how to match titles to your group's interests, and related strategies.",
    category: "workshop",
    organizer: "PLENTY Downtown Bookshop",
    venue: "PLENTY Downtown Bookshop",
    address: "41 W Broad St, Cookeville, TN 38501",
    neighborhood: "Cookeville",
    rsvpUrl: PLENTY_EVENTS_URL,
    sourceChannel: "bookstore",
    price: "free",
  },
  {
    id: "tn-plenty-jennifer-moorman-storytime-20260815",
    year: 2026,
    monthIndex: 7,
    day: 15,
    hour: 10,
    minute: 0,
    endHour: 11,
    endMinute: 0,
    timeZone: TZ_CENTRAL,
    title: "Storytime with Jennifer Moorman",
    tagline: "PLENTY Downtown Bookshop · Cookeville",
    description: "Storytime with Jennifer Moorman at PLENTY Downtown Bookshop.",
    category: "reading",
    organizer: "PLENTY Downtown Bookshop",
    venue: "PLENTY Downtown Bookshop",
    address: "41 W Broad St, Cookeville, TN 38501",
    neighborhood: "Cookeville",
    rsvpUrl: PLENTY_EVENTS_URL,
    sourceChannel: "bookstore",
  },
  {
    id: "tn-plenty-ruta-sepetys-20260820",
    year: 2026,
    monthIndex: 7,
    day: 20,
    hour: 19,
    minute: 0,
    endHour: 20,
    endMinute: 0,
    timeZone: TZ_CENTRAL,
    title: "An Evening with Ruta Sepetys",
    tagline: "DelMonaco Winery & Vineyards · Baxter · Presented with Plenty",
    description:
      "An evening with Ruta Sepetys at DelMonaco Winery & Vineyards in Baxter, listed on the Plenty Bookshop events calendar.",
    category: "reading",
    organizer: "PLENTY Downtown Bookshop",
    venue: "DelMonaco Winery & Vineyards",
    address: "600 Lance Dr, Baxter, TN 38544",
    neighborhood: "Baxter",
    rsvpUrl: PLENTY_EVENTS_URL,
    sourceChannel: "bookstore",
  },
  {
    id: "tn-plenty-jeff-zentner-20260821",
    year: 2026,
    monthIndex: 7,
    day: 21,
    hour: 18,
    minute: 0,
    endHour: 19,
    endMinute: 0,
    timeZone: TZ_CENTRAL,
    title: "Author Event: Jeff Zentner",
    tagline: "PLENTY Downtown Bookshop · Cookeville",
    description: "Author event with Jeff Zentner at PLENTY Downtown Bookshop.",
    category: "reading",
    organizer: "PLENTY Downtown Bookshop",
    venue: "PLENTY Downtown Bookshop",
    address: "41 W Broad St, Cookeville, TN 38501",
    neighborhood: "Cookeville",
    rsvpUrl: PLENTY_EVENTS_URL,
    sourceChannel: "bookstore",
  },
  {
    id: "tn-plenty-timothy-johnston-20260829",
    year: 2026,
    monthIndex: 7,
    day: 29,
    hour: 13,
    minute: 0,
    endHour: 14,
    endMinute: 0,
    timeZone: TZ_CENTRAL,
    title: "Tailgate Author Event: Timothy Johnston",
    tagline: "PLENTY Downtown Bookshop · Cookeville",
    description: "Tailgate author event with Timothy Johnston at PLENTY Downtown Bookshop.",
    category: "reading",
    organizer: "PLENTY Downtown Bookshop",
    venue: "PLENTY Downtown Bookshop",
    address: "41 W Broad St, Cookeville, TN 38501",
    neighborhood: "Cookeville",
    rsvpUrl: PLENTY_EVENTS_URL,
    sourceChannel: "bookstore",
  },
];

/** Sawmill Poetry Series — first Monday monthly: featured Southern poet + open mic. */
const PLENTY_SAWMILL_POETRY: CuratedSpec[] = [
  "2026-08-03",
  "2026-09-07",
  "2026-10-05",
  "2026-11-02",
  "2026-12-07",
].map((date) => {
  const [y, m, d] = date.split("-").map(Number);
  return {
    id: `tn-plenty-sawmill-poetry-${date.replaceAll("-", "")}`,
    year: y,
    monthIndex: m - 1,
    day: d,
    hour: 19,
    minute: 0,
    endHour: 20,
    endMinute: 30,
    timeZone: TZ_CENTRAL,
    title: "Sawmill Poetry Series",
    tagline: "PLENTY Downtown Bookshop · Cookeville · Free · First Monday",
    description:
      "On the first Monday of every month, a featured Southern poet reads, followed by an open mic. " +
      "Hosted by Erin Hoover (author and Tennessee Tech professor). Featured reading begins at 7:00 PM. " +
      "Local writers who want an open-mic slot should arrive by 6:45 PM to sign up for five minutes — " +
      "poetry, performance poetry, song lyrics, flash fiction, and micro-essays welcome. " +
      "No tickets or cover charge. Supporting visiting poets by buying their books is encouraged.",
    category: "open-mic",
    organizer: "PLENTY Downtown Bookshop / Sawmill Poetry Series",
    venue: "PLENTY Downtown Bookshop",
    address: "41 W Broad St, Cookeville, TN 38501",
    neighborhood: "Cookeville",
    rsvpUrl: PLENTY_EVENTS_URL,
    sourceChannel: "bookstore",
    price: "free",
  };
});

const EVENTS: CuratedSpec[] = [
  {
    id: "tn-npl-creative-writing-club-bellevue-20260724",
    year: 2026,
    monthIndex: 6,
    day: 24,
    hour: 16,
    minute: 0,
    endHour: 17,
    endMinute: 0,
    timeZone: TZ_CENTRAL,
    title: "Creative Writing Club (Grades 3–5)",
    tagline: "Nashville Public Library · Bellevue · Grades 3–5",
    description:
      "Calling all 3rd, 4th, and 5th Graders! Join Ms. Emily every Friday at 4:00 PM for Creative Writing Club. " +
      "You'll be able to practice and share your writing, while also learning about the different creative writing outlets and their foundations. " +
      "Contact: Bellevue (615) 862-5854.",
    category: "workshop",
    organizer: "Nashville Public Library — Bellevue",
    venue: "Bellevue Branch Library",
    address: "Bellevue, Nashville, TN",
    neighborhood: "Bellevue",
    rsvpUrl:
      "https://events.library.nashville.org/cal/event/eventView.do?b=de&href=/public/cals/MainCal/CAL-8a3e8e4c-9dd781ea-019d-dafd4af8-00006261.ics%2320260724T210000Z",
    sourceChannel: "library",
  },
  {
    id: "tn-exphrastic-poetry-ut-downtown-20260725",
    year: 2026,
    monthIndex: 6,
    day: 25,
    hour: 13,
    minute: 30,
    timeZone: TZ_EAST,
    title: "Exphrastic Poetry Performance — Beauford Delaney",
    tagline: "UT Downtown Gallery · Knoxville · 1:30 PM",
    description:
      "An afternoon of poetry inspired by Beauford Delaney's art at the UT Downtown Gallery in Knoxville. " +
      "Featuring readings by award-winning local and international poets.",
    category: "reading",
    organizer: "UT Downtown Gallery",
    venue: "UT Downtown Gallery",
    address: "106 S Gay St, Knoxville, TN 37902",
    neighborhood: "Knoxville",
    rsvpUrl:
      "https://www.facebook.com/events/106-s-gay-st-knoxville-tn-united-states-tennessee-37902/exphrastic-poetry-performance-beauford-delaney-degrees-of-separation/26223691273970442/",
    sourceChannel: "literary_org",
    price: "free",
  },
  {
    id: "tn-book-lovers-warehouse-signings-20260725",
    year: 2026,
    monthIndex: 6,
    day: 25,
    hour: 11,
    minute: 0,
    endHour: 15,
    endMinute: 0,
    timeZone: TZ_EAST,
    title: "Local Author Signings — Nancy Wade, Marcy Brennan & Paulette Buchanan",
    tagline: "Book Lover's Warehouse · Johnson City · 11:00 AM–3:00 PM",
    description:
      "Local author signings at Book Lover's Warehouse in Johnson City with Nancy Wade, Marcy Brennan, and Paulette Buchanan.",
    category: "reading",
    organizer: "Book Lover's Warehouse",
    venue: "Book Lover's Warehouse",
    address: "3302 W Market St, Johnson City, TN 37604",
    neighborhood: "Johnson City",
    rsvpUrl:
      "https://www.facebook.com/events/3302-w-market-st-johnson-city-tn-united-states-tennessee-37604/july-2026-local-author-signings-at-book-lovers-warehouse/1200543188879480/",
    sourceChannel: "bookstore",
    price: "free",
  },
  {
    id: "tn-michael-c-hardy-sycamore-shoals-20260725",
    year: 2026,
    monthIndex: 6,
    day: 25,
    hour: 14,
    minute: 0,
    endHour: 16,
    endMinute: 0,
    timeZone: TZ_EAST,
    title: "Meet the Author — Michael C. Hardy",
    tagline: "Sycamore Shoals State Historic Park · Elizabethton · 2:00 PM",
    description:
      "Meet the Author with Michael C. Hardy at Sycamore Shoals State Historic Park in Elizabethton, " +
      "discussing the American Revolution in the back-country.",
    category: "reading",
    organizer: "Sycamore Shoals State Historic Park",
    venue: "Sycamore Shoals State Historic Park",
    address: "1651 W Elk Ave, Elizabethton, TN 37643",
    neighborhood: "Elizabethton",
    rsvpUrl:
      "https://www.facebook.com/events/1651-w-elk-ave-elizabethton-tn-united-states-tennessee-37643/meet-the-author-michael-c-hardy/1644918296572374/",
    sourceChannel: "literary_org",
    price: "free",
  },
  {
    id: "tn-new-romantics-book-club-fever-dream-20260726",
    year: 2026,
    monthIndex: 6,
    day: 26,
    hour: 14,
    minute: 0,
    timeZone: TZ_CENTRAL,
    title: "The New Romantics Book Club — Fever Dream",
    tagline: "novel. · Memphis · 2:00 PM",
    description:
      "The New Romantics Book Club meets at novel. in Memphis to discuss Fever Dream.",
    category: "other",
    organizer: "novel.",
    venue: "novel.",
    address: "387 Perkins Ext, Memphis, TN 38117",
    neighborhood: "Memphis",
    rsvpUrl:
      "https://www.facebook.com/events/387-perkins-ext-memphis-tn-united-states-tennessee-38117/the-new-romantics-book-club-fever-dream/1324142156536899/",
    sourceChannel: "bookstore",
    price: "free",
  },
  {
    id: "tn-dw-gillespie-parnassus-20260729",
    year: 2026,
    monthIndex: 6,
    day: 29,
    hour: 18,
    minute: 30,
    timeZone: TZ_CENTRAL,
    title: "D.W. Gillespie Reading — The Doll House",
    tagline: "Parnassus Books · Nashville · 6:30 PM · Free",
    description:
      "Author D.W. Gillespie visits Parnassus Books for a reading of The Doll House. " +
      "This is the final event in the Summerween lineup. Attendees should bring their passport " +
      "to collect a stamp and enter the sweepstakes before the August 3rd deadline.",
    category: "reading",
    organizer: "Parnassus Books",
    venue: "Parnassus Books",
    address: "3900 Hillsboro Pike, Ste 14, Nashville, TN",
    neighborhood: "Nashville",
    rsvpUrl: "https://ma.to/event/dw-gillespie-the-doll-house-29-jul-2026",
    sourceChannel: "bookstore",
    price: "free",
  },
  {
    id: "tn-emily-b-martin-fable-hollow-20260730",
    year: 2026,
    monthIndex: 6,
    day: 30,
    hour: 19,
    minute: 0,
    endHour: 21,
    endMinute: 0,
    timeZone: TZ_EAST,
    title: "Emily B. Martin Author Event — Nell O'Dell Hates Quests",
    tagline: "Fable Hollow Coffee & Bookshoppe · Knoxville · 7:00 PM",
    description:
      "Emily B. Martin author event at Fable Hollow Coffee & Bookshoppe in Knoxville, " +
      "discussing Nell O'Dell Hates Quests.",
    category: "reading",
    organizer: "Fable Hollow Coffee & Bookshoppe",
    venue: "Fable Hollow Coffee & Bookshoppe",
    address: "Knoxville, TN",
    neighborhood: "Knoxville",
    rsvpUrl: "https://www.instagram.com/p/Daf1rQNOKYb/",
    sourceChannel: "bookstore",
    price: "free",
  },
  {
    id: "tn-mitchell-karnes-landmark-20260731",
    year: 2026,
    monthIndex: 6,
    day: 31,
    hour: 17,
    minute: 0,
    timeZone: TZ_CENTRAL,
    title: "Mitchell Karnes Book Release — Countdown",
    tagline: "Landmark Booksellers · Franklin · 5:00 PM",
    description:
      "Join Landmark Booksellers on Friday, July 31st at 5:00pm for an evening with author, speaker, and minister " +
      "Mitchell S. Karnes for the release of his newest book, Countdown — Book 4 in the Detective Abbey Rhodes Mysteries Series.",
    category: "reading",
    organizer: "Landmark Booksellers",
    venue: "Landmark Booksellers",
    address: "114 E Main St, Franklin, TN 37064",
    neighborhood: "Franklin",
    rsvpUrl: "https://www.landmarkbooksellers.com/event/mitchell-s-karnes-jul-2026",
    sourceChannel: "bookstore",
  },
  {
    id: "tn-landmark-eric-metaxas-20260724",
    year: 2026,
    monthIndex: 6,
    day: 24,
    hour: 14,
    minute: 0,
    timeZone: TZ_CENTRAL,
    title: "An Evening with Eric Metaxas: Revolution",
    tagline: "Landmark Booksellers · Franklin · Author Event · 2:00 PM & 6:00 PM",
    description:
      "An evening with seven-time New York Times bestselling author Eric Metaxas for the release of his new book, Revolution — " +
      "an epic of America's birth, from Lexington and Concord to Yorktown. " +
      "Two showtimes: 2:00 PM (tickets available) and 6:00 PM (sold out; wait list available). " +
      "Tickets: $15 entry, or $45 with a signed copy.",
    category: "reading",
    organizer: "Landmark Booksellers",
    venue: "Landmark Booksellers",
    address: "114 East Main Street, Franklin, TN 37064",
    neighborhood: "Franklin",
    rsvpUrl:
      "https://www.landmarkbooksellers.com/event/an-evening-with-eric-metaxas-revolution-jul-2026",
    sourceChannel: "bookstore",
    price: "paid",
  },
  {
    id: "tn-landmark-gail-southwell-20260725",
    year: 2026,
    monthIndex: 6,
    day: 25,
    hour: 14,
    minute: 0,
    timeZone: TZ_CENTRAL,
    title: "Gail Southwell Book Signing — Lessons in Leadership, Laughter…",
    tagline: "Landmark Booksellers · Franklin · Signing",
    description:
      "Book signing with Gail Southwell, author of Lessons in Leadership, Laughter, and more. Free to attend; please RSVP.",
    category: "reading",
    organizer: "Landmark Booksellers",
    venue: "Landmark Booksellers",
    address: "114 E Main St, Franklin, TN 37064",
    neighborhood: "Franklin",
    rsvpUrl: "https://www.landmarkbooksellers.com/event/gail-southwell-jul-2026",
    sourceChannel: "bookstore",
  },
  {
    id: "tn-landmark-jenny-carlton-20260731",
    year: 2026,
    monthIndex: 6,
    day: 31,
    hour: 12,
    minute: 0,
    timeZone: TZ_CENTRAL,
    title: "Jenny Carlton Book Talk & Signing — 28 Day Myth",
    tagline: "Landmark Booksellers · Franklin · Author talk & signing",
    description:
      "Join local author Jenny Carlton for a book talk and signing celebrating her new book, 28 Day Myth: What families need to know about addiction, relapse and real healing. Free to attend; please RSVP.",
    category: "reading",
    organizer: "Landmark Booksellers",
    venue: "Landmark Booksellers",
    address: "114 E Main St, Franklin, TN 37064",
    neighborhood: "Franklin",
    rsvpUrl: "https://www.landmarkbooksellers.com/event/jenny-carlton-jul-2026",
    sourceChannel: "bookstore",
  },
  {
    id: "tn-landmark-hope-beryl-green-20260801",
    year: 2026,
    monthIndex: 7,
    day: 1,
    hour: 17,
    minute: 0,
    timeZone: TZ_CENTRAL,
    title: "Hope Beryl Green Book Release — From Hell to Hope",
    tagline: "Landmark Booksellers · Franklin · Book release",
    description:
      "Book release of From Hell to Hope: A Survivor's Story of Healing by Hope Beryl-Green. Free to attend; please RSVP.",
    category: "reading",
    organizer: "Landmark Booksellers",
    venue: "Landmark Booksellers",
    address: "114 E Main St, Franklin, TN 37064",
    neighborhood: "Franklin",
    rsvpUrl: "https://www.landmarkbooksellers.com/event/hope-beryl-green-aug-2026",
    sourceChannel: "bookstore",
  },
  {
    id: "tn-landmark-dorena-williamson-20260815",
    year: 2026,
    monthIndex: 7,
    day: 15,
    hour: 13,
    minute: 0,
    timeZone: TZ_CENTRAL,
    title: "Dorena Williamson Book Release — Love Lives On",
    tagline: "Landmark Booksellers · Franklin · Children's book release",
    description:
      "Join local author Dorena Williamson for the release of her new children's book, Love Lives On, a gentle, honest picture book that helps children navigate grief and loss. Free to attend; please RSVP.",
    category: "reading",
    organizer: "Landmark Booksellers",
    venue: "Landmark Booksellers",
    address: "114 E Main St, Franklin, TN 37064",
    neighborhood: "Franklin",
    rsvpUrl: "https://www.landmarkbooksellers.com/event/dorena-williamson-aug-2026",
    sourceChannel: "bookstore",
  },
  {
    id: "tn-landmark-writers-open-mic-20260820",
    year: 2026,
    monthIndex: 7,
    day: 20,
    hour: 18,
    minute: 0,
    timeZone: TZ_CENTRAL,
    title: "Writer's Open Mic Night",
    tagline: "Landmark Booksellers · Franklin · Open mic",
    description:
      "An open mic for local writers of poetry, fiction, flash fiction, spoken word, and singer-songwriters. Bring your friends and family. Free to attend; register to perform.",
    category: "open-mic",
    organizer: "Landmark Booksellers",
    venue: "Landmark Booksellers",
    address: "114 E Main St, Franklin, TN 37064",
    neighborhood: "Franklin",
    rsvpUrl: "https://www.landmarkbooksellers.com/event/writers-open-mic-night-aug-2026",
    sourceChannel: "bookstore",
  },
  {
    id: "tn-landmark-yance-wyatt-20260822",
    year: 2026,
    monthIndex: 7,
    day: 22,
    hour: 17,
    minute: 0,
    timeZone: TZ_CENTRAL,
    title: "Yance Wyatt Book Release — The Watersmith",
    tagline: "Landmark Booksellers · Franklin · Book release",
    description:
      "Join Nashville author Yance Wyatt for the release of his novel, The Watersmith, a haunting Smoky Mountain tale of love, regret, and memory. Free to attend; please RSVP.",
    category: "reading",
    organizer: "Landmark Booksellers",
    venue: "Landmark Booksellers",
    address: "114 E Main St, Franklin, TN 37064",
    neighborhood: "Franklin",
    rsvpUrl: "https://www.landmarkbooksellers.com/event/yance-wyatt-aug-2026",
    sourceChannel: "bookstore",
  },
  {
    id: "tn-landmark-nathan-carter-johnson-20260827",
    year: 2026,
    monthIndex: 7,
    day: 27,
    hour: 18,
    minute: 0,
    timeZone: TZ_CENTRAL,
    title: "Nathan Carter Johnson Book Release — Surely Goodness and Mercy",
    tagline: "Landmark Booksellers · Franklin · Book release",
    description:
      "Join local author Nathan Johnson for the release of his new book, Surely Goodness and Mercy, a narrative retelling of Psalm 23. Illustrator Sarah Howell joins him. Free to attend; please RSVP.",
    category: "reading",
    organizer: "Landmark Booksellers",
    venue: "Landmark Booksellers",
    address: "114 E Main St, Franklin, TN 37064",
    neighborhood: "Franklin",
    rsvpUrl: "https://www.landmarkbooksellers.com/event/nathan-carter-johnson-aug-2026",
    sourceChannel: "bookstore",
  },
  {
    id: "tn-npl-yance-wyatt-watersmith-20260816",
    year: 2026,
    monthIndex: 7,
    day: 16,
    hour: 15,
    minute: 0,
    timeZone: TZ_CENTRAL,
    title: "Author Yance Wyatt Reads: The Watersmith",
    tagline: "Nashville Public Library · Main Library · Special Collections Center",
    description:
      "Author Yance Wyatt reads from The Watersmith at the Nashville Public Library Main Library, " +
      "Special Collections Center, 2nd Floor.",
    category: "reading",
    organizer: "Nashville Public Library",
    venue: "Main Library — Special Collections Center, 2nd Floor",
    address: "Nashville, TN",
    neighborhood: "Downtown Nashville",
    rsvpUrl: NPL_EVENTS_URL,
    sourceChannel: "library",
  },
  {
    id: "tn-cmcpl-branching-out-book-club-20260804",
    year: 2026,
    monthIndex: 7,
    day: 4,
    hour: 14,
    minute: 0,
    endHour: 15,
    endMinute: 0,
    timeZone: TZ_CENTRAL,
    title: "Branching Out Book Club — The Last One at the Wedding",
    tagline: "Clarksville-Montgomery County Public Library · North Branch · Adult",
    description:
      "Join Branching Out Book Club for a discussion of The Last One at the Wedding by Jason Rekulak, " +
      "and get a copy of the next read, Everyone in My Family Has Killed Someone by Benjamin Stevenson. " +
      "In person at North Branch Meeting Room 1.",
    category: "other",
    organizer: "Clarksville-Montgomery County Public Library",
    venue: "North Branch Meeting Room 1",
    address: "435 Jordan Road, Clarksville, TN 37042",
    neighborhood: "Clarksville",
    rsvpUrl: "https://mcgtn.libcal.com/event/17002797",
    sourceChannel: "library",
  },
  {
    id: "tn-cmcpl-as-the-page-turns-20260820",
    year: 2026,
    monthIndex: 7,
    day: 20,
    hour: 14,
    minute: 0,
    endHour: 15,
    endMinute: 30,
    timeZone: TZ_CENTRAL,
    title: "As The Page Turns Book Club — The God of the Woods",
    tagline: "Clarksville-Montgomery County Public Library · Glass Study Room · Adult",
    description:
      "Join As The Page Turns Book Club for a discussion of The God of the Woods by Liz Moore. " +
      "In person in the Glass Study Room.",
    category: "other",
    organizer: "Clarksville-Montgomery County Public Library",
    venue: "Glass Study Room",
    address: "Clarksville, TN",
    neighborhood: "Clarksville",
    rsvpUrl: "https://mcgtn.libcal.com/event/15766065",
    sourceChannel: "library",
  },
  {
    id: "tn-cmcpl-branching-out-book-club-20260901",
    year: 2026,
    monthIndex: 8,
    day: 1,
    hour: 14,
    minute: 0,
    endHour: 15,
    endMinute: 0,
    timeZone: TZ_CENTRAL,
    title: "Branching Out Book Club — Everyone in My Family Has Killed Someone",
    tagline: "Clarksville-Montgomery County Public Library · North Branch · Adult",
    description:
      "Join Branching Out Book Club for a discussion of Everyone in My Family Has Killed Someone by Benjamin Stevenson, " +
      "and get a copy of the next read, The Widow by John Grisham. " +
      "In person at North Branch Meeting Room 1.",
    category: "other",
    organizer: "Clarksville-Montgomery County Public Library",
    venue: "North Branch Meeting Room 1",
    address: "435 Jordan Road, Clarksville, TN 37042",
    neighborhood: "Clarksville",
    rsvpUrl: "https://mcgtn.libcal.com/event/17002807",
    sourceChannel: "library",
  },
  {
    id: "tn-cmcpl-as-the-page-turns-20260917",
    year: 2026,
    monthIndex: 8,
    day: 17,
    hour: 14,
    minute: 0,
    endHour: 15,
    endMinute: 30,
    timeZone: TZ_CENTRAL,
    title: "As The Page Turns Book Club — The Women",
    tagline: "Clarksville-Montgomery County Public Library · Glass Study Room · Adult",
    description:
      "Join As The Page Turns Book Club for a discussion of The Women by Kristin Hannah. " +
      "In person in the Glass Study Room.",
    category: "other",
    organizer: "Clarksville-Montgomery County Public Library",
    venue: "Glass Study Room",
    address: "Clarksville, TN",
    neighborhood: "Clarksville",
    rsvpUrl: "https://mcgtn.libcal.com/event/15766066",
    sourceChannel: "library",
  },
  {
    id: "tn-cmcpl-as-the-page-turns-20261015",
    year: 2026,
    monthIndex: 9,
    day: 15,
    hour: 14,
    minute: 0,
    endHour: 15,
    endMinute: 30,
    timeZone: TZ_CENTRAL,
    title: "As The Page Turns Book Club — We Were Never Here",
    tagline: "Clarksville-Montgomery County Public Library · Glass Study Room · Adult",
    description:
      "Please join As The Page Turns Book Club for a discussion of We Were Never Here by Andrea Bartz. " +
      "In person in the Glass Study Room.",
    category: "other",
    organizer: "Clarksville-Montgomery County Public Library",
    venue: "Glass Study Room",
    address: "Clarksville, TN",
    neighborhood: "Clarksville",
    rsvpUrl: "https://mcgtn.libcal.com/event/15766067",
    sourceChannel: "library",
  },
  {
    id: "tn-cmcpl-branching-out-book-club-20261103",
    year: 2026,
    monthIndex: 10,
    day: 3,
    hour: 14,
    minute: 0,
    endHour: 15,
    endMinute: 0,
    timeZone: TZ_CENTRAL,
    title: "Branching Out Book Club — The Tenant",
    tagline: "Clarksville-Montgomery County Public Library · North Branch · Adult",
    description:
      "Join Branching Out Book Club for a discussion of The Tenant by Freida McFadden, " +
      "and grab a copy of the next read, Project Hail Mary by Andy Weir. " +
      "In person at North Branch Meeting Room 1.",
    category: "other",
    organizer: "Clarksville-Montgomery County Public Library",
    venue: "North Branch Meeting Room 1",
    address: "435 Jordan Road, Clarksville, TN 37042",
    neighborhood: "Clarksville",
    rsvpUrl: "https://mcgtn.libcal.com/event/17002856",
    sourceChannel: "library",
  },
  {
    id: "tn-maury-summer-reading-finale-20260801",
    year: 2026,
    monthIndex: 7,
    day: 1,
    hour: 10,
    minute: 0,
    endHour: 11,
    endMinute: 0,
    timeZone: TZ_CENTRAL,
    title: "Summer Reading Finale Party",
    tagline: "Maury County Public Library · Maury Co. Park · Columbia",
    description:
      "Join us at the Maury Co. Park to celebrate an awesome summer of reading together!",
    category: "other",
    organizer: "Maury County Public Library",
    venue: "Maury County Park",
    address: "1018 Maury County Park Drive, Columbia, TN 38401",
    neighborhood: "Columbia",
    rsvpUrl: "https://www.maurycounty-tn.gov/Calendar.aspx?EID=2658",
    sourceChannel: "library",
  },
  {
    id: "tn-poets-playground-alondus-20260724",
    year: 2026,
    monthIndex: 6,
    day: 24,
    hour: 19,
    minute: 30,
    endHour: 22,
    endMinute: 30,
    timeZone: TZ_CENTRAL,
    title: "Poet's Playground — Headlining Alondus",
    tagline: "Island Vibes Restaurant · Nashville · Poetry open mic · $10",
    description:
      "Poet's Playground is a Nashville poetry night and open mic for poetry and spoken word, " +
      "this evening headlined by Alondus. Every 2nd and 4th Friday at Island Vibes Restaurant and Lounge — " +
      "Caribbean food, drinks, free parking, and an open mic. Eventbrite tickets $10; payment at the door accepted ($15+).",
    category: "reading",
    organizer: "Poet's Playground",
    venue: "Island Vibes Restaurant and Lounge",
    address: "1316 Antioch Pike, Nashville, TN 37211",
    neighborhood: "Nashville",
    rsvpUrl:
      "https://www.facebook.com/events/island-vibes-restaurant/poets-playground-headlining-alondus/1107248584793605/",
    sourceChannel: "literary_org",
    price: "paid",
  },
  {
    id: "tn-vintage-bean-open-mic-matt-awesome-20260731",
    year: 2026,
    monthIndex: 6,
    day: 31,
    hour: 19,
    minute: 0,
    endHour: 21,
    endMinute: 0,
    timeZone: TZ_CENTRAL,
    title: "Open Mic Night with Matt Awesome",
    tagline: "The Vintage Bean Cafe · Joelton · Last Friday · Purchase required",
    description:
      "All-new open mic with Matt Awesome in an intimate setting at The Vintage Bean Cafe — " +
      "spoken word, poetry, comedy, songwriting, and magic welcome. A safe space to try new material. " +
      "Every last Friday of the month, 7:00–9:00pm. No sign-up needed; purchase necessary to attend. " +
      "Food, local Tennessee craft beers, hard cider, and hard kombucha available.",
    category: "reading",
    organizer: "The Vintage Bean Cafe",
    venue: "The Vintage Bean Cafe",
    address: "1259 Jackson Felts Rd Unit B, Joelton, TN",
    neighborhood: "Joelton",
    rsvpUrl:
      "https://www.facebook.com/events/1259-jackson-felts-rd-unit-b-joelton-tn/open-mic-night-with-matt-awesome/1640233307050793/",
    sourceChannel: "literary_org",
  },
  ...["2026-09-11", "2026-10-09", "2026-11-13"].map((date) => {
    const [y, m, d] = date.split("-").map(Number);
    return {
      id: `tn-poettea-open-mic-${date.replaceAll("-", "")}`,
      year: y,
      monthIndex: m - 1,
      day: d,
      hour: 18,
      minute: 0,
      endHour: 19,
      endMinute: 30,
      timeZone: TZ_EAST,
      title: "PoetTEA Open Mic Poetry",
      tagline:
        "The Philosopher's House · Johnson City · Free · 2nd Friday · Drop-in",
      description:
        "Monthly open mic for poetry and community at The Philosopher's House, " +
        "co-hosted with members of the Poetry Society of Tennessee and the Philosopher's House Writer's Workshop. " +
        "Fireplace/living room, 1st floor. Sign-ups begin at 5:45pm; spots limited to 4 minutes per poet. " +
        "Drop-in, no pre-registration. Free to attend — food and drink purchases encouraged to support the teahouse nonprofit.",
      category: "reading" as const,
      organizer: "The Philosopher's House",
      venue: "The Philosopher's House",
      address: "117 W Fairview Ave, Johnson City, TN 37604",
      neighborhood: "Johnson City",
      rsvpUrl: "https://www.facebook.com/events/1051915043833858/",
      sourceChannel: "literary_org" as const,
      price: "free" as const,
    };
  }),
  {
    id: "tn-down-home-september-open-poetry-20260907",
    year: 2026,
    monthIndex: 8,
    day: 7,
    hour: 18,
    minute: 45,
    endHour: 21,
    endMinute: 0,
    timeZone: TZ_EAST,
    title: "September Open Poetry",
    tagline: "The Down Home · Johnson City · Open mic · Sign-up at 6:45",
    description:
      "Come along and read your work, and listen to some fine local wordsmiths at The Down Home. " +
      "Sign up when you arrive — the list opens at 6:45pm and fills quickly, so arrive early. " +
      "Two rounds, about eighteen readers total, with a few alternate slots if time allows. " +
      "No more than 4 minutes per poet, per round.",
    category: "reading",
    organizer: "The Down Home",
    venue: "The Down Home",
    address: "300 W Main St, Johnson City, TN 37604",
    neighborhood: "Johnson City",
    rsvpUrl: "https://visitjohnsoncitytn.com/event/september-open-poetry/",
    sourceChannel: "literary_org",
  },
  {
    id: "tn-shelby-bottoms-nature-poetry-20260821",
    year: 2026,
    monthIndex: 7,
    day: 21,
    hour: 18,
    minute: 30,
    endHour: 19,
    endMinute: 30,
    timeZone: TZ_CENTRAL,
    title: "Nature Poetry",
    tagline:
      "Shelby Bottoms Nature Center · Nashville · Free · Ages 18+ · Reserve a spot",
    description:
      "Nature is featured often in poetry—come explore some contemporary poetry featuring nature, " +
      "and learn how and why it's used so often in this literary art. Ages 18+; registration required. " +
      "Free parking available.",
    category: "workshop",
    organizer: "Shelby Bottoms Nature Center",
    venue: "Shelby Bottoms Nature Center & Greenway",
    address: "1900 Shelby Bottoms Greenway, Nashville, TN 37206",
    neighborhood: "Nashville",
    rsvpUrl: "https://www.eventbrite.com/e/nature-poetry-tickets-1993052288045",
    sourceChannel: "eventbrite",
    price: "free",
  },
  {
    id: "tn-eb-larkspur-book-club-magical-thinking-20260730",
    year: 2026,
    monthIndex: 6,
    day: 30,
    hour: 11,
    minute: 0,
    endHour: 12,
    endMinute: 30,
    timeZone: TZ_CENTRAL,
    title: "Larkspur Book Club: The Year of Magical Thinking",
    tagline:
      "Larkspur Conservation · Nashville · Free · Limited registration",
    description:
      "Larkspur Book Club discusses Joan Didion's award-winning memoir The Year of Magical Thinking. " +
      "First 30 minutes for tea, snacks, and mingling, then a one-hour discussion. " +
      "Bring your own copy or borrow from Nashville Public Library. Registration extremely limited.",
    category: "other",
    organizer: "Larkspur Conservation",
    venue: "Larkspur Conservation — Library and Learning Center",
    address: "306 42nd Avenue North, Nashville, TN 37209",
    neighborhood: "West Nashville",
    rsvpUrl:
      "https://www.eventbrite.com/e/larkspur-book-club-the-year-of-magical-thinking-tickets-1984975005676",
    sourceChannel: "eventbrite",
    price: "free",
  },
  {
    id: "tn-eb-well-read-silent-reading-20260820",
    year: 2026,
    monthIndex: 7,
    day: 20,
    hour: 18,
    minute: 0,
    endHour: 20,
    endMinute: 0,
    timeZone: TZ_CENTRAL,
    title: "Well Read: The Silent Reading Experience",
    tagline:
      "The Loading Dock Cafe · Nashville · Free · Nashville Black Literacy Coalition",
    description:
      "A cozy night of literature and connection hosted by the Nashville Black Literacy Coalition. " +
      "Bring your own book or choose one from a curated selection. " +
      "Nashville Public Library will be on site to help guests sign up for library cards — bring ID if you'd like to register.",
    category: "other",
    organizer: "Nashville Black Literacy Coalition",
    venue: "The Loading Dock Cafe",
    address: "906 Buchanan Street, Nashville, TN 37208",
    neighborhood: "North Nashville",
    rsvpUrl:
      "https://www.eventbrite.com/e/well-read-the-silent-reading-experience-tickets-1994010103898",
    sourceChannel: "eventbrite",
    price: "free",
  },
  {
    id: "tn-eb-penned-by-fate-kickstarter-launch-20261010",
    year: 2026,
    monthIndex: 9,
    day: 10,
    hour: 16,
    minute: 0,
    endHour: 18,
    endMinute: 0,
    timeZone: TZ_CENTRAL,
    title: "Kickstarter Launch Party: Penned by Fate with Beth DeWeese",
    tagline: "Creative Corner · Nashville · Free · Author launch party",
    description:
      "Celebrate Nashville author Beth DeWeese's Kickstarter launch of Penned by Fate " +
      "(The Spelled Inkwell, Book 1), a cozy fantasy romance set in a magic stationery shop. " +
      "Meet the author, hear about the book, and join as the Kickstarter goes live. Free; registration required.",
    category: "reading",
    organizer: "CoraCreaCrafts",
    venue: "Creative Corner",
    address: "501 Metroplex Drive #117, Nashville, TN 37211",
    neighborhood: "Nashville",
    rsvpUrl:
      "https://www.eventbrite.com/e/kickstarter-launch-party-penned-by-fate-with-beth-deweese-tickets-1993988821241",
    sourceChannel: "eventbrite",
    price: "free",
  },
  {
    id: "tn-last-tuesdays-pink-cactus-20260728",
    year: 2026,
    monthIndex: 6,
    day: 28,
    hour: 20,
    minute: 0,
    timeZone: TZ_EAST,
    title: "Last Tuesdays",
    tagline: "The Pink Cactus · Knoxville · Free · Standup, poetry & music",
    description:
      "On the last Tuesday of every month, Joel Palilla and Sadie Izo bring a free standup, poetry, " +
      "and music variety show to The Pink Cactus. Come support local performing artists.",
    category: "reading",
    organizer: "The Comedy Sphere",
    venue: "The Pink Cactus",
    address: "1147 Sevier Ave, Knoxville, TN 37920",
    neighborhood: "Knoxville",
    rsvpUrl:
      "https://www.facebook.com/events/the-pink-cactus/last-tuesdays/999307872960924/",
    sourceChannel: "literary_org",
    price: "free",
  },
  {
    id: "tn-rncs-rhyme-over-wine-20260809",
    year: 2026,
    monthIndex: 7,
    day: 9,
    hour: 18,
    minute: 0,
    endHour: 19,
    endMinute: 0,
    timeZone: TZ_EAST,
    title:
      "RNC's Rhyme – Over Wine Open Mic Poetry Mixer (featuring spoken word artist Kelly Watts Williams)",
    tagline: "Lady Naps Winery · Chattanooga · Free · Open mic · Donations accepted",
    description:
      "Free open mic poetry mixer featuring spoken word artist Kelly Watts Williams. " +
      "Evening begins with open mic, then featured performance. Donations accepted. " +
      "Supported by Lyndhurst Foundation and Arts Build. " +
      "Contact: rncpoetry@gmail.com · 423-504-0361.",
    category: "reading",
    organizer: "RNC's Poetry (Rhyme CORGEO)",
    venue: "Lady Naps Winery",
    address: "6940 Lee Hwy, Ste 103, Chattanooga, TN 37421",
    neighborhood: "Chattanooga",
    rsvpUrl:
      "https://ladynaps.com/event/rncs-rhyme-over-wine-open-mic-poetry-mixer-8/",
    sourceChannel: "literary_org",
    price: "free",
  },
  {
    id: "tn-plenty-bringabook-evening-20260727",
    year: 2026,
    monthIndex: 6,
    day: 27,
    hour: 18,
    minute: 0,
    endHour: 19,
    endMinute: 30,
    timeZone: TZ_CENTRAL,
    title: "Bringabook Book Club — Evening Edition",
    tagline: "PLENTY Downtown Bookshop · Cookeville",
    description:
      "The book club where everyone brings a different book! We share our favorite books, get great ideas for our next read, and have an awesome time doing it.",
    category: "other",
    organizer: "PLENTY Downtown Bookshop",
    venue: "PLENTY Downtown Bookshop",
    address: "41 W Broad St, Cookeville, TN 38501",
    neighborhood: "Cookeville",
    rsvpUrl: PLENTY_EVENTS_URL,
    sourceChannel: "bookstore",
  },
  ...PLENTY_WRITE_INS,
  ...PLENTY_SECOND_SATURDAYS,
  ...PLENTY_WRITERS_WORKSHOPS,
  ...PLENTY_SAWMILL_POETRY,
  ...PLENTY_TALES_ON_THE_TRAIL,
  ...PLENTY_BOOKED_AND_UNPLUGGED,
  ...PLENTY_ONE_OFFS,
  ...UNION_AVE_EVENTS,
  ...NPL_WRITING_EVENTS,
];

export type TennesseeCuratedMeta = {
  curatedTotal: number;
  rowsInMonth: number;
  canceledInMonth: number;
};

function mapSpec(spec: CuratedSpec): WorkshopEvent {
  const start = DateTime.fromObject(
    {
      year: spec.year,
      month: spec.monthIndex + 1,
      day: spec.day,
      hour: spec.hour,
      minute: spec.minute,
      second: 0,
      millisecond: 0,
    },
    { zone: spec.timeZone },
  );

  const end =
    spec.endHour != null
      ? DateTime.fromObject(
          {
            year: spec.year,
            month: spec.monthIndex + 1,
            day: spec.day,
            hour: spec.endHour,
            minute: spec.endMinute ?? 0,
            second: 0,
            millisecond: 0,
          },
          { zone: spec.timeZone },
        )
      : null;

  let tagline = spec.tagline;
  if (spec.timeTbd) tagline = `${tagline} · Time TBD`;
  if (spec.canceled) tagline = `Canceled · ${tagline}`;

  const title = spec.canceled ? `Canceled: ${spec.title}` : spec.title;

  return {
    id: spec.id,
    cityId: "tn",
    title,
    tagline,
    description: spec.description,
    start: start.toISO() ?? start.toString(),
    end: end ? (end.toISO() ?? undefined) : undefined,
    timeZone: spec.timeZone,
    format: "in-person",
    price: spec.price ?? "unknown",
    category: spec.category,
    organizer: spec.organizer,
    venue: spec.venue,
    address: spec.address,
    neighborhood: spec.neighborhood,
    rsvpUrl: spec.rsvpUrl,
    source: "Tennessee curated listings",
    sourceChannel: spec.sourceChannel,
    listingProvenance: "live",
  };
}

export function fetchTennesseeCuratedEventsForMonth(
  year: number,
  monthIndex: number,
): { events: WorkshopEvent[]; meta: TennesseeCuratedMeta } {
  const monthSpecs = EVENTS.filter(
    (e) => e.year === year && e.monthIndex === monthIndex,
  );
  const inMonth = monthSpecs.map(mapSpec);

  inMonth.sort(
    (a, b) => new Date(a.start).getTime() - new Date(b.start).getTime(),
  );

  return {
    events: inMonth,
    meta: {
      curatedTotal: EVENTS.length,
      rowsInMonth: inMonth.length,
      canceledInMonth: monthSpecs.filter((e) => e.canceled).length,
    },
  };
}
