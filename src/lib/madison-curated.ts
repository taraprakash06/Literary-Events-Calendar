import { DateTime } from "luxon";
import type {
  WorkshopEvent,
  WorkshopEventCategory,
} from "@/lib/workshop-types";

const TZ = "America/Chicago";
const CITY_ID = "madison";

const MONROE_STREET_ADDRESS = "1705 Monroe Street, Madison, WI 53711";
const COMEDY_ON_STATE_ADDRESS = "202 State Street – Lower Level, Madison, WI 53703";
const GENNAS_ADDRESS = "105 W. Main Street, Madison, WI 53703";
const ALL_ADDRESS = "111 S. Livingston Street #100, Madison, WI 53703";
const ORPHEUM_ADDRESS = "216 State Street, Madison, WI 53703";
const ROOM_ADDRESS = "2717 Atwood Avenue, Madison, WI 53704";
const READING_ROOM_ADDRESS = "2713 Atwood Avenue, Madison, WI 53704";
const MYSTERY_TO_ME_ADDRESS = "1863 Monroe Street, Madison, WI 53711";
const BARRYMORE_ADDRESS = "2090 Atwood Avenue, Madison, WI 53704";

type CuratedSpec = {
  id: string;
  year: number;
  monthIndex: number;
  day: number;
  hour: number;
  minute: number;
  endHour?: number;
  endMinute?: number;
  title: string;
  tagline: string;
  description: string;
  category: WorkshopEventCategory;
  organizer: string;
  venue?: string;
  address?: string;
  neighborhood?: string;
  rsvpUrl?: string;
  rsvpIsGeneralCalendar?: boolean;
  sourceChannel: WorkshopEvent["sourceChannel"];
  source?: string;
  price?: WorkshopEvent["price"];
  priceDetail?: string;
  format?: WorkshopEvent["format"];
  virtualLabel?: string;
  registrationRequired?: boolean;
  timeTbd?: boolean;
};

function wednesdaysInRange(
  start: DateTime,
  endInclusive: DateTime,
): DateTime[] {
  let d = start.startOf("day");
  while (d.weekday !== 3) d = d.plus({ days: 1 });
  const out: DateTime[] = [];
  while (d <= endInclusive) {
    out.push(d);
    d = d.plus({ weeks: 1 });
  }
  return out;
}

function micOnStateEvents(): CuratedSpec[] {
  const start = DateTime.fromObject({ year: 2026, month: 9, day: 1 }, { zone: TZ });
  const end = DateTime.fromObject({ year: 2026, month: 12, day: 31 }, { zone: TZ });
  return wednesdaysInRange(start, end).map((d) => {
    const ymd = d.toFormat("yyyy-MM-dd");
    return {
      id: `madison-mic-on-state-${d.toFormat("yyyyMMdd")}`,
      year: d.year,
      monthIndex: d.month - 1,
      day: d.day,
      hour: 20,
      minute: 0,
      endHour: 22,
      endMinute: 30,
      title: "The Mic on State — Open Mic",
      tagline: "Comedy on State · Madison · $5 · Doors 6:30 PM",
      description:
        "One of the largest open mics in the country. The Mic on State runs every Wednesday at Comedy on State. Doors open to the public at 6:30 PM; showtime is 8:00 PM. $5 admission at the door. Features about 20 comedians each week. Seating is first come, first serve with no beverage minimum. Performer sign-up is online only Wednesdays 12–6 PM (signing up does not guarantee a spot).",
      category: "open-mic",
      organizer: "Comedy on State",
      venue: "Comedy on State",
      address: COMEDY_ON_STATE_ADDRESS,
      neighborhood: "State Street",
      rsvpUrl: `https://www.madisoncomedy.com/event/mic-2/${ymd}/`,
      sourceChannel: "theater_arts",
      source: "Comedy on State",
      price: "paid",
      priceDetail: "$5 at the door",
      format: "in-person",
      registrationRequired: false,
    };
  });
}

function gennasOpenMicEvents(): CuratedSpec[] {
  const start = DateTime.fromObject({ year: 2026, month: 9, day: 1 }, { zone: TZ });
  const end = DateTime.fromObject({ year: 2026, month: 12, day: 31 }, { zone: TZ });
  return wednesdaysInRange(start, end).map((d) => ({
    id: `madison-gennas-open-mic-${d.toFormat("yyyyMMdd")}`,
    year: d.year,
    monthIndex: d.month - 1,
    day: d.day,
    hour: 21,
    minute: 30,
    endHour: 23,
    endMinute: 30,
    title: "Genna's Open Mic",
    tagline: "Genna's Cocktail Lounge · 21+ · Sign-up 8:30 PM",
    description:
      "Weekly open mic every Wednesday at Genna's Cocktail Lounge (105 W. Main Street). Sign-up starts at 8:30 PM; show starts at 9:30 PM. 21+ only. Check the Facebook page for updates.",
    category: "open-mic",
    organizer: "Genna's Cocktail Lounge",
    venue: "Genna's Cocktail Lounge",
    address: GENNAS_ADDRESS,
    neighborhood: "Capitol Square",
    rsvpUrl: "https://www.facebook.com/GennasOpenMic/",
    rsvpIsGeneralCalendar: true,
    sourceChannel: "theater_arts",
    source: "Genna's Open Mic",
    price: "unknown",
    format: "in-person",
    registrationRequired: false,
  }));
}

const COMMUNITY_POETRY_RSVP =
  "https://www.hisawyer.com/arts-literature-laboratory/schedules/activity-set/1934806";

