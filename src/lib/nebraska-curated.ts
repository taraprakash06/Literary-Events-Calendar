import { DateTime } from "luxon";
import type {
  WorkshopEvent,
  WorkshopEventCategory,
} from "@/lib/workshop-types";

/** Omaha and Lincoln are both Central Time. */
const TZ = "America/Chicago";

const BOOKWORM_ADDRESS = "2501 South 90th Street Suite 111, Omaha, NE 68124";
const FRANCIE_ADDRESS = "130 S. 13th Street, Lincoln, NE 68508";
const LARKSONG_ADDRESS = "1600 N. Cotner Blvd, Lincoln, NE 68505";
const LOCAL_ART_PLUG_ADDRESS = "1722 St. Marys Ave Suite 110, Omaha, NE 68102";
const BENSON_BRANCH_ADDRESS = "6015 Binney Street, Omaha, NE 68104";
const CENTRAL_LIBRARY_ADDRESS = "7205 Dodge St, Omaha, NE 68114";

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
  title: string;
  tagline: string;
  description: string;
  category: WorkshopEventCategory;
  organizer: string;
  venue: string;
  address: string;
  neighborhood: string;
  rsvpUrl?: string;
  rsvpIsGeneralCalendar?: boolean;
  sourceChannel: WorkshopEvent["sourceChannel"];
  source?: string;
  price?: WorkshopEvent["price"];
  priceDetail?: string;
  format?: WorkshopEvent["format"];
  virtualLabel?: string;
};

