import { DateTime } from "luxon";
import type { WorkshopEvent } from "@/lib/workshop-types";

const TZ = "America/New_York";

type CuratedSpec = {
  id: string;
  year: number;
  monthIndex: number;
  day: number;
  hour: number;
  minute?: number;
  endHour?: number;
  endMinute?: number;
  title: string;
  tagline: string;
  description: string;
  category: WorkshopEvent["category"];
  organizer: string;
  venue: string;
  address: string;
  neighborhood: string;
  rsvpUrl?: string;
  price?: WorkshopEvent["price"];
  priceDetail?: string;
  registrationRequired?: boolean;
};

const EVENTS: CuratedSpec[] = [
  {
    id: "dmv-annapolis-dog-days-doggerel-challenge-20260829",
    year: 2026,
    monthIndex: 7,
    day: 29,
    hour: 11,
    minute: 0,
    endHour: 12,
    endMinute: 0,
    title: "Dog Days Doggerel Challenge Redux",
    tagline: "Poet Laureate of Annapolis · St. Luke's Church · Free · Intent required",
    description:
      "Jefferson Holland, Poet Laureate of Annapolis, invites fellow poets to the second annual Dog Days Doggerel Challenge to benefit the SPCA of Anne Arundel County. Write a poem in any style about your favorite canine—your own pet or one from fiction or popular culture—and gather to share your work (haiku, sonnet, limerick, ballad—any form welcome). Well-behaved dogs are invited to the garden program; a potluck picnic follows. Only the first 20 poets to respond will be invited to share. Send a note of intent to participate to annapolispoetlaureate@gmail.com by 5 p.m. Friday, August 7; finished poems (one page, double-spaced) are due to the same address by 5 p.m. Monday, August 17. An optional $10 donation to the SPCA is welcome at the event but not required. Bring a picnic dish to share after the program.",
    category: "reading",
    organizer: "Jefferson Holland, Poet Laureate of Annapolis",
    venue: "St. Luke's Church garden",
    address: "1101 Bay Ridge Avenue, Annapolis, MD 21403",
    neighborhood: "Eastport, Annapolis",
    rsvpUrl: "mailto:annapolispoetlaureate@gmail.com",
    price: "free",
    priceDetail: "Free · optional $10 SPCA donation",
    registrationRequired: true,
  },
  {
    id: "dmv-sjc-poets-conversation-room-robert-pinsky-20260919",
    year: 2026,
    monthIndex: 8,
    day: 19,
    hour: 14,
    minute: 0,
    endHour: 16,
    endMinute: 0,
    title: "Poets in the Conversation Room: Robert Pinsky",
    tagline: "St. John's College · Annapolis · Free · Registration requested",
    description:
      "A rare event for the poetry community—free and open to the public. Former U.S. Poet Laureate Robert Pinsky joins St. John's College for an afternoon of poetry and conversation as part of the third season of Poets in the Conversation Room. Admission is free, but advance registration is requested. Copies of Robert Pinsky's books will be available for purchase before and after the event.",
    category: "reading",
    organizer: "St. John's College",
    venue: "Francis Scott Key Auditorium — St. John's College",
    address: "60 College Ave, Annapolis, MD 21401",
    neighborhood: "Annapolis",
    rsvpUrl:
      "https://events.sjc.edu/event/poets-in-the-conversation-room-robert-pinsky",
    price: "free",
    priceDetail: "Free · registration requested",
    registrationRequired: true,
  },
];

function mapSpec(spec: CuratedSpec): WorkshopEvent {
  const start = DateTime.fromObject(
    {
      year: spec.year,
      month: spec.monthIndex + 1,
      day: spec.day,
      hour: spec.hour,
      minute: spec.minute ?? 0,
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
      : start.plus({ hours: 2 });

  return {
    id: spec.id,
    cityId: "dmv",
    title: spec.title,
    tagline: spec.tagline,
    description: spec.description,
    start: start.toISO() ?? start.toString(),
    end: end.toISO() ?? undefined,
    timeZone: TZ,
    format: "in-person",
    price: spec.price ?? "unknown",
    priceDetail: spec.priceDetail,
    registrationRequired: spec.registrationRequired,
    category: spec.category,
    organizer: spec.organizer,
    venue: spec.venue,
    address: spec.address,
    neighborhood: spec.neighborhood,
    rsvpUrl: spec.rsvpUrl,
    source: "DMV curated listings",
    sourceChannel: "literary_org",
    listingProvenance: "live",
  };
}

export type DmvCuratedMeta = {
  curatedTotal: number;
  rowsInMonth: number;
};

export function fetchDmvCuratedEventsForMonth(
  year: number,
  monthIndex: number,
): { events: WorkshopEvent[]; meta: DmvCuratedMeta } {
  const rows = EVENTS.filter(
    (e) => e.year === year && e.monthIndex === monthIndex,
  ).map(mapSpec);
  rows.sort(
    (a, b) => new Date(a.start).getTime() - new Date(b.start).getTime(),
  );
  return {
    events: rows,
    meta: { curatedTotal: EVENTS.length, rowsInMonth: rows.length },
  };
}