function communityPoetryWorkshopEvents(): CuratedSpec[] {
  /** Sawyer lists 6 drop-in classes in this activity set (not every Wednesday). */
  const dates = [
    { year: 2026, month: 9, day: 16 },
    { year: 2026, month: 10, day: 21 },
    { year: 2026, month: 11, day: 18 },
    { year: 2026, month: 12, day: 16 },
    { year: 2027, month: 1, day: 20 },
    { year: 2027, month: 2, day: 17 },
  ];
  return dates.map(({ year, month, day }) => ({
    id: `madison-all-community-poetry-workshop-${year}${String(month).padStart(2, "0")}${String(day).padStart(2, "0")}`,
    year,
    monthIndex: month - 1,
    day,
    hour: 18,
    minute: 30,
    endHour: 20,
    endMinute: 0,
    title: "Community Poetry Workshop",
    tagline: "Arts + Literature Laboratory · Drop-in · $12/class",
    description:
      "Monthly drop-in Community Poetry Workshop for adults at Arts + Literature Laboratory (Ellen Kort Mezzanine). Each month is led by a local poet; prompts are provided and participants can share work. 6:30–8:00pm CDT. $12 per class. Register via Sawyer for one or more dates.",
    category: "workshop",
    organizer: "Arts + Literature Laboratory",
    venue: "Ellen Kort Mezzanine at ALL",
    address: ALL_ADDRESS,
    neighborhood: "Madison",
    rsvpUrl: COMMUNITY_POETRY_RSVP,
    rsvpIsGeneralCalendar: true,
    sourceChannel: "literary_org",
    source: "Arts + Literature Laboratory",
    price: "paid",
    priceDetail: "$12/class",
    format: "in-person",
    registrationRequired: true,
  }));
}

function queerTransOpenMicEvents(): CuratedSpec[] {
  /** Last Wednesday of each month, Sep–Dec 2026. */
  const dates = [
    { year: 2026, month: 9, day: 30 },
    { year: 2026, month: 10, day: 28 },
    { year: 2026, month: 11, day: 25 },
    { year: 2026, month: 12, day: 30 },
  ];
  return dates.map(({ year, month, day }) => {
    const ymd = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    return {
      id: `madison-room-queer-trans-open-mic-${ymd.replace(/-/g, "")}`,
      year,
      monthIndex: month - 1,
      day,
      hour: 19,
      minute: 0,
      endHour: 21,
      endMinute: 0,
      title: "Queer & Trans Open Mic",
      tagline: "A Room of One's Own · Masked · Last Wednesday monthly",
      description:
        "Masked Queer & Trans Open Mic at A Room of One’s Own Bookstore, last Wednesday of every month, 7–9pm. Limited to about 15 performers — arrive early to sign up. Queer and trans art welcome (songs, poems, and more).",
      category: "open-mic",
      organizer: "A Room of One's Own",
      venue: "A Room of One's Own Bookstore",
      address: ROOM_ADDRESS,
      neighborhood: "Atwood",
      rsvpUrl: `https://roomofonesown.com/event/${ymd}/queer-trans-open-mic`,
      sourceChannel: "bookstore",
      source: "A Room of One's Own",
      price: "free",
      format: "in-person",
    };
  });
}