const CURATED: CuratedSpec[] = [
  ...poetryMenuEvents(),

  // ── The Bookworm (Omaha) ──────────────────────────────────────────
  {
    id: "ne-bookworm-nora-barth-time-warden-20260725",
    year: 2026,
    monthIndex: 6,
    day: 25,
    hour: 14,
    minute: 0,
    endHour: 15,
    endMinute: 30,
    timeZone: TZ,
    title: 'Nora Barth — The Time Warden',
    tagline: "The Bookworm · Omaha · Free · Signing & discussion",
    description:
      "Local author Nora Barth signs and discusses her debut novel The Time Warden — a story of a boy in a helmet, a girl in a mask, and one fateful night that turns them into each other's worst enemies.",
    category: "reading",
    organizer: "The Bookworm",
    venue: "The Bookworm",
    address: BOOKWORM_ADDRESS,
    neighborhood: "Omaha",
    rsvpUrl:
      "https://bookwormomaha.com/event/2026-07-25/nora-barth-will-sign-discuss-time-warden",
    sourceChannel: "bookstore",
    price: "free",
  },
  {
    id: "ne-bookworm-ashten-arkfeld-anxious-ashten-20260802",
    year: 2026,
    monthIndex: 7,
    day: 2,
    hour: 11,
    minute: 0,
    endHour: 12,
    endMinute: 0,
    timeZone: TZ,
    title: 'Ashten Arkfeld — Anxious Ashten',
    tagline: "The Bookworm · Omaha · Children's · Free",
    description:
      "Ashten Arkfeld reads and signs Anxious Ashten: A Child's Perspective on Anxiety — a picture-book look at childhood anxiety for young readers and families.",
    category: "reading",
    organizer: "The Bookworm",
    venue: "The Bookworm",
    address: BOOKWORM_ADDRESS,
    neighborhood: "Omaha",
    rsvpUrl:
      "https://bookwormomaha.com/event/2026-08-02/ashten-arkfeld-will-sign-anxious-ashten",
    sourceChannel: "bookstore",
    price: "free",
  },
  {
    id: "ne-bookworm-colleen-morton-busch-smolder-20260805",
    year: 2026,
    monthIndex: 7,
    day: 5,
    hour: 18,
    minute: 0,
    endHour: 19,
    endMinute: 30,
    timeZone: TZ,
    title: 'Colleen Morton Busch — Smolder (with Shyla Shehan)',
    tagline: "The Bookworm · Omaha · Poetry · Free",
    description:
      "Colleen Morton Busch reads from Smolder, winner of the 2025 Richard-Gabriel Rummonds Poetry Prize, exploring the many kinds of fire blazing inside a life. Omaha poet Shyla Shehan (Mining the Gap) reads as well.",
    category: "reading",
    organizer: "The Bookworm",
    venue: "The Bookworm",
    address: BOOKWORM_ADDRESS,
    neighborhood: "Omaha",
    rsvpUrl:
      "https://bookwormomaha.com/event/2026-08-05/colleen-morton-busch-will-sign-smolder",
    sourceChannel: "bookstore",
    price: "free",
  },
  {
    id: "ne-bookworm-tipler-christiansen-luigi-20260816",
    year: 2026,
    monthIndex: 7,
    day: 16,
    hour: 14,
    minute: 0,
    endHour: 15,
    endMinute: 30,
    timeZone: TZ,
    title: 'Doyle Tipler & Erich Christiansen — The History of Luigi Inc.',
    tagline: "The Bookworm · Omaha · Free · Signing",
    description:
      "Doyle Tipler and Erich Christiansen sign The History of Luigi Inc. at The Bookworm.",
    category: "reading",
    organizer: "The Bookworm",
    venue: "The Bookworm",
    address: BOOKWORM_ADDRESS,
    neighborhood: "Omaha",
    rsvpUrl:
      "https://bookwormomaha.com/event/2026-08-16/doyle-tipler-erich-christiansen-will-sign-history-luigi-inc",
    sourceChannel: "bookstore",
    price: "free",
  },
  {
    id: "ne-bookworm-ariel-lawhon-pirate-queen-20260912",
    year: 2026,
    monthIndex: 8,
    day: 12,
    hour: 18,
    minute: 0,
    endHour: 20,
    endMinute: 0,
    timeZone: TZ,
    title: "Ariel Lawhon — The Pirate Queen",
    tagline: "The Bookworm · Omaha Scottish Rite · Ticketed",
    description:
      "The Bookworm presents an evening with New York Times bestselling author Ariel Lawhon for her new novel The Pirate Queen at the Omaha Scottish Rite. General admission ($39) via Eventbrite includes one copy of the book and admission for one person.",
    category: "reading",
    organizer: "The Bookworm",
    venue: "The Omaha Scottish Rite",
    address: "202 S. 20th Street, Omaha, NE 68102",
    neighborhood: "Omaha",
    rsvpUrl:
      "https://bookwormomaha.com/event/2026-09-12/evening-ariel-lawhon-ticketed-event",
    sourceChannel: "bookstore",
    price: "paid",
  },
  {
    id: "ne-bookworm-william-kent-krueger-gods-country-20261003",
    year: 2026,
    monthIndex: 9,
    day: 3,
    hour: 14,
    minute: 0,
    endHour: 15,
    endMinute: 30,
    timeZone: TZ,
    title: "William Kent Krueger — God's Country",
    tagline: "The Bookworm · Omaha · Free · Signing",
    description:
      "William Kent Krueger discusses and signs God's Country, book #22 in the Cork O'Connor mystery series — an action-packed return to Omaha for the Edgar Award–winning author of Ordinary Grace and This Tender Land.",
    category: "reading",
    organizer: "The Bookworm",
    venue: "The Bookworm",
    address: BOOKWORM_ADDRESS,
    neighborhood: "Omaha",
    rsvpUrl:
      "https://bookwormomaha.com/event/2026-10-03/william-kent-krueger-will-sign-gods-country",
    sourceChannel: "bookstore",
    price: "free",
  },
  {
    id: "ne-bookworm-ml-rio-hot-wax-20261014",
    year: 2026,
    monthIndex: 9,
    day: 14,
    hour: 18,
    minute: 0,
    endHour: 19,
    endMinute: 30,
    timeZone: TZ,
    title: 'M.L. Rio — Hot Wax',
    tagline: "The Bookworm · Omaha · Free · Signing",
    description:
      "M.L. Rio — author of If We Were Villains — signs Hot Wax at The Bookworm.",
    category: "reading",
    organizer: "The Bookworm",
    venue: "The Bookworm",
    address: BOOKWORM_ADDRESS,
    neighborhood: "Omaha",
    rsvpUrl: "https://bookwormomaha.com/event/2026-10-14/ml-rio-will-sign-hot-wax",
    sourceChannel: "bookstore",
    price: "free",
  },
  {
    id: "ne-bookworm-mary-pipher-letters-20261020",
    year: 2026,
    monthIndex: 9,
    day: 20,
    hour: 18,
    minute: 0,
    endHour: 19,
    endMinute: 30,
    timeZone: TZ,
    title: 'Mary Pipher — Letters to a Young Therapist',
    tagline: "The Bookworm · Omaha · Free · Signing",
    description:
      "Nebraska psychologist and bestselling author Mary Pipher (Reviving Ophelia, Women Rowing North) signs Letters to a Young Therapist at The Bookworm.",
    category: "reading",
    organizer: "The Bookworm",
    venue: "The Bookworm",
    address: BOOKWORM_ADDRESS,
    neighborhood: "Omaha",
    rsvpUrl:
      "https://bookwormomaha.com/event/2026-10-20/mary-pipher-will-sign-letters-young-therapist",
    sourceChannel: "bookstore",
    price: "free",
  },

  // ── Francie & Finch (Lincoln) ─────────────────────────────────────
  {
    id: "ne-francie-alena-bruzas-broken-edge-20260718",
    year: 2026,
    monthIndex: 6,
    day: 18,
    hour: 16,
    minute: 30,
    endHour: 17,
    endMinute: 30,
    timeZone: TZ,
    title: "Alena Bruzas — The Broken Edge of the World (with Allison Bitz)",
    tagline: "Francie & Finch · Lincoln · Book launch · Free",
    description:
      "Francie & Finch celebrates the launch of Alena Bruzas's third novel, The Broken Edge of the World, in conversation with local author Allison Bitz. Bruzas grew up in Seattle and lives in Lincoln; she is also the author of To the Bone and Ever Since.",
    category: "reading",
    organizer: "Francie & Finch Bookshop",
    venue: "Francie & Finch Bookshop",
    address: FRANCIE_ADDRESS,
    neighborhood: "Lincoln",
    rsvpUrl:
      "https://francieandfinch.com/event/book-launch-alena-bruzas-the-broken-edge-of-the-world/",
    sourceChannel: "bookstore",
    price: "free",
  },
  {
    id: "ne-francie-colleen-morton-busch-smolder-20260807",
    year: 2026,
    monthIndex: 7,
    day: 7,
    hour: 16,
    minute: 30,
    endHour: 17,
    endMinute: 30,
    timeZone: TZ,
    title: "Colleen Morton Busch — Smolder (with Judy Lorenzen)",
    tagline: "Francie & Finch · Lincoln · Poetry · Free",
    description:
      "Ex Ophidia's 2025 Richard-Gabriel Rummonds Poetry Prize winner Colleen Morton Busch presents Smolder in conversation with Nebraska poet Judy Lorenzen.",
    category: "reading",
    organizer: "Francie & Finch Bookshop",
    venue: "Francie & Finch Bookshop",
    address: FRANCIE_ADDRESS,
    neighborhood: "Lincoln",
    rsvpUrl:
      "https://francieandfinch.com/event/visiting-author-colleen-morton-busch-in-conversation-with-judy-lorenzen-smolder/",
    sourceChannel: "bookstore",
    price: "free",
  },
  {
    id: "ne-francie-david-moscovich-premieres-20260810",
    year: 2026,
    monthIndex: 7,
    day: 10,
    hour: 17,
    minute: 30,
    endHour: 18,
    endMinute: 30,
    timeZone: TZ,
    title: "David Moscovich — Premieres: A Memoir in Verse",
    tagline: "Francie & Finch · Lincoln · Book launch · Free",
    description:
      "Francie & Finch hosts the book launch for David Moscovich's Premieres: A Memoir in Verse.",
    category: "reading",
    organizer: "Francie & Finch Bookshop",
    venue: "Francie & Finch Bookshop",
    address: FRANCIE_ADDRESS,
    neighborhood: "Lincoln",
    rsvpUrl:
      "https://francieandfinch.com/event/visiting-author-david-moscovich-premieres-a-memoir-in-verse/",
    sourceChannel: "bookstore",
    price: "free",
  },
  {
    id: "ne-francie-matt-schur-holy-ground-20260815",
    year: 2026,
    monthIndex: 7,
    day: 15,
    hour: 16,
    minute: 30,
    endHour: 17,
    endMinute: 30,
    timeZone: TZ,
    title: "Matt Schur — Even This is Holy Ground: Poetry",
    tagline: "Francie & Finch · Lincoln · Poetry launch · Free",
    description:
      "Book launch for Matt Schur's poetry collection Even This is Holy Ground at Francie & Finch Bookshop.",
    category: "reading",
    organizer: "Francie & Finch Bookshop",
    venue: "Francie & Finch Bookshop",
    address: FRANCIE_ADDRESS,
    neighborhood: "Lincoln",
    rsvpUrl:
      "https://francieandfinch.com/event/book-launch-matt-schur-even-this-is-holy-ground-poetry/",
    sourceChannel: "bookstore",
    price: "free",
  },
  {
    id: "ne-francie-marlene-zuk-outsider-animals-20260818",
    year: 2026,
    monthIndex: 7,
    day: 18,
    hour: 17,
    minute: 30,
    endHour: 18,
    endMinute: 30,
    timeZone: TZ,
    title: "Marlene Zuk — Outsider Animals",
    tagline: "Francie & Finch · Lincoln · Free",
    description:
      "Visiting author Marlene Zuk discusses Outsider Animals: How the Creatures at the Margins of Our Lives Have the Most to Teach Us.",
    category: "reading",
    organizer: "Francie & Finch Bookshop",
    venue: "Francie & Finch Bookshop",
    address: FRANCIE_ADDRESS,
    neighborhood: "Lincoln",
    rsvpUrl:
      "https://francieandfinch.com/event/visiting-author-marlene-zuk-outsider-animals/",
    sourceChannel: "bookstore",
    price: "free",
  },
  {
    id: "ne-francie-alexandra-hayne-what-ruth-learned-20260829",
    year: 2026,
    monthIndex: 7,
    day: 29,
    hour: 16,
    minute: 30,
    endHour: 17,
    endMinute: 30,
    timeZone: TZ,
    title: "Alexandra Hayne — What Ruth Learned",
    tagline: "Francie & Finch · Lincoln · Free",
    description:
      "Visiting author Alexandra Hayne presents What Ruth Learned at Francie & Finch Bookshop.",
    category: "reading",
    organizer: "Francie & Finch Bookshop",
    venue: "Francie & Finch Bookshop",
    address: FRANCIE_ADDRESS,
    neighborhood: "Lincoln",
    rsvpUrl:
      "https://francieandfinch.com/event/visiting-author-alexandra-hayne-what-ruth-learned/",
    sourceChannel: "bookstore",
    price: "free",
  },

  // ── Nebraska Writers Collective ───────────────────────────────────
  {
    id: "ne-nwc-shelby-martinez-workshop-20260721",
    year: 2026,
    monthIndex: 6,
    day: 21,
    hour: 17,
    minute: 30,
    endHour: 19,
    endMinute: 30,
    timeZone: TZ,
    title: "Writers Workshop w/ Shelby Martinez — Genealogy",
    tagline: "Nebraska Writers Collective · OPL Central · Free",
    description:
      "Nebraska Writers Collective writers workshop with Shelby Martinez at Omaha Public Library's Central Library (Genealogy and Local History Room). Theme: Genealogy.",
    category: "workshop",
    organizer: "Nebraska Writers Collective",
    venue: "Omaha Public Library — Central Library",
    address: CENTRAL_LIBRARY_ADDRESS,
    neighborhood: "Omaha",
    rsvpUrl: "https://www.newriters.org/events/writers-workshop-wshelby-martinez",
    sourceChannel: "literary_org",
    price: "free",
  },
  {
    id: "ne-nwc-shelly-nosbisch-workshop-20260722",
    year: 2026,
    monthIndex: 6,
    day: 22,
    hour: 14,
    minute: 0,
    endHour: 15,
    endMinute: 30,
    timeZone: TZ,
    title: "Writers' Workshop w/ Shelly Nosbisch — Heroes vs Villains",
    tagline: "Nebraska Writers Collective · Benson Branch · Free",
    description:
      "Nebraska Writers Collective workshop with Shelly Nosbisch at OPL's Benson Branch. Theme: Heroes vs Villains.",
    category: "workshop",
    organizer: "Nebraska Writers Collective",
    venue: "Omaha Public Library — Benson Branch",
    address: BENSON_BRANCH_ADDRESS,
    neighborhood: "Omaha",
    rsvpUrl: "https://www.newriters.org/events/writers-workshop-wshelly-nosbisch",
    sourceChannel: "literary_org",
    price: "free",
  },
  {
    id: "ne-nwc-riley-westerholt-workshop-20260807",
    year: 2026,
    monthIndex: 7,
    day: 7,
    hour: 10,
    minute: 0,
    endHour: 12,
    endMinute: 0,
    timeZone: TZ,
    title: "Writers Workshop w/ Riley Westerholt — Mysteries",
    tagline: "Nebraska Writers Collective · OPL Central · Free",
    description:
      "Nebraska Writers Collective writers workshop with Riley Westerholt at Omaha Central Library. Theme: Mysteries.",
    category: "workshop",
    organizer: "Nebraska Writers Collective",
    venue: "Omaha Public Library — Central Library",
    address: CENTRAL_LIBRARY_ADDRESS,
    neighborhood: "Omaha",
    rsvpUrl:
      "https://www.newriters.org/events/writers-workshop-wriley-westerholt-1",
    sourceChannel: "literary_org",
    price: "free",
  },
  {
    id: "ne-nwc-omaha-poetry-slam-20260808",
    year: 2026,
    monthIndex: 7,
    day: 8,
    hour: 19,
    minute: 0,
    endHour: 21,
    endMinute: 0,
    timeZone: TZ,
    title: "Omaha Poetry Slam",
    tagline: "Nebraska Writers Collective · Local Art Plug · $10 suggested",
    description:
      "Monthly open mic and competitive poetry slam, second Saturday of the month. Doors 6:30 PM; open mic then individual slam. Sign up at the event (bring three poems to compete). $10 suggested donation; top scorer wins $50.",
    category: "open-mic",
    organizer: "Nebraska Writers Collective",
    venue: "The Local Art Plug",
    address: LOCAL_ART_PLUG_ADDRESS,
    neighborhood: "Omaha",
    rsvpUrl: "https://www.newriters.org/events/omaha-poetry-slam-5",
    sourceChannel: "literary_org",
    price: "paid",
  },
  {
    id: "ne-nwc-lincoln-poetry-slam-20260813",
    year: 2026,
    monthIndex: 7,
    day: 13,
    hour: 19,
    minute: 0,
    endHour: 21,
    endMinute: 0,
    timeZone: TZ,
    title: "Lincoln Poetry Slam",
    tagline: "Nebraska Writers Collective · Larksong · $10 suggested",
    description:
      "Monthly open mic and competitive poetry slam, second Thursday of the month at Larksong Writers Place. Doors 6:30 PM. Sign up at the event. $10 suggested donation.",
    category: "open-mic",
    organizer: "Nebraska Writers Collective",
    venue: "Larksong Writers Place",
    address: LARKSONG_ADDRESS,
    neighborhood: "Lincoln",
    rsvpUrl: "https://www.newriters.org/events/lincoln-poetry-slam-1",
    sourceChannel: "literary_org",
    price: "paid",
  },
  {
    id: "ne-nwc-allana-pommier-workshop-20260829",
    year: 2026,
    monthIndex: 7,
    day: 29,
    hour: 14,
    minute: 0,
    endHour: 16,
    endMinute: 0,
    timeZone: TZ,
    title: "Writers Workshop w/ Allana Pommier — Science Fiction",
    tagline: "Nebraska Writers Collective · Benson Branch · Free",
    description:
      "Nebraska Writers Collective workshop with Allana Pommier at OPL's Benson Branch. Theme: Science Fiction.",
    category: "workshop",
    organizer: "Nebraska Writers Collective",
    venue: "Omaha Public Library — Benson Branch",
    address: BENSON_BRANCH_ADDRESS,
    neighborhood: "Omaha",
    rsvpUrl: "https://www.newriters.org/events/writers-workshop-w",
    sourceChannel: "literary_org",
    price: "free",
  },
  {
    id: "ne-nwc-lincoln-poetry-slam-20260910",
    year: 2026,
    monthIndex: 8,
    day: 10,
    hour: 19,
    minute: 0,
    endHour: 21,
    endMinute: 0,
    timeZone: TZ,
    title: "Lincoln Poetry Slam",
    tagline: "Nebraska Writers Collective · Larksong · $10 suggested",
    description:
      "Monthly open mic and competitive poetry slam at Larksong Writers Place (second Thursday). Doors 6:30 PM; open mic then slam. $10 suggested donation.",
    category: "open-mic",
    organizer: "Nebraska Writers Collective",
    venue: "Larksong Writers Place",
    address: LARKSONG_ADDRESS,
    neighborhood: "Lincoln",
    rsvpUrl: "https://www.newriters.org/events/lincoln-poetry-slam-1",
    sourceChannel: "literary_org",
    price: "paid",
  },
  {
    id: "ne-nwc-kids-workshop-shelby-nosbisch-20260912",
    year: 2026,
    monthIndex: 8,
    day: 12,
    hour: 14,
    minute: 0,
    endHour: 15,
    endMinute: 30,
    timeZone: TZ,
    title: "Writer's Workshop for Kids with Shelby Nosbisch",
    tagline: "Nebraska Writers Collective · Free · Ages youth",
    description:
      "Nebraska Writers Collective kids writing workshop with Shelby Nosbisch. See listing for location details.",
    category: "workshop",
    organizer: "Nebraska Writers Collective",
    venue: "See event listing",
    address: "Omaha, NE",
    neighborhood: "Omaha",
    rsvpUrl:
      "https://www.newriters.org/events/writers-workshop-for-kids-with-shelby-nosbisch",
    sourceChannel: "literary_org",
    price: "free",
  },
  {
    id: "ne-nwc-omaha-poetry-slam-20260912",
    year: 2026,
    monthIndex: 8,
    day: 12,
    hour: 19,
    minute: 0,
    endHour: 21,
    endMinute: 0,
    timeZone: TZ,
    title: "Omaha Poetry Slam",
    tagline: "Nebraska Writers Collective · Local Art Plug · $10 suggested",
    description:
      "Monthly open mic and competitive poetry slam at The Local Art Plug (second Saturday). Doors 6:30 PM. $10 suggested donation; top scorer wins $50.",
    category: "open-mic",
    organizer: "Nebraska Writers Collective",
    venue: "The Local Art Plug",
    address: LOCAL_ART_PLUG_ADDRESS,
    neighborhood: "Omaha",
    rsvpUrl: "https://www.newriters.org/events",
    rsvpIsGeneralCalendar: true,
    sourceChannel: "literary_org",
    price: "paid",
  },
  {
    id: "ne-nwc-lincoln-poetry-slam-20261008",
    year: 2026,
    monthIndex: 9,
    day: 8,
    hour: 19,
    minute: 0,
    endHour: 21,
    endMinute: 0,
    timeZone: TZ,
    title: "Lincoln Poetry Slam",
    tagline: "Nebraska Writers Collective · Larksong · $10 suggested",
    description:
      "Monthly open mic and competitive poetry slam at Larksong Writers Place (second Thursday). Doors 6:30 PM. $10 suggested donation.",
    category: "open-mic",
    organizer: "Nebraska Writers Collective",
    venue: "Larksong Writers Place",
    address: LARKSONG_ADDRESS,
    neighborhood: "Lincoln",
    rsvpUrl: "https://www.newriters.org/events/lincoln-poetry-slam-1",
    sourceChannel: "literary_org",
    price: "paid",
  },
  {
    id: "ne-nwc-omaha-poetry-slam-20261010",
    year: 2026,
    monthIndex: 9,
    day: 10,
    hour: 19,
    minute: 0,
    endHour: 21,
    endMinute: 0,
    timeZone: TZ,
    title: "Omaha Poetry Slam",
    tagline: "Nebraska Writers Collective · Local Art Plug · $10 suggested",
    description:
      "Monthly open mic and competitive poetry slam at The Local Art Plug (second Saturday). Doors 6:30 PM. $10 suggested donation.",
    category: "open-mic",
    organizer: "Nebraska Writers Collective",
    venue: "The Local Art Plug",
    address: LOCAL_ART_PLUG_ADDRESS,
    neighborhood: "Omaha",
    rsvpUrl: "https://www.newriters.org/events",
    rsvpIsGeneralCalendar: true,
    sourceChannel: "literary_org",
    price: "paid",
  },

  // ── Community / bookstore trail ───────────────────────────────────
  {
    id: "ne-novel-idea-book-trail-20260930",
    year: 2026,
    monthIndex: 8,
    day: 30,
    hour: 10,
    minute: 0,
    endHour: 17,
    endMinute: 0,
    timeZone: TZ,
    title: "Nebraska Book Trail — Passport Deadline",
    tagline: "A Novel Idea & statewide indies · Through Sept 30",
    description:
      "Explore 20+ independent bookstores across Nebraska on the Nebraska Book Trail. Pick up a passport at any participating shop (including A Novel Idea and Francie & Finch in Lincoln) and collect stamps through September 30, 2026.",
    category: "other",
    organizer: "A Novel Idea Bookstore",
    venue: "A Novel Idea Bookstore",
    address: "118 N 14th St, Lincoln, NE 68508",
    neighborhood: "Lincoln",
    rsvpUrl: "https://anovelideabookstore.com/events-calendars/",
    rsvpIsGeneralCalendar: true,
    sourceChannel: "bookstore",
    price: "free",
  },
];