function roomOfOnesOwnEvents(): CuratedSpec[] {
  const tabletopDescription =
    "Eastside Tabletop Story Games plays tabletop roleplaying games with a story/narrative focus, heavy roleplay, or nontraditional structures and themes. Signup only — no drop-ins. Click through for scheduled games and signup forms.";

  return [
    {
      id: "madison-room-lit-study-new-skin-20260912",
      year: 2026,
      monthIndex: 8,
      day: 12,
      hour: 15,
      minute: 0,
      endHour: 16,
      endMinute: 0,
      title: "The Lit Study Book Club Discussion of New Skin by Sarah Wang",
      tagline: "A Room of One's Own · Reading Room · Free",
      description:
        "The Lit Study Book Club (hosted by bookseller Jay Lowe) discusses New Skin by Sarah Wang. Meets the second Saturday of the month, 3–4pm, in The Reading Room next door to the bookstore.",
      category: "reading",
      organizer: "A Room of One's Own",
      venue: "The Reading Room",
      address: READING_ROOM_ADDRESS,
      neighborhood: "Atwood",
      rsvpUrl:
        "https://roomofonesown.com/event/2026-09-12/lit-study-book-club-discussion-new-skin-sarah-wang",
      sourceChannel: "bookstore",
      source: "A Room of One's Own",
      price: "free",
      format: "in-person",
      registrationRequired: true,
    },
    {
      id: "madison-room-tabletop-20260915",
      year: 2026,
      monthIndex: 8,
      day: 15,
      hour: 17,
      minute: 45,
      endHour: 20,
      endMinute: 45,
      title: "Eastside Tabletop Story Games: Weekly Game Night",
      tagline: "A Room of One's Own · Reading Room · Signup required",
      description: tabletopDescription,
      category: "other",
      organizer: "Eastside Tabletop Story Games / A Room of One's Own",
      venue: "The Reading Room",
      address: READING_ROOM_ADDRESS,
      neighborhood: "Atwood",
      rsvpUrl:
        "https://roomofonesown.com/event/2026-09-15/eastside-tabletop-story-games-weekly-game-night",
      sourceChannel: "bookstore",
      source: "A Room of One's Own",
      price: "free",
      format: "in-person",
      registrationRequired: true,
    },
    {
      id: "madison-room-tabletop-20260922",
      year: 2026,
      monthIndex: 8,
      day: 22,
      hour: 17,
      minute: 45,
      endHour: 20,
      endMinute: 45,
      title: "Eastside Tabletop Story Games: Weekly Game Night",
      tagline: "A Room of One's Own · Reading Room · Signup required",
      description: tabletopDescription,
      category: "other",
      organizer: "Eastside Tabletop Story Games / A Room of One's Own",
      venue: "The Reading Room",
      address: READING_ROOM_ADDRESS,
      neighborhood: "Atwood",
      rsvpUrl:
        "https://roomofonesown.com/event/2026-09-22/eastside-tabletop-story-games-weekly-game-night",
      sourceChannel: "bookstore",
      source: "A Room of One's Own",
      price: "free",
      format: "in-person",
      registrationRequired: true,
    },
    {
      id: "madison-room-remaking-democracy-20260923",
      year: 2026,
      monthIndex: 8,
      day: 23,
      hour: 18,
      minute: 0,
      endHour: 19,
      endMinute: 0,
      title:
        "Remaking Democracy: How We Make The Worlds We Want by Danielle Chynoweth and Elizabeth Adams with Norman Stockwell and Andy Gricevich",
      tagline: "A Room of One's Own · Book talk · Free",
    description:
      "Book talk and performance stop on the Remaking Democracy tour. Danielle Chynoweth and Elizabeth Adams present Remaking Democracy: How We Make the Worlds We Want — a guidebook for social change — with Norman Stockwell (publisher of The Progressive) and Andy Gricevich (musician, poet, and forager).",
      category: "reading",
      organizer: "A Room of One's Own",
      venue: "A Room of One's Own Bookstore",
      address: ROOM_ADDRESS,
      neighborhood: "Atwood",
      rsvpUrl:
        "https://roomofonesown.com/event/2026-09-23/remaking-democracy-how-we-make-worlds-we-want-danielle-chynoweth-and-elizabeth",
      sourceChannel: "bookstore",
      source: "A Room of One's Own",
      price: "free",
      format: "in-person",
      registrationRequired: true,
    },
    {
      id: "madison-room-serena-chopra-20260924",
      year: 2026,
      monthIndex: 8,
      day: 24,
      hour: 18,
      minute: 0,
      endHour: 19,
      endMinute: 0,
      title:
        "A Catalog of Future Mercies: Poems by Serena Chopra with readings from Patrycja Humienik and Nicholas Gulig",
      tagline: "A Room of One's Own · Poetry · Free",
      description:
        "Poetry reading for Serena Chopra’s A Catalog of Future Mercies, with readings from Patrycja Humienik and Nicholas Gulig.",
      category: "reading",
      organizer: "A Room of One's Own",
      venue: "A Room of One's Own Bookstore",
      address: ROOM_ADDRESS,
      neighborhood: "Atwood",
      rsvpUrl:
        "https://roomofonesown.com/event/2026-09-24/catalog-future-mercies-poems-serena-chopra-readings-patrycja-humienik-and-nicholas",
      sourceChannel: "bookstore",
      source: "A Room of One's Own",
      price: "free",
      format: "in-person",
    },
    {
      id: "madison-room-queer-movie-please-baby-please-20260924",
      year: 2026,
      monthIndex: 8,
      day: 24,
      hour: 19,
      minute: 0,
      endHour: 21,
      endMinute: 0,
      title: "Queer Movie Night: Please Baby Please",
      tagline: "A Room of One's Own · Reading Room · Masks required",
      description:
        "Monthly queer movie night hosted by bookseller Celena using Kanopy’s library. Screening Please Baby Please. Film begins around 7pm in The Reading Room. Masks required.",
      category: "other",
      organizer: "A Room of One's Own",
      venue: "The Reading Room",
      address: READING_ROOM_ADDRESS,
      neighborhood: "Atwood",
      rsvpUrl:
        "https://roomofonesown.com/event/2026-09-24/queer-movie-night-please-baby-please",
      sourceChannel: "bookstore",
      source: "A Room of One's Own",
      price: "free",
      format: "in-person",
      registrationRequired: true,
    },
    {
      id: "madison-room-lit-study-country-people-20261010",
      year: 2026,
      monthIndex: 9,
      day: 10,
      hour: 15,
      minute: 0,
      endHour: 16,
      endMinute: 0,
      title:
        "The Lit Study Book Club Discussion of Country People by Daniel Mason",
      tagline: "A Room of One's Own · Reading Room · Free",
      description:
        "The Lit Study Book Club (hosted by bookseller Jay Lowe) discusses Country People by Daniel Mason. Meets the second Saturday of the month, 3–4pm, in The Reading Room next door to the bookstore.",
      category: "reading",
      organizer: "A Room of One's Own",
      venue: "The Reading Room",
      address: READING_ROOM_ADDRESS,
      neighborhood: "Atwood",
      rsvpUrl:
        "https://roomofonesown.com/event/2026-10-10/lit-study-book-club-discussion-country-people-daniel-mason",
      sourceChannel: "bookstore",
      source: "A Room of One's Own",
      price: "free",
      format: "in-person",
      registrationRequired: true,
    },
    {
      id: "madison-room-oxeye-reading-20261010",
      year: 2026,
      monthIndex: 9,
      day: 10,
      hour: 17,
      minute: 0,
      endHour: 18,
      endMinute: 30,
      title:
        "OXEYE READING SERIES with Kai Ihns, Jamie Thomson, Lena Tsykynovska, and Antonio Vargas-Nieto",
      tagline: "Oxeye Press · Reading Room · 5 PM",
      description:
        "Oxeye Reading Series hosted by Oxeye Press featuring Kai Ihns, Jamie Thomson, Lena Tsykynovska, and Antonio Vargas-Nieto. Saturday, October 10, 5 PM at The Reading Room (next to A Room of One’s Own).",
      category: "reading",
      organizer: "Oxeye Press / A Room of One's Own",
      venue: "The Reading Room",
      address: READING_ROOM_ADDRESS,
      neighborhood: "Atwood",
      rsvpUrl:
        "https://roomofonesown.com/event/2026-10-10/oxeye-reading-series-kai-ihns-jamie-thomson-lena-tsykynovska-and-antonio-vargas",
      sourceChannel: "bookstore",
      source: "A Room of One's Own",
      price: "free",
      format: "in-person",
    },
  ];
}