type PoetryMenuInput = {
  slug: string;
  date: string;
  hour: number;
  minute?: number;
  endHour?: number;
  endMinute?: number;
  title: string;
  tagline: string;
  description: string;
  category: WorkshopEventCategory;
  organizer: string;
  venue: string;
  address: string;
  neighborhood: string;
  rsvpUrl?: string;
  price?: WorkshopEvent["price"];
  priceDetail?: string;
  format?: WorkshopEvent["format"];
  virtualLabel?: string;
};

function poetryMenuEvent(input: PoetryMenuInput): CuratedSpec {
  const date = DateTime.fromISO(input.date, { zone: TZ });
  return {
    id: `ne-poetry-menu-${input.slug}-${input.date.replaceAll("-", "")}`,
    year: date.year,
    monthIndex: date.month - 1,
    day: date.day,
    hour: input.hour,
    minute: input.minute ?? 0,
    endHour: input.endHour,
    endMinute: input.endMinute,
    timeZone: TZ,
    title: input.title,
    tagline: input.tagline,
    description: input.description,
    category: input.category,
    organizer: input.organizer,
    venue: input.venue,
    address: input.address,
    neighborhood: input.neighborhood,
    rsvpUrl: input.rsvpUrl ?? "https://poetrymenu.com/",
    rsvpIsGeneralCalendar: !input.rsvpUrl,
    sourceChannel: "literary_org",
    source: "Poetry Menu (poetrymenu.com)",
    price: input.price,
    priceDetail: input.priceDetail,
    format: input.format,
    virtualLabel: input.virtualLabel,
  };
}