const CURATED: CuratedSpec[] = [
  {
    id: "madison-monroe-street-library-league-book-sale-20260926",
    year: 2026,
    monthIndex: 8,
    day: 26,
    hour: 10,
    minute: 0,
    endHour: 15,
    endMinute: 0,
    title: "Monroe Street Library League Book Sale",
    tagline: "Monroe Street Library · Free entry · Book sale",
    description:
      "The annual book sale of the Monroe Street Library takes place during the 48th annual Monroe Street Festival on Saturday, September 26 from 10am to 3pm. Stop by and pick up great reads at a great price — proceeds support Madison Public Libraries.",
    category: "other",
    organizer: "Madison Public Library",
    venue: "Monroe Street Library",
    address: MONROE_STREET_ADDRESS,
    neighborhood: "Monroe Street",
    rsvpUrl:
      "https://www.madisonpubliclibrary.org/spaces/events/monroe-street-library-league-book-sale-264227",
    sourceChannel: "library",
    source: "Madison Public Library",
    price: "free",
    priceDetail: "Books priced for sale; entry free",
    format: "in-person",
  },
  {
    id: "madison-patti-smith-songs-stories-20260922",
    year: 2026,
    monthIndex: 8,
    day: 22,
    hour: 19,
    minute: 0,
    endHour: 21,
    endMinute: 0,
    title: "Patti Smith: Songs & Stories",
    tagline: "The Orpheum · A Room of One's Own · Book bundled · Doors 6 PM",
    description:
      "A Room of One’s Own Bookstore presents Patti Smith at The Orpheum for an evening of Songs & Stories, celebrating the paperback release of her memoir Bread of Angels. Every ticket includes a copy of the book (pick up at the Orpheum on the night of the event only; unsigned; no author signing). A Room of One’s Own will also have her other books for sale. Doors 6:00 PM; show 7:00 PM. All ages. Cashless venue.",
    category: "reading",
    organizer: "A Room of One's Own / The Orpheum",
    venue: "The Orpheum Theater",
    address: ORPHEUM_ADDRESS,
    neighborhood: "State Street",
    rsvpUrl:
      "https://madisonorpheum.com/event/patti-smith-songs-stories-book-bundled-event-by-a-room-of-ones-own/",
    sourceChannel: "bookstore",
    source: "The Orpheum / A Room of One's Own",
    price: "paid",
    priceDetail: "Ticket includes Bread of Angels paperback",
    format: "in-person",
    registrationRequired: true,
  },
  {
    id: "madison-mystery-to-me-siri-carpenter-20260915",
    year: 2026,
    monthIndex: 8,
    day: 15,
    hour: 18,
    minute: 0,
    endHour: 19,
    endMinute: 0,
    title: "Siri Carpenter in Conversation with Kelly Tyrrell",
    tagline: "Mystery to Me · Author talk · Free · RSVP required",
    description:
      "Siri Carpenter — cofounder of The Open Notebook and editor of The Best Science Stories and How They Work — discusses the anthology in conversation with Kelly Tyrrell. Please RSVP — seating is limited and guaranteed only for those who RSVP. Livestream available for those who can’t attend in person.",
    category: "reading",
    organizer: "Mystery to Me",
    venue: "Mystery to Me Bookstore",
    address: MYSTERY_TO_ME_ADDRESS,
    neighborhood: "Monroe Street",
    rsvpUrl: "https://www.mysterytomebooks.com/events/5653520260915",
    sourceChannel: "bookstore",
    source: "Mystery to Me",
    price: "free",
    format: "in-person",
    registrationRequired: true,
  },
  {
    id: "madison-mystery-to-me-steve-fox-20260916",
    year: 2026,
    monthIndex: 8,
    day: 16,
    hour: 18,
    minute: 0,
    endHour: 19,
    endMinute: 0,
    title: "Steve Fox in Conversation with Laura Bird",
    tagline: "Mystery to Me · Author talk · Free · RSVP required",
    description:
      "Award-winning author Steve Fox discusses These Are My People, his newest story collection, in conversation with Laura Bird. Please RSVP — seating is limited and guaranteed only for those who RSVP. Livestream available.",
    category: "reading",
    organizer: "Mystery to Me",
    venue: "Mystery to Me Bookstore",
    address: MYSTERY_TO_ME_ADDRESS,
    neighborhood: "Monroe Street",
    rsvpUrl: "https://www.mysterytomebooks.com/events/5885820260916",
    sourceChannel: "bookstore",
    source: "Mystery to Me",
    price: "free",
    format: "in-person",
    registrationRequired: true,
  },
  {
    id: "madison-mystery-to-me-brian-trapp-20260917",
    year: 2026,
    monthIndex: 8,
    day: 17,
    hour: 18,
    minute: 0,
    endHour: 19,
    endMinute: 0,
    title: "Brian Trapp in Conversation with Kristin Voss and Jason Glozier",
    tagline: "Mystery to Me · Author talk · Free · RSVP required",
    description:
      "Brian Trapp discusses his debut novel Range of Motion — about siblings, family, and disability — in conversation with caregiver/activist Kristin Voss (Wisconsin Family and Caregiver Support Alliance), with support from UCP Dane County and Disability Pride Madison. Please RSVP — seating is limited and guaranteed only for those who RSVP. Livestream available.",
    category: "reading",
    organizer: "Mystery to Me",
    venue: "Mystery to Me Bookstore",
    address: MYSTERY_TO_ME_ADDRESS,
    neighborhood: "Monroe Street",
    rsvpUrl: "https://www.mysterytomebooks.com/events/6098820260917",
    sourceChannel: "bookstore",
    source: "Mystery to Me",
    price: "free",
    format: "in-person",
    registrationRequired: true,
  },
  {
    id: "madison-mystery-to-me-ann-garvin-20260922",
    year: 2026,
    monthIndex: 8,
    day: 22,
    hour: 18,
    minute: 0,
    endHour: 19,
    endMinute: 0,
    title: "Ann Garvin in Conversation with Jeff Oloizia",
    tagline: "Mystery to Me · Author talk · Free · RSVP required",
    description:
      "Ann Garvin discusses Tell Two Friends in conversation with Jeff Oloizia at Mystery to Me. In person and livestreamed on Crowdcast. Please RSVP — seating is limited and guaranteed only for those who RSVP.",
    category: "reading",
    organizer: "Mystery to Me",
    venue: "Mystery to Me Bookstore",
    address: MYSTERY_TO_ME_ADDRESS,
    neighborhood: "Monroe Street",
    rsvpUrl: "https://www.mysterytomebooks.com/events/6060220260922",
    sourceChannel: "bookstore",
    source: "Mystery to Me",
    price: "free",
    format: "in-person",
    registrationRequired: true,
  },
  {
    id: "madison-mystery-to-me-monroe-street-festival-20260926",
    year: 2026,
    monthIndex: 8,
    day: 26,
    hour: 9,
    minute: 0,
    endHour: 17,
    endMinute: 0,
    title: "Monroe Street Festival",
    tagline: "Mystery to Me · Street festival · Free",
    description:
      "Monroe Street Festival day — stop by Mystery to Me to browse, say hi, and see what special things the bookstore has going on during the festival.",
    category: "other",
    organizer: "Mystery to Me",
    venue: "Mystery to Me Bookstore",
    address: MYSTERY_TO_ME_ADDRESS,
    neighborhood: "Monroe Street",
    rsvpUrl: "https://www.mysterytomebooks.com/events/6297820260926",
    sourceChannel: "bookstore",
    source: "Mystery to Me",
    price: "free",
    format: "in-person",
  },
  {
    id: "madison-mystery-to-me-wbf-catherine-jagoe-20260930",
    year: 2026,
    monthIndex: 8,
    day: 30,
    hour: 19,
    minute: 0,
    endHour: 20,
    endMinute: 0,
    title: "WBF Presents: Catherine Jagoe in Conversation with Heather Swan",
    tagline: "Wisconsin Book Festival · Central Library · Free",
    description:
      "Wisconsin Book Festival / Mystery to Me present Catherine Jagoe discussing her memoir in essays Unbelonging — immigration, identity, and feeling in-between — in conversation with Heather Swan. Offsite at Madison Public Library Central Library, Community Rooms 301/2.",
    category: "reading",
    organizer: "Wisconsin Book Festival / Mystery to Me",
    venue: "Madison Public Library — Central Library (Community Rooms 301/2)",
    address: "201 W. Mifflin Street, Madison, WI 53703",
    neighborhood: "Downtown",
    rsvpUrl: "https://www.mysterytomebooks.com/events/6163220260930",
    sourceChannel: "bookstore",
    source: "Mystery to Me / Wisconsin Book Festival",
    price: "free",
    format: "in-person",
  },
  {
    id: "madison-moth-grandslam-20261002",
    year: 2026,
    monthIndex: 9,
    day: 2,
    hour: 19,
    minute: 30,
    endHour: 21,
    endMinute: 30,
    title: "The Moth Grandslam Championship — Fuel to the Fire",
    tagline: "Barrymore Theatre · $36 advance · Doors 6:30 PM",
    description:
      "Live in Madison. The ultimate storytelling showdown: The Moth GrandSLAM invites 10 winners from open-mic StorySLAMs back to the stage to compete for the title of Madison storytelling champion. Theme: Fuel to the Fire — tales of escalation and acceleration. Box office 6:00 PM; doors 6:30 PM; show 7:30 PM. General admission, all-seated. Advance tickets $36; fee-free at ticket outlets (online fees may apply).",
    category: "other",
    organizer: "The Moth",
    venue: "The Barrymore Theatre",
    address: BARRYMORE_ADDRESS,
    neighborhood: "Atwood",
    rsvpUrl: "https://barrymorelive.com/event/the-moth-grandslam/",
    sourceChannel: "theater_arts",
    source: "Barrymore Theatre / The Moth",
    price: "paid",
    priceDetail: "$36 advance",
    format: "in-person",
    registrationRequired: true,
  },
  {
    id: "madison-andrea-gibson-love-letter-afterlife-20261105",
    year: 2026,
    monthIndex: 10,
    day: 5,
    hour: 19,
    minute: 30,
    endHour: 21,
    endMinute: 30,
    title: "Andrea Gibson’s Love Letter from the Afterlife",
    tagline: "Barrymore Theatre · Ticketmaster · Doors 6:30 PM",
    description:
      "FPC Live presents Andrea Gibson’s Love Letter from the Afterlife — a multimedia event of film, live poetry, music, and orchestral accompaniment. At the heart of the evening is a film of Gibson’s final live performance at Denver’s Paramount Theatre, with The Goosebumps Orchestra performing Blake Neely’s original score live, Megan Falley sharing stories, and extremely special guests. Doors 6:30 PM; show 7:30 PM. Reserved seating. Tickets only via Ticketmaster.",
    category: "reading",
    organizer: "FPC Live / The Barrymore Theatre",
    venue: "The Barrymore Theatre",
    address: BARRYMORE_ADDRESS,
    neighborhood: "Atwood",
    rsvpUrl: "https://barrymorelive.com/event/love-letter-afterlife/",
    sourceChannel: "theater_arts",
    source: "Barrymore Theatre",
    price: "paid",
    priceDetail: "Tickets via Ticketmaster",
    format: "in-person",
    registrationRequired: true,
  },
  {
    id: "madison-wbf-emily-st-john-mandel-20260925",
    year: 2026,
    monthIndex: 8,
    day: 25,
    hour: 19,
    minute: 0,
    endHour: 20,
    endMinute: 0,
    title:
      "Wisconsin Book Festival Presents Emily St. John Mandel for Exit Party",
    tagline: "Wisconsin Book Festival · Overture Center · Free · Doors 6 PM",
    description:
      "Wisconsin Book Festival presents Emily St. John Mandel discussing her novel Exit Party. Free and open to the public on a first-come, first-served basis; seating is general admission. Doors open at 6:00 PM. Offsite at Overture Center.",
    category: "reading",
    organizer: "Wisconsin Book Festival / Madison Public Library",
    venue: "Overture Center",
    address: "201 State Street, Madison, WI 53703",
    neighborhood: "Downtown",
    rsvpUrl:
      "https://www.madisonpubliclibrary.org/spaces/events/wisconsin-book-festival-presents-emily-st-john-mandel-exit-party-247974",
    sourceChannel: "library",
    source: "Madison Public Library / Wisconsin Book Festival",
    price: "free",
    format: "in-person",
  },
  {
    id: "madison-wbf-chad-harbach-20261028",
    year: 2026,
    monthIndex: 9,
    day: 28,
    hour: 19,
    minute: 0,
    endHour: 20,
    endMinute: 0,
    title:
      "Wisconsin Book Festival Presents Chad Harbach for The Brightness (with Jeff Oloizia)",
    tagline: "Wisconsin Book Festival · Central Library · Free",
    description:
      "Wisconsin Book Festival presents Chad Harbach, bestselling author of The Art of Fielding, discussing his novel The Brightness in conversation with Jeff Oloizia. The book follows two young women, Pella and Irma, navigating friendship, love, and loss from Westish College into the wider world. Pre-signed copies of The Brightness will be distributed free to attendees, courtesy of the Wisconsin Book Festival. Madison Room, Central Library, 201 W. Mifflin St.",
    category: "reading",
    organizer: "Wisconsin Book Festival / Madison Public Library",
    venue: "Madison Public Library — Central Library (Madison Room)",
    address: "201 W. Mifflin Street, Madison, WI 53703",
    neighborhood: "Downtown",
    rsvpUrl:
      "https://www.madisonpubliclibrary.org/spaces/events/wisconsin-book-festival-presents-chad-harbach-brightness-253494",
    sourceChannel: "library",
    source: "Madison Public Library / Wisconsin Book Festival",
    price: "free",
    format: "in-person",
  },
  {
    id: "madison-mpl-third-thursday-stationery-shop-20261217",
    year: 2026,
    monthIndex: 11,
    day: 17,
    hour: 14,
    minute: 0,
    endHour: 15,
    endMinute: 0,
    title: 'Third Thursday Book Discussion: The Stationery Shop',
    tagline: "Sequoya Library · Free · New members welcome",
    description:
      'Join Sequoya Library for a discussion of The Stationery Shop by Marjan Kamali. New members always welcome; copies of the book may be available at the Ask Desk. Meeting Rooms A and B Combined.',
    category: "reading",
    organizer: "Madison Public Library",
    venue: "Sequoya Library",
    address: "4340 Tokay Boulevard, Madison, WI 53711",
    neighborhood: "Sequoya",
    rsvpUrl:
      "https://www.madisonpubliclibrary.org/spaces/events/third-thursday-book-discussion-stationery-shop-220221",
    sourceChannel: "library",
    source: "Madison Public Library",
    price: "free",
    format: "in-person",
  },
  {
    id: "madison-all-september-watershed-20260919",
    year: 2026,
    monthIndex: 8,
    day: 19,
    hour: 19,
    minute: 0,
    endHour: 20,
    endMinute: 30,
    title: "September Watershed Reading",
    tagline: "Arts + Literature Laboratory · Free · Doors 6:30 PM",
    description:
      "Watershed Reading Series at Arts + Literature Laboratory featuring Nick Demske, Rebecca Hewitt, and Blaine Michael Purcell. Doors at 6:30pm; reading at 7:00pm. Admission is free; donations appreciated. Assistive hearing devices available (reserve via liz@artlitlab.org).",
    category: "reading",
    organizer: "Arts + Literature Laboratory",
    venue: "Arts + Literature Laboratory",
    address: ALL_ADDRESS,
    neighborhood: "Madison",
    rsvpUrl: "https://artlitlab.org/events/september-watershed-reading-5",
    sourceChannel: "literary_org",
    source: "Arts + Literature Laboratory",
    price: "free",
    priceDetail: "Free; donations appreciated",
    format: "in-person",
  },
  {
    id: "madison-all-falconbridge-don-juan-20260929",
    year: 2026,
    monthIndex: 8,
    day: 29,
    hour: 19,
    minute: 0,
    endHour: 21,
    endMinute: 0,
    title: "Falconbridge Players: Don Juan",
    tagline: "Arts + Literature Laboratory · Staged reading · Free",
    description:
      "For one night only, Falconbridge Players presents a staged reading of a comedy classic of outrageous morals and undeniable charm. A comedy by Molière about the free thinker, and even more free lover, Don Juan. The so-called Seducer of Seville takes on Heaven, Hell, and even his disgruntled servant Sganarelle in search of pleasure and independence. Admission is free, but donations are greatly appreciated.",
    category: "reading",
    organizer: "Falconbridge Players / Arts + Literature Laboratory",
    venue: "Arts + Literature Laboratory",
    address: ALL_ADDRESS,
    neighborhood: "Madison",
    rsvpUrl: "https://artlitlab.org/events/falconbridge-players-don-juan",
    sourceChannel: "literary_org",
    source: "Arts + Literature Laboratory",
    price: "free",
    priceDetail: "Free; donations greatly appreciated",
    format: "in-person",
  },
  {
    id: "madison-all-creature-feature-dean-young-20261007",
    year: 2026,
    monthIndex: 9,
    day: 7,
    hour: 19,
    minute: 0,
    endHour: 20,
    endMinute: 30,
    title: "CREATURE FEATURE: A Reading Celebrating the late poet Dean Young",
    tagline: "ALL · Monsters of Poetry / Copper Canyon · Free",
    description:
      "Monsters of Poetry and Copper Canyon Press host a tribute reading for the late poet Dean Young. Matt Hart and Dobby Gibson (co-editors of Young’s posthumous collection Creature Feature) MC, with readings by Matthew Guenette and Nicholas Gulig. Audience members may bring one Dean Young poem to read open-mic style (Young’s poems only). Admission is free; donations encouraged.",
    category: "reading",
    organizer: "Arts + Literature Laboratory",
    venue: "Arts + Literature Laboratory",
    address: ALL_ADDRESS,
    neighborhood: "Madison",
    rsvpUrl:
      "https://artlitlab.org/events/creature-feature-a-reading-celebrating-the-late-poet-dean-young",
    sourceChannel: "literary_org",
    source: "Arts + Literature Laboratory",
    price: "free",
    priceDetail: "Free; donations encouraged",
    format: "in-person",
  },
  {
    id: "madison-all-november-watershed-20261121",
    year: 2026,
    monthIndex: 10,
    day: 21,
    hour: 19,
    minute: 0,
    endHour: 20,
    endMinute: 30,
    title: "November Watershed Reading",
    tagline: "Arts + Literature Laboratory · Free · Doors 6:30 PM",
    description:
      "Watershed Reading Series at Arts + Literature Laboratory featuring Holli Carrell, Cathryn Cofell, Megan O'Gieblyn, and Melissa Range. Doors at 6:30pm; reading at 7:00pm. Admission is free; donations gratefully accepted. Assistive hearing devices available (reserve via liz@artlitlab.org).",
    category: "reading",
    organizer: "Arts + Literature Laboratory",
    venue: "Arts + Literature Laboratory",
    address: ALL_ADDRESS,
    neighborhood: "Madison",
    rsvpUrl: "https://artlitlab.org/events/november-watershed-reading-2",
    sourceChannel: "literary_org",
    source: "Arts + Literature Laboratory",
    price: "free",
    priceDetail: "Free; donations accepted",
    format: "in-person",
  },
  {
    id: "madison-all-falconbridge-conscience-20261208",
    year: 2026,
    monthIndex: 11,
    day: 8,
    hour: 19,
    minute: 0,
    endHour: 21,
    endMinute: 0,
    title: "Falconbridge Players: Conscience",
    tagline: "Arts + Literature Laboratory · Staged reading · Free",
    description:
      "Falconbridge Players presents a staged reading of a 1924 psycho-melodrama by Don Mullally: labor organizer Jeff and diner waitress Madeline meet, fall in love, and marry in Nowhere, Washington State. One night only. Admission is free; donations greatly encouraged.",
    category: "reading",
    organizer: "Falconbridge Players / Arts + Literature Laboratory",
    venue: "Arts + Literature Laboratory",
    address: ALL_ADDRESS,
    neighborhood: "Madison",
    rsvpUrl: "https://artlitlab.org/events/falconbridge-players-conscience",
    sourceChannel: "literary_org",
    source: "Arts + Literature Laboratory",
    price: "free",
    priceDetail: "Free; donations encouraged",
    format: "in-person",
  },
  {
    id: "madison-all-midwest-video-poetry-fest-20270417",
    year: 2027,
    monthIndex: 3,
    day: 17,
    hour: 12,
    minute: 0,
    title: "Midwest Video Poetry Fest (MVPF)",
    tagline: "Arts + Literature Laboratory · Save the date · Time TBD",
    description:
      "Save the date for the next Midwest Video Poetry Fest on Saturday, April 17, 2027 at Arts + Literature Laboratory. Launched by ALL in 2020, MVPF is Wisconsin’s first video poetry festival—narrative, animation, experimental, spoken word, and more—drawing an international community with Wisconsin roots (over 2,000 submissions from 92+ countries in its first five years). Submissions open through December 15, 2026; notifications by March 1, 2027 (FilmFreeway). Exact screening times TBA.",
    category: "other",
    organizer: "Arts + Literature Laboratory",
    venue: "Arts + Literature Laboratory",
    address: ALL_ADDRESS,
    neighborhood: "Madison",
    rsvpUrl:
      "https://artlitlab.org/programs/literary-arts/midwest-video-poetry-fest",
    rsvpIsGeneralCalendar: true,
    sourceChannel: "literary_org",
    source: "Arts + Literature Laboratory",
    price: "unknown",
    format: "in-person",
    timeTbd: true,
  },
  {
    id: "madison-newbridge-ocean-vuong-20261007",
    year: 2026,
    monthIndex: 9,
    day: 7,
    hour: 10,
    minute: 0,
    endHour: 11,
    endMinute: 0,
    title:
      'NewBridge Book Discussion of "On Earth, We\'re Briefly Gorgeous" by Ocean Vuong',
    tagline: "NewBridge · Online · Free",
    description:
      'Join us for a book discussion of "On Earth, We\'re Briefly Gorgeous" by Ocean Vuong. New members always welcome! Please check with library staff for location or Zoom link.',
    category: "reading",
    organizer: "NewBridge / Madison Public Library",
    format: "virtual",
    virtualLabel: "Online",
    neighborhood: "Madison",
    rsvpUrl:
      "https://www.madisonpubliclibrary.org/spaces/events/newbridge-book-discussion-earth-were-briefly-gorgeous-ocean-vuong-81276",
    sourceChannel: "library",
    source: "Madison Public Library",
    price: "free",
  },
  {
    id: "madison-newbridge-niall-williams-20261104",
    year: 2026,
    monthIndex: 10,
    day: 4,
    hour: 10,
    minute: 0,
    endHour: 11,
    endMinute: 0,
    title:
      'NewBridge Book Discussion of "This is Happiness" by Niall Williams',
    tagline: "NewBridge · Online · Free",
    description:
      'Join us for a book discussion of "This is Happiness" by Niall Williams. New members always welcome! Please check with library staff for location or Zoom link.',
    category: "reading",
    organizer: "NewBridge / Madison Public Library",
    format: "virtual",
    virtualLabel: "Online",
    neighborhood: "Madison",
    rsvpUrl:
      "https://www.madisonpubliclibrary.org/spaces/events/newbridge-book-discussion-happiness-niall-williams-314296",
    sourceChannel: "library",
    source: "Madison Public Library",
    price: "free",
  },
  {
    id: "madison-newbridge-adib-khoram-20261202",
    year: 2026,
    monthIndex: 11,
    day: 2,
    hour: 10,
    minute: 0,
    endHour: 11,
    endMinute: 0,
    title:
      'NewBridge Book Discussion of "Darius the Great is Not Okay" by Adib Khoram',
    tagline: "NewBridge · Online · Free",
    description:
      'Join us for a book discussion of "Darius the Great is Not Okay" by Adib Khoram. New members always welcome! Please check with library staff for location or Zoom link.',
    category: "reading",
    organizer: "NewBridge / Madison Public Library",
    format: "virtual",
    virtualLabel: "Online",
    neighborhood: "Madison",
    rsvpUrl:
      "https://www.madisonpubliclibrary.org/spaces/events/newbridge-book-discussion-darius-great-not-okay-adib-khoram-229878",
    sourceChannel: "library",
    source: "Madison Public Library",
    price: "free",
  },
  ...micOnStateEvents(),
  ...gennasOpenMicEvents(),
  ...communityPoetryWorkshopEvents(),
  ...roomOfOnesOwnEvents(),
  ...queerTransOpenMicEvents(),
];

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
    { zone: TZ },
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
          { zone: TZ },
        )
      : start.plus({ hours: 1 });

  return {
    id: spec.id,
    cityId: CITY_ID,
    title: spec.title,
    tagline: spec.tagline,
    description: spec.description,
    start: start.toISO() ?? start.toString(),
    end: end.toISO() ?? undefined,
    timeTbd: spec.timeTbd,
    timeZone: TZ,
    format: spec.format ?? "in-person",
    price: spec.price ?? "unknown",
    priceDetail: spec.priceDetail,
    registrationRequired: spec.registrationRequired,
    category: spec.category,
    organizer: spec.organizer,
    venue: spec.venue,
    address: spec.address,
    neighborhood: spec.neighborhood,
    virtualLabel: spec.virtualLabel,
    rsvpUrl: spec.rsvpUrl,
    rsvpIsGeneralCalendar: spec.rsvpIsGeneralCalendar,
    source: spec.source ?? "Madison curated listings",
    sourceChannel: spec.sourceChannel,
    listingProvenance: "live",
  };
}

export type MadisonCuratedMeta = {
  curatedTotal: number;
  rowsInMonth: number;
};

export function fetchMadisonCuratedEventsForMonth(
  year: number,
  monthIndex: number,
): { events: WorkshopEvent[]; meta: MadisonCuratedMeta } {
  const rows = CURATED.filter(
    (e) => e.year === year && e.monthIndex === monthIndex,
  ).map(mapSpec);
  rows.sort(
    (a, b) => new Date(a.start).getTime() - new Date(b.start).getTime(),
  );
  return {
    events: rows,
    meta: { curatedTotal: CURATED.length, rowsInMonth: rows.length },
  };
}