function poetryMenuEvents(): CuratedSpec[] {
  const events: CuratedSpec[] = [];

  const lauritzenDates = ["2026-07-25", "2026-08-08", "2026-08-15", "2026-09-12"];
  for (const date of lauritzenDates) {
    events.push(
      poetryMenuEvent({
        slug: "lauritzen-poetry-workshop",
        date,
        hour: 10,
        endHour: 11,
        endMinute: 30,
        title: "Poetry Writing Workshop with Julie S. Paschold",
        tagline: "Lauritzen Gardens · Omaha · Registration required",
        description:
          "Poetry writing workshop with Lauritzen Gardens resident poetry instructor Julie S. Paschold.",
        category: "workshop",
        organizer: "Lauritzen Gardens",
        venue: "Lauritzen Gardens",
        address: "100 Bancroft St, Omaha, NE 68108",
        neighborhood: "Omaha",
        rsvpUrl:
          "https://lauritzen.ticketapp.org/portal/product/51/event/d25ffeb9-e830-40f1-9c0d-aa29cb9f1999",
      }),
    );
  }

  const crescentMoonDates = [
    "2026-07-29",
    "2026-08-05",
    "2026-08-12",
    "2026-08-19",
    "2026-08-26",
    "2026-09-02",
    "2026-09-09",
    "2026-09-16",
    "2026-09-23",
    "2026-09-30",
  ];
  for (const date of crescentMoonDates) {
    events.push(
      poetryMenuEvent({
        slug: "crescent-moon-writers-night",
        date,
        hour: 18,
        minute: 30,
        endHour: 21,
        endMinute: 0,
        title: "The Crescent Moon Writers' Night: Open Mic",
        tagline: "Crescent Moon Coffee · Lincoln",
        description:
          "Weekly writers' open mic hosted by Jeff Martinson. Signup begins at 6:30 PM. On the first Wednesday of each month, attendees are invited to stay afterward for the Write After writing group.",
        category: "open-mic",
        organizer: "Crescent Moon Coffee",
        venue: "Crescent Moon Coffee at The Apothecary",
        address: "140 N 8th St, Lincoln, NE 68508",
        neighborhood: "Lincoln",
        rsvpUrl:
          "https://www.crescentmooncoffee.com/events/pg9ttfnaxrsxegg-b5rz4-nftxt-46ab5-bezhs-25l6k-324y5-49drs-5dx4a-cx6ap-3sjks-aldyw-7rhg2-scdxg-79t7a-xjdwd-cr4zk-4zhbf-pc7sd-xdhc6-s685x-9b7ye-pgfb6-r2zfl-w953c-mw8gn-9d3l7-cjdjj",
        price: "free",
      }),
    );
  }

  events.push(
    poetryMenuEvent({
      slug: "nps-workshop-preeti-vangani",
      date: "2026-08-01",
      hour: 10,
      endHour: 11,
      title: "Writing the Poem of Grief through Food with Preeti Vangani",
      tagline: "Nebraska Poetry Society · Online · $35 or free for members",
      description:
        "Faiz Ahmed Faiz writes that the true subject of poetry is the loss of the beloved; entering the elegy through food strikes an intimacy with the dead and the dying. In this generative workshop led by Preeti Vangani, we'll look at poems by Gabrielle Calvocoressi, Li-Young Lee, Sharon Olds, Ross Gay, and others, and explore how meals shared together help us remember those we've lost. What physical and emotional rooms can memories of cooking, eating, or feasting communally help open up, and how can they resurrect joy in a poem of longing and mourning? Writers at all levels are welcome as they draft new work attentive to food's social, political, and historical connections.",
      category: "workshop",
      organizer: "Nebraska Poetry Society",
      venue: "Online",
      address: "Online",
      neighborhood: "Online",
      rsvpUrl:
        "https://www.nepoetrysociety.org/event-details/writing-the-poem-of-grief-through-food-with-preeti-vangani",
      price: "paid",
      priceDetail: "$35 · free for members",
      format: "virtual",
      virtualLabel: "Online",
    }),
    poetryMenuEvent({
      slug: "neihardt-day-poetry-picnic",
      date: "2026-08-02",
      hour: 13,
      endHour: 15,
      title: "61st Annual Neihardt Day: A Poetry Picnic",
      tagline: "Neihardt State Historic Site · Bancroft · Free",
      description:
        "A poetry picnic featuring State Poet Emeritus Matt Mason, JV Brummels, and 2025–26 Youth Poet Laureate Victoria Bogats. Bring picnic food, a blanket, and two or three poems for the open mic.",
      category: "reading",
      organizer: "John G. Neihardt State Historic Site",
      venue: "John G. Neihardt State Historic Site",
      address: "306 Elm St, Bancroft, NE 68004",
      neighborhood: "Bancroft",
      price: "free",
    }),
    poetryMenuEvent({
      slug: "nps-reading-brad-aaron-modlin",
      date: "2026-08-04",
      hour: 18,
      minute: 30,
      endHour: 19,
      endMinute: 30,
      title: "Nebraska Poets Reading Series: Brad Aaron Modlin",
      tagline: "Nebraska Poetry Society · Online · Free",
      description:
        "The Nebraska Poetry Society's free online reading series features poet Brad Aaron Modlin.",
      category: "reading",
      organizer: "Nebraska Poetry Society",
      venue: "Online",
      address: "Online",
      neighborhood: "Online",
      rsvpUrl: "https://nepoetrysociety.org/readings",
      price: "free",
      format: "virtual",
      virtualLabel: "Online",
    }),
    poetryMenuEvent({
      slug: "smolder-book-launch-gallery-1516",
      date: "2026-08-06",
      hour: 18,
      endHour: 20,
      title: "Smolder Book Launch with Colleen Morton Busch",
      tagline: "Gallery 1516 · Omaha · Reading, Q&A & signing",
      description:
        "Celebrate the launch of Smolder by Colleen Morton Busch, winner of the 2025 Richard-Gabriel Rummonds Poetry Prize. Doors open at 5:30 PM; the reading and Q&A begin at 6:30, followed by a signing. RSVP to info@gallery1516.org.",
      category: "reading",
      organizer: "Gallery 1516",
      venue: "Gallery 1516",
      address: "1516 Leavenworth St, Omaha, NE 68102",
      neighborhood: "Omaha",
      rsvpUrl: "mailto:info@gallery1516.org",
    }),
    poetryMenuEvent({
      slug: "larksong-first-friday-lisa-knopp",
      date: "2026-08-07",
      hour: 12,
      endHour: 13,
      title: "First Friday Book Talk: Lisa Knopp",
      tagline: "Larksong Writers Place · Zoom · Free",
      description:
        "Lisa Knopp discusses and reads from Ravelings: Essays on Love, Loss, and Wonder. Free registration is required.",
      category: "reading",
      organizer: "Larksong Writers Place",
      venue: "Zoom",
      address: "Online",
      neighborhood: "Online",
      rsvpUrl: "https://larksongwritersplace.org/",
      price: "free",
      format: "virtual",
      virtualLabel: "Zoom",
    }),
    poetryMenuEvent({
      slug: "victoria-bogats-chapbook-release",
      date: "2026-08-07",
      hour: 18,
      endHour: 20,
      title: "Victoria Bogats — This Is Not The End Chapbook Release",
      tagline: "Joslyn Castle Carriage House · Omaha",
      description:
        "Victoria Bogats celebrates her debut chapbook This Is Not The End with guest poets Jewel Rodgers, Matt Mason, Angélica Perez, and Stephany Orellana Gomez.",
      category: "reading",
      organizer: "Victoria Bogats",
      venue: "Joslyn Castle Carriage House",
      address: "3902 Davenport St, Omaha, NE 68131",
      neighborhood: "Omaha",
    }),
  );

  for (const date of ["2026-08-07", "2026-09-04"]) {
    events.push(
      poetryMenuEvent({
        slug: "reading-room-poetry-night",
        date,
        hour: 18,
        minute: 30,
        endHour: 22,
        title: "Poetry Night at the Reading Room",
        tagline: "The Reading Room · Omaha · Registration required",
        description:
          "Share your own work or read a favorite poem aloud at this monthly poetry night. Register by emailing readingroomomaha@gmail.com or calling/texting 563-940-1308.",
        category: "open-mic",
        organizer: "The Reading Room",
        venue: "The Reading Room",
        address: "1505 Farnam St, Omaha, NE 68102",
        neighborhood: "Omaha",
        rsvpUrl: "mailto:readingroomomaha@gmail.com",
      }),
    );
  }

  for (const date of ["2026-08-10", "2026-09-14"]) {
    events.push(
      poetryMenuEvent({
        slug: "family-dinner-reading-open-mic",
        date,
        hour: 18,
        endHour: 20,
        title: "Family Dinner Reading Series and Open Mic",
        tagline: "Joslyn Castle Carriage House · Omaha",
        description:
          "Monthly featured reading at 6 PM followed by an open mic at 7 PM.",
        category: "open-mic",
        organizer: "Family Dinner Reading Series",
        venue: "Joslyn Castle Carriage House",
        address: "3902 Davenport St, Omaha, NE 68131",
        neighborhood: "Omaha",
      }),
    );
  }

  for (const date of ["2026-08-11", "2026-09-08"]) {
    events.push(
      poetryMenuEvent({
        slug: "nps-writing-club",
        date,
        hour: 18,
        endHour: 20,
        title: "Nebraska Poetry Society Writing Club",
        tagline: "Vis Major Brewing · Omaha · Free",
        description:
          "A welcoming, low-pressure gathering to read, reflect, and write in community. This is not a formal workshop or critique group.",
        category: "other",
        organizer: "Nebraska Poetry Society",
        venue: "Vis Major Brewing",
        address: "3501 Center St, Omaha, NE 68105",
        neighborhood: "Omaha",
        rsvpUrl: "https://nepoetrysociety.org/workshops",
        price: "free",
      }),
    );
  }

  for (const date of ["2026-08-19", "2026-09-09"]) {
    events.push(
      poetryMenuEvent({
        slug: "no-gatekeepers-poetry-night",
        date,
        hour: 19,
        endHour: 21,
        title: "No Gatekeepers Poetry Night",
        tagline: "Joslyn Castle Carriage House · Omaha",
        description:
          "Matt Mason hosts a welcoming poetry night. Bring two poems—one of your own and one by another poet—to share in five minutes. The August event was moved from August 12 to August 19.",
        category: "open-mic",
        organizer: "Castle & Cathedral Creative District",
        venue: "Joslyn Castle Carriage House",
        address: "3902 Davenport St, Omaha, NE 68131",
        neighborhood: "Omaha",
      }),
    );
  }

  events.push(
    poetryMenuEvent({
      slug: "poetry-at-the-lion-robert-fernandez",
      date: "2026-08-14",
      hour: 18,
      endHour: 20,
      title: "Poetry Readings at The Lion: Robert Fernandez",
      tagline: "St. Mark's on the Campus · Lincoln · Feature & open mic",
      description:
        "Robert Fernandez is the featured reader, followed by an open mic as time allows. Doors open at 5:30 PM.",
      category: "open-mic",
      organizer: "Poetry Readings at The Lion",
      venue: "St. Mark's on the Campus",
      address: "1309 R St, Lincoln, NE 68508",
      neighborhood: "Lincoln",
      rsvpUrl: "https://sites.google.com/view/smoc-lion",
    }),
    poetryMenuEvent({
      slug: "authors-against-ice",
      date: "2026-08-15",
      hour: 19,
      endHour: 21,
      title: "Authors Against ICE",
      tagline: "Sower Books · Lincoln · $10 benefit reading",
      description:
        "Junk Drawer and SydsBooked host an author reading supporting community action. All proceeds benefit the Center for Legal Immigration and Nebraska Appleseed.",
      category: "reading",
      organizer: "Sower Books",
      venue: "Sower Books",
      address: "914 N 70th St, Lincoln, NE 68505",
      neighborhood: "Lincoln",
      rsvpUrl: "https://sowerbooksne.com/events/5671520260815",
      price: "paid",
      priceDetail: "$10",
    }),
    poetryMenuEvent({
      slug: "dog-days-of-summer-open-mic",
      date: "2026-08-16",
      hour: 14,
      endHour: 16,
      title: "The Dog Days of Summer Open Mic",
      tagline: "O'Donnell Lecture Hall · Omaha",
      description:
        "Bring pet poetry, starry-night poems, or work on another theme. Refreshments and live music are offered at intermission.",
      category: "open-mic",
      organizer: "Poetry Menu",
      venue: "O'Donnell Lecture Hall",
      address:
        "Cultural Arts Center, 40th & Webster Sts, Omaha, NE 68131",
      neighborhood: "Omaha",
    }),
    poetryMenuEvent({
      slug: "nps-poetry-pause-jacobs-stander",
      date: "2026-08-20",
      hour: 17,
      endHour: 18,
      endMinute: 30,
      title: "Poetry Pause: Tyler Michael Jacobs & Nicole Stander",
      tagline: "Joslyn Castle Carriage House · Omaha",
      description:
        "Two local poets at different stages of their writing lives share work, discuss poetry and the creative process, and answer questions during the Castle & Cathedral Art Walk.",
      category: "reading",
      organizer: "Nebraska Poetry Society",
      venue: "Joslyn Castle Carriage House",
      address: "3902 Davenport St, Omaha, NE 68131",
      neighborhood: "Omaha",
      rsvpUrl: "https://nepoetrysociety.org/readings",
      price: "free",
    }),
    poetryMenuEvent({
      slug: "larksong-writers-conversation-mason-mckinstry-brown",
      date: "2026-08-20",
      hour: 18,
      minute: 30,
      endHour: 19,
      endMinute: 30,
      title: "Writers in Conversation: Matt Mason & Sarah McKinstry-Brown",
      tagline: "Larksong Writers Place · Lincoln · Free",
      description:
        "Two writers share their work and discuss the craft of creative writing before opening the conversation to the audience. Social time begins at 6 PM.",
      category: "reading",
      organizer: "Larksong Writers Place",
      venue: "Larksong Writers Place",
      address: LARKSONG_ADDRESS,
      neighborhood: "Lincoln",
      rsvpUrl: "https://larksongwritersplace.org/",
      price: "free",
    }),
  );

  for (const date of ["2026-08-20", "2026-09-17"]) {
    events.push(
      poetryMenuEvent({
        slug: "writes-of-passage",
        date,
        hour: 19,
        endHour: 21,
        title: "Writes of Passage: Spoken Word Open Mic",
        tagline: "UNO Criss Library · Omaha · No registration required",
        description:
          "Monthly spoken-word open mic on the first floor near Starbucks. Doors open at 6:30 PM; performances begin at 7 PM.",
        category: "open-mic",
        organizer: "Writes of Passage",
        venue: "UNO Criss Library",
        address: "6401 S University Dr Rd N, Omaha, NE 68182",
        neighborhood: "Omaha",
        price: "free",
      }),
    );
  }

  for (const date of ["2026-08-21", "2026-09-18"]) {
    events.push(
      poetryMenuEvent({
        slug: "ellery-spoken-word-open-mic",
        date,
        hour: 19,
        endHour: 20,
        endMinute: 30,
        title: "Spoken Word Featured Reading and Open Mic",
        tagline: "The Ellery · Lincoln",
        description:
          "Esman Rodas Calderon hosts a featured spoken-word reading and open mic. Attendees are invited to stay afterward for the Write After writing group.",
        category: "open-mic",
        organizer: "Esman Rodas Calderon",
        venue: "The Ellery",
        address: "1247 S 11th St, Lincoln, NE 68502",
        neighborhood: "Lincoln",
      }),
    );
  }

  events.push(
    poetryMenuEvent({
      slug: "nps-reading-mark-sanders",
      date: "2026-09-01",
      hour: 18,
      minute: 30,
      endHour: 19,
      endMinute: 30,
      title: "Nebraska Poets Reading Series: Mark Sanders",
      tagline: "Nebraska Poetry Society · Online · Free",
      description:
        "The Nebraska Poetry Society's free online reading series features poet Mark Sanders.",
      category: "reading",
      organizer: "Nebraska Poetry Society",
      venue: "Online",
      address: "Online",
      neighborhood: "Online",
      rsvpUrl: "https://nepoetrysociety.org/readings",
      price: "free",
      format: "virtual",
      virtualLabel: "Online",
    }),
    poetryMenuEvent({
      slug: "larksong-first-friday-september",
      date: "2026-09-04",
      hour: 12,
      endHour: 13,
      title: "First Friday Book Talk and Reading",
      tagline: "Larksong Writers Place · Zoom · Free",
      description:
        "Larksong Writers Place's monthly online book talk and reading. September's featured writer is to be announced; free registration is required.",
      category: "reading",
      organizer: "Larksong Writers Place",
      venue: "Zoom",
      address: "Online",
      neighborhood: "Online",
      rsvpUrl: "https://larksongwritersplace.org/",
      price: "free",
      format: "virtual",
      virtualLabel: "Zoom",
    }),
    poetryMenuEvent({
      slug: "poetry-at-the-lion-stacey-waite",
      date: "2026-09-11",
      hour: 18,
      endHour: 20,
      title: "Poetry Readings at The Lion: Stacey Waite",
      tagline: "St. Mark's on the Campus · Lincoln · Feature & open mic",
      description:
        "Stacey Waite is the featured reader, followed by an open mic as time allows. Doors open at 5:30 PM.",
      category: "open-mic",
      organizer: "Poetry Readings at The Lion",
      venue: "St. Mark's on the Campus",
      address: "1309 R St, Lincoln, NE 68508",
      neighborhood: "Lincoln",
      rsvpUrl: "https://sites.google.com/view/smoc-lion",
    }),
    poetryMenuEvent({
      slug: "nps-poetry-pause-letcher-schmeer",
      date: "2026-09-17",
      hour: 17,
      endHour: 18,
      endMinute: 30,
      title: "Poetry Pause: Kiara Nicole Letcher & Anna Schmeer",
      tagline: "Joslyn Castle Carriage House · Omaha",
      description:
        "Two local poets at different stages of their writing lives share work, discuss poetry and the creative process, and answer questions during the Castle & Cathedral Art Walk.",
      category: "reading",
      organizer: "Nebraska Poetry Society",
      venue: "Joslyn Castle Carriage House",
      address: "3902 Davenport St, Omaha, NE 68131",
      neighborhood: "Omaha",
      rsvpUrl: "https://nepoetrysociety.org/readings",
      price: "free",
    }),
    poetryMenuEvent({
      slug: "larksong-writers-conversation-september",
      date: "2026-09-17",
      hour: 18,
      minute: 30,
      endHour: 19,
      endMinute: 30,
      title: "Writers in Conversation: Third Thursdays at Larksong",
      tagline: "Larksong Writers Place · Lincoln · Free",
      description:
        "Two writers at different stages of their careers share work and discuss the craft of creative writing before opening the conversation to the audience. Social time begins at 6 PM.",
      category: "reading",
      organizer: "Larksong Writers Place",
      venue: "Larksong Writers Place",
      address: LARKSONG_ADDRESS,
      neighborhood: "Lincoln",
      rsvpUrl: "https://larksongwritersplace.org/",
      price: "free",
    }),
    poetryMenuEvent({
      slug: "postscript-stinson-hermanson-kosmicki",
      date: "2026-09-17",
      hour: 19,
      endHour: 20,
      title: "Poetry Reading: Mike Stinson, Heidi Hermanson & Greg Kosmicki",
      tagline: "Postscript · Ashland",
      description:
        "Poetry reading by Mike Stinson, Heidi Hermanson, and Greg Kosmicki.",
      category: "reading",
      organizer: "Postscript",
      venue: "Postscript",
      address: "1439 Silver St, Ashland, NE 68003",
      neighborhood: "Ashland",
    }),
    poetryMenuEvent({
      slug: "nps-workshop-kemi-alabi",
      date: "2026-09-19",
      hour: 10,
      endHour: 11,
      title: "Ready for the Marvelous with Kemi Alabi",
      tagline: "Nebraska Poetry Society · Online · $35 or free for members",
      description:
        "An online poetry writing workshop led by Kemi Alabi on getting ready for the marvelous.",
      category: "workshop",
      organizer: "Nebraska Poetry Society",
      venue: "Online",
      address: "Online",
      neighborhood: "Online",
      rsvpUrl: "https://nepoetrysociety.org/workshops",
      price: "paid",
      priceDetail: "$35 · free for members",
      format: "virtual",
      virtualLabel: "Online",
    }),
  );

  return events;
}

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
      : start.plus({ hours: 1 });

  return {
    id: spec.id,
    cityId: "ne",
    title: spec.title,
    tagline: spec.tagline,
    description: spec.description,
    start: start.toISO()!,
    end: end.toISO()!,
    timeZone: spec.timeZone,
    format: spec.format ?? "in-person",
    price: spec.price ?? "unknown",
    priceDetail: spec.priceDetail,
    category: spec.category,
    organizer: spec.organizer,
    venue: spec.venue,
    address: spec.address,
    neighborhood: spec.neighborhood,
    virtualLabel: spec.virtualLabel,
    rsvpUrl: spec.rsvpUrl,
    rsvpIsGeneralCalendar: spec.rsvpIsGeneralCalendar,
    source: spec.source ?? "Omaha / Lincoln curated listings",
    sourceChannel: spec.sourceChannel,
    listingProvenance: "live",
  };
}

export type NebraskaCuratedMeta = {
  curatedTotal: number;
  rowsInMonth: number;
};

export function fetchNebraskaCuratedEventsForMonth(
  year: number,
  monthIndex: number,
): { events: WorkshopEvent[]; meta: NebraskaCuratedMeta } {
  const rows = CURATED.filter(
    (s) => s.year === year && s.monthIndex === monthIndex,
  );
  return {
    events: rows.map(mapSpec),
    meta: { curatedTotal: CURATED.length, rowsInMonth: rows.length },
  };
}
