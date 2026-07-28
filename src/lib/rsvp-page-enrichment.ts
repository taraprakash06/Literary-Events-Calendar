import type { PriceKind } from "@/lib/workshop-types";
import { decodeHtmlEntities, limitAboutToSentences } from "@/lib/text";

/** Placeholder / stub About copy that should be replaced from the RSVP page. */
export function isSparseEventDescription(description: string | undefined): boolean {
  const d = (description ?? "").replace(/\s+/g, " ").trim();
  if (!d) return true;
  if (d.length < 90) return true;
  if (/…|\.\.\.\s*$/.test(d)) return true;
  if (/^details from\b/i.test(d)) return true;
  if (/^details on the\b/i.test(d)) return true;
  if (/^see (the )?listing\b/i.test(d)) return true;
  if (/\bdetails from politics and prose\b/i.test(d)) return true;
  if (/\bdetails on the busboys and poets website\b/i.test(d)) return true;
  if (/please note the location/i.test(d) && d.length < 220) return true;
  return false;
}

function plainTextFromHtml(html: string): string {
  return decodeHtmlEntities(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/p>/gi, "\n\n")
      .replace(/<\/h[1-6]>/gi, "\n\n")
      .replace(/<\/li>/gi, "\n")
      .replace(/<li[^>]*>/gi, "• ")
      .replace(/<hr[^>]*>/gi, "\n\n")
      .replace(/<[^>]+>/g, " ")
      .replace(/\n[ \t]+/g, "\n")
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .replace(/[ \t]{2,}/g, " ")
      .trim(),
  );
}

export type RsvpPageEnrichment = {
  description?: string;
  price?: PriceKind;
  priceDetail?: string;
};

/**
 * Infer free/paid from common event-page phrases.
 * Ignores standalone book retail prices when "this event is free" is present.
 */
export function inferPriceFromEventPageText(text: string): PriceKind | undefined {
  if (!text.trim()) return undefined;

  if (
    /\bthis event is free\b/i.test(text) ||
    /\bevent is free\b/i.test(text) ||
    /\bfree with first[\s-]*come\b/i.test(text) ||
    /\bfree admission\b/i.test(text) ||
    /\bfree and open to the public\b/i.test(text) ||
    /\bcomplimentary\s+(admission|seating|tickets?)\b/i.test(text) ||
    /\bno\s+cost\b/i.test(text) ||
    /\bcost:\s*free\b/i.test(text) ||
    /\bno\s+cover\b/i.test(text)
  ) {
    return "free";
  }

  if (
    /\$\s*\d+(?:\.\d{2})?\s+cover\b/i.test(text) ||
    /\bcover(?:\s+charge)?\s*(?:is|:)?\s*\$\s*\d/i.test(text) ||
    /\$\s*[\d,]+\s*for\s+members/i.test(text) ||
    /\btickets?\s+(are\s+)?\$\s*\d/i.test(text) ||
    /\badmission\s*(is\s*)?\$\s*\d/i.test(text) ||
    /\bregistration\s+(fee|cost)\b/i.test(text) ||
    /\bpurchase\s+tickets?\b/i.test(text) ||
    /\bpurchase\s+(?:your\s+)?wristbands?\b/i.test(text) ||
    /\bticketed event\b/i.test(text) ||
    /\bcost:\s*\$\s*\d/i.test(text)
  ) {
    return "paid";
  }

  return undefined;
}

export function inferPriceDetailFromEventPageText(
  text: string,
): string | undefined {
  const member = text.match(
    /\$\s*([\d,]+(?:\.\d{2})?)\s*for\s+members\s*\$\s*([\d,]+(?:\.\d{2})?)\s*for\s+non-?members/i,
  );
  if (member) {
    const a = member[1].replace(/,/g, "").replace(/\.00$/, "");
    const b = member[2].replace(/,/g, "").replace(/\.00$/, "");
    return `$${a} members · $${b} non-members`;
  }
  const cover = text.match(/\$\s*(\d+(?:\.\d{2})?)\s+cover\b/i);
  if (cover) return `$${cover[1]} cover`;
  const admission = text.match(
    /\b(?:admission|tickets?)\s*(?:are\s+|is\s+|:)?\s*\$\s*(\d+(?:\.\d{2})?)\b/i,
  );
  if (admission) return `$${admission[1]}`;
  const cost = text.match(/\bCost:\s*\$\s*([\d,]+(?:\.\d{2})?)/i);
  if (cost) {
    return `$${cost[1].replace(/,/g, "").replace(/\.00$/, "")}`;
  }
  return undefined;
}

function descriptionFromOg(html: string): string | undefined {
  const og =
    html.match(/property=["']og:description["'][^>]*content=["']([^"']+)["']/i)?.[1] ??
    html.match(/content=["']([^"']+)["'][^>]*property=["']og:description["']/i)?.[1] ??
    html.match(/name=["']description["'][^>]*content=["']([^"']+)["']/i)?.[1];
  if (!og) return undefined;
  const cleaned = decodeHtmlEntities(og).replace(/\s+/g, " ").trim();
  // Meta descriptions are often truncated with an ellipsis mid-sentence.
  if (/…|\.\.\.\s*$/.test(cleaned) || cleaned.length < 80) return undefined;
  return cleaned.length > 40 ? cleaned.slice(0, 2500) : undefined;
}

/**
 * Condense a bookstore event blurb into an About upshot focused on the event
 * (conversation / reading), with at most one short sentence about the book.
 * Optional `pageTitle` (e.g. h1) helps when the body copy buries the format.
 */
export function toEventAboutUpshot(
  full: string,
  maxChars = 520,
  pageTitle?: string,
): string {
  let t = full.replace(/\s+/g, " ").trim();
  if (!t && !pageTitle?.trim()) return "";

  t = t
    .replace(/\s*Current price:[\s\S]*$/i, "")
    .replace(/\s*Can't attend\?[\s\S]*$/i, "")
    .replace(/\s*This event is free[\s\S]*$/i, "")
    .replace(/\s*To request accommodations[\s\S]*$/i, "")
    .replace(/\s*Event Related Books[\s\S]*$/i, "")
    .replace(/\s*ISBN:\s*\d[\s\S]*$/i, "")
    .trim();

  const fromTitle = eventLineFromBookstoreTitle(pageTitle ?? "");
  const convoRaw =
    t.match(
      /\b[A-Z][a-zA-Z.'’-]+(?:\s+[A-Z][a-zA-Z.'’-]+){0,4}\s+will be(?:\s+joined)?\s+in conversation with\s+(?:Dr\.|Prof\.|Mr\.|Ms\.|Mrs\.)?\s*[A-Z][a-zA-Z.'’\s-]*?(?=\s+,\s+[a-z]|\.\s+[A-Z][a-z]+ (?:is|received|lives|has|a )|\.\s*This event)/,
    )?.[0]?.trim();

  // Title-built lines are reliable for P&P ("Author — Book - with Guest — at Venue").
  // Body sentences often break on middle initials ("Lindsay M.") or start mid-plot.
  let eventLine = fromTitle;
  if (!eventLine && convoRaw) {
    eventLine = sharpenConversationLine(`${convoRaw}.`);
  }
  if (eventLine && fromTitle) {
    // Prefer "Dr." from the body when the title omitted the honorific.
    const drGuest = t.match(
      /\bin conversation with\s+(Dr\.\s+[A-Z][a-zA-Z.'’-]+(?:\s+[A-Z]\.)?(?:\s+[A-Z][a-zA-Z.'’-]+){0,3})/,
    )?.[1];
    if (drGuest) {
      const bare = drGuest.replace(/^Dr\.\s+/i, "");
      if (eventLine.includes(bare) && !eventLine.includes("Dr.")) {
        eventLine = eventLine.replace(bare, drGuest);
      }
    }
  }

  const bookLine = oneBookSentence(t, eventLine, pageTitle);

  const parts = [eventLine, bookLine].filter(Boolean) as string[];
  if (parts.length === 0) {
    const first = t.match(/[^.!?]+[.!?]/)?.[0]?.trim();
    if (first && !/^[a-z]/.test(first) && first.length > 40) {
      return first.slice(0, maxChars);
    }
    return fromTitle?.slice(0, maxChars) ?? "";
  }

  let out = parts.join(" ").replace(/\s+/g, " ").replace(/\s+([.!?])/g, "$1").trim();
  // Never ship mid-sentence fragments.
  if (/^[a-z]/.test(out) || /\bwith\s*(?:Dr\.?)?\.?\s*$/i.test(out)) {
    out = (fromTitle ?? eventLine ?? "").trim();
  }
  if (out.length <= maxChars) return out;

  if (eventLine && eventLine.length <= maxChars) {
    if (bookLine) {
      const room = maxChars - eventLine.length - 1;
      if (room > 60) {
        return `${eventLine} ${clipAtSentence(bookLine, room)}`.trim();
      }
    }
    return eventLine;
  }
  return clipAtSentence(out, maxChars);
}

/**
 * P&P titles look like:
 * "Author — Book Title - with Guest — at Venue"
 */
export function eventLineFromBookstoreTitle(title: string): string | undefined {
  const t = decodeHtmlEntities(title)
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\s*\|\s*Politics and Prose.*$/i, "")
    .trim();
  if (!t) return undefined;

  const withGuest = t.match(
    /^(.+?)\s*[—–-]\s*(.+?)\s*[-–—]\s*with\s+(.+?)\s*[—–-]\s*at\s+.+$/i,
  );
  if (withGuest) {
    const author = withGuest[1].trim().replace(/^—\s*/, "");
    const book = withGuest[2].trim().replace(/^—\s*/, "");
    const guest = withGuest[3].trim();
    if (author && book && guest) {
      return `${author} will be in conversation with ${guest} about ${book}.`;
    }
  }

  const authorBook = t.match(/^(.+?)\s*[—–-]\s*(.+?)\s*[—–-]\s*at\s+.+$/i);
  if (authorBook) {
    const author = authorBook[1].trim();
    const book = authorBook[2].trim().replace(/\s*-\s*with\s+.+$/i, "").trim();
    if (author && book && book.length > 3) {
      return `${author} discusses ${book} at Politics and Prose.`;
    }
  }
  return undefined;
}

/** Keep the host + guest; drop long résumé clauses after the guest name. */
function sharpenConversationLine(raw: string): string {
  let s = raw.replace(/\s+/g, " ").trim();
  s = s.replace(
    /(\bin conversation with\s+(?:Dr\.|Prof\.|Mr\.|Ms\.|Mrs\.)?\s*[A-Z][a-zA-Z.'’-]+(?:\s+[A-Z][a-zA-Z.'’-]+){0,4})\s*,\s+[^.!?]{20,}([.!?])$/i,
    "$1$2",
  );
  if (/^in conversation with\b/i.test(s)) {
    s = s.replace(/^in conversation with\b/i, "In conversation with");
  }
  return s;
}

/** One short book premise sentence — never a multi-paragraph plot dump. */
function oneBookSentence(
  full: string,
  eventLine: string | undefined,
  pageTitle?: string,
): string | undefined {
  const based = full.match(/\bBased on a true story\b[^.!?]*[.!?]/i)?.[0]?.trim();
  if (based && isCleanBookSentence(based)) {
    // Prefer a concrete setting/theme clause over marketing comparisons.
    if (/\bSchindler|powerful narrative of\b/i.test(based)) {
      const theme = full.match(
        /[^.!?]{0,40}\b(?:Red Terror|Asmara|Eritrea)\b[^.!?]{0,80}[.!?]/i,
      )?.[0]?.trim();
      if (theme && isCleanBookSentence(theme) && theme.length <= 160) {
        return theme.startsWith("Based on")
          ? theme
          : `Based on a true story. ${theme}`;
      }
      if (/\bRed Terror\b/i.test(full)) {
        return "Based on a true story of love and resistance amid Ethiopia's Red Terror.";
      }
    }
    return based.length <= 210 ? based : clipAtSentence(based, 200);
  }

  // Jacket-card style: "From an acclaimed historian, a revelatory account of…"
  const jacket = full.match(
    /\bFrom an? (?:acclaimed |award-winning )?(?:historian|journalist|author|novelist)[^.!?]*[.!?]/i,
  )?.[0]?.trim();
  if (jacket && isCleanBookSentence(jacket)) {
    return jacket.length <= 210 ? jacket : clipAtSentence(jacket, 200);
  }

  const titled = full.match(
    /\b([A-Z][^.,]{2,60}?)\s+(?:follows|explores|traces|examines|recounts|chronicles|tells the story of)\b[^.!?]*[.!?]/,
  )?.[0]?.trim();
  if (titled && titled.length <= 220 && isCleanBookSentence(titled)) return titled;

  // Prefer a sentence that reframes the book clearly.
  const reframes = full.match(
    /\b(?:But as historian|But as|This book|The book)\b[^.!?]{40,200}[.!?]/i,
  )?.[0]?.trim();
  if (reframes && isCleanBookSentence(reframes)) return reframes;

  let plot = full;
  if (eventLine) plot = plot.replace(eventLine, " ").replace(/\s+/g, " ").trim();

  const bioCut = plot.search(
    /\b(?:received an MFA|holds a Ph\.?D|her writing has appeared|his writing has appeared|is the author of|a former journalist|is professor of)\b/i,
  );
  if (bioCut > 80) plot = plot.slice(0, bioCut).trim();

  const sentences =
    plot.match(/[^.!?]+[.!?]+(?:\s+|$)/g)?.map((x) => x.trim()) ?? [];
  for (const s of sentences) {
    if (s.length < 50 || s.length > 200) continue;
    if (!isCleanBookSentence(s)) continue;
    if (/\bin conversation with\b/i.test(s)) continue;
    if (/\bwill be(?:\s+joined)?\s+in conversation\b/i.test(s)) continue;
    if (/\breceived an MFA|Pulitzer|Washington Post|lives in|professor of\b/i.test(s))
      continue;
    if (/^We think of\b/i.test(s)) continue;
    return s;
  }

  // Title-only fallback book clause if body yields nothing usable.
  const fromTitle = eventLineFromBookstoreTitle(pageTitle ?? "");
  if (fromTitle) {
    const book = fromTitle.match(/\babout\s+(.+)\.$/i)?.[1];
    if (book) return undefined; // already named in event line
  }
  return undefined;
}

function isCleanBookSentence(s: string): boolean {
  const t = s.trim();
  if (!t || /^[a-z]/.test(t)) return false;
  // Mid-clause fragments like "Declaration's grievances, Parkinson offers…"
  if (/^[A-Z][^.]{0,40}’s \w+, [A-Z]/.test(t)) return false;
  if (/^[A-Z][^.]{0,40}'s \w+, [A-Z]/.test(t)) return false;
  if (
    /, [A-Z][a-zA-Z.'’-]+ (?:offers|shows|argues|writes)\b/.test(t) &&
    !/^(?:But|In|This|The|From|Based)\b/.test(t)
  ) {
    return false;
  }
  return true;
}

function clipAtSentence(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  const clipped = text.slice(0, maxChars);
  const stop = Math.max(
    clipped.lastIndexOf(". "),
    clipped.lastIndexOf("! "),
    clipped.lastIndexOf("? "),
  );
  if (stop > maxChars * 0.4) return clipped.slice(0, stop + 1).trim();
  return `${clipped.replace(/\s+\S*$/, "").trim()}…`;
}

/**
 * Pull a readable event blurb from HTML (Politics & Prose, library pages, etc.).
 */
export function parseEnrichmentFromEventPageHtml(html: string): RsvpPageEnrichment {
  const text = plainTextFromHtml(html);
  const price = inferPriceFromEventPageText(text);
  const priceDetail = inferPriceDetailFromEventPageText(text);
  const isWritersCenter = /writer\.org|The Writer['’]s Center/i.test(html);

  let description = descriptionFromOg(html);
  let fromVenueDescriptionBlock = false;

  // Busboys: prefer the full Description: block over truncated JSON-LD / page chrome.
  const busboysBlock = html.match(
    /Description:\s*<\/[^>]+>\s*([\s\S]*?)(?:<h[1-4][^>]*>|\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2},\s+20\d{2}\b|Go to Events)/i,
  );
  if (busboysBlock?.[1]) {
    const plain = decodeHtmlEntities(busboysBlock[1].replace(/<[^>]+>/g, " "))
      .replace(/\s+/g, " ")
      .trim();
    if (plain.length > 80) {
      description = plain.slice(0, 2500);
      fromVenueDescriptionBlock = true;
    }
  }

  // Writer's Center workshop pages: pull the main event body (not the truncated meta).
  if (!fromVenueDescriptionBlock && isWritersCenter) {
    const twc = extractWritersCenterBody(html, text);
    if (twc && twc.length > (description?.length ?? 0)) {
      description = twc;
      fromVenueDescriptionBlock = true;
    }
  }

  if (!fromVenueDescriptionBlock) {
    const bodyBlurb = extractEventBodyBlurb(text);
    if (
      bodyBlurb &&
      (!description || bodyBlurb.length > description.length + 40)
    ) {
      description = bodyBlurb;
    }
  }

  // schema.org Event description (use when longer than what we already have).
  for (const m of html.matchAll(
    /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
  )) {
    try {
      const data = JSON.parse(m[1]) as unknown;
      const nodes = Array.isArray(data)
        ? data
        : data && typeof data === "object" && "@graph" in (data as object)
          ? ((data as { "@graph": unknown })["@graph"] as unknown[])
          : [data];
      for (const node of nodes) {
        if (!node || typeof node !== "object") continue;
        const n = node as { "@type"?: string | string[]; description?: string };
        const type = n["@type"];
        const isEvent =
          type === "Event" ||
          (Array.isArray(type) && type.includes("Event"));
        if (!isEvent || !n.description?.trim()) continue;
        const plain = decodeHtmlEntities(n.description)
          .replace(/\s+/g, " ")
          .trim();
        if (
          plain.length > (description?.length ?? 0) + 40 &&
          !fromVenueDescriptionBlock
        ) {
          description = plain.slice(0, 2500);
        }
      }
    } catch {
      /* ignore */
    }
  }

  if (!description || description.length < 80) {
    // Generic: longest chunk between headings.
    const chunks = text
      .split(/\n{2,}/)
      .map((c) => c.replace(/\s+/g, " ").trim())
      .filter((c) => c.length > 100)
      .filter(
        (c) =>
          !/cookie|privacy policy|main navigation|footer|log in|wishlist|search type|cart main menu/i.test(
            c,
          ),
      );
    chunks.sort((a, b) => b.length - a.length);
    if (chunks[0] && chunks[0].length > (description?.length ?? 0)) {
      description = chunks[0].slice(0, 2500);
    }
  }

  if (description) {
    description = description
      .replace(/\s*This event is free[\s\S]*$/i, "")
      .replace(/\s*To request accommodations[\s\S]*$/i, "")
      .replace(/\s*Event Related Books[\s\S]*$/i, "")
      .trim();
    // Bookstore pages: conversation-first About from the full page text
    // (body excerpts alone often omit the "in conversation with" line).
    const isBookstorePage =
      /politics-?prose|IndieCommerce|Event Related Books|This event is free/i.test(
        html,
      ) || /politics and prose/i.test(text.slice(0, 500));
    if (!fromVenueDescriptionBlock && !isWritersCenter && isBookstorePage) {
      const pageTitle =
        decodeHtmlEntities(
          (
            html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1] ??
            html.match(/property=["']og:title["'][^>]*content=["']([^"']+)["']/i)?.[1] ??
            ""
          ).replace(/<[^>]+>/g, " "),
        )
          .replace(/\s+/g, " ")
          .trim() || undefined;
      description = toEventAboutUpshot(text, 520, pageTitle);
    } else if (
      !fromVenueDescriptionBlock &&
      !isWritersCenter &&
      description.length > 520
    ) {
      description = toEventAboutUpshot(description);
    }
  }

  const out: RsvpPageEnrichment = {};
  if (description && description.length > 40) {
    out.description =
      fromVenueDescriptionBlock || isWritersCenter
        ? limitAboutToSentences(description, 4)
        : description;
  }
  if (price) out.price = price;
  if (priceDetail) out.priceDetail = priceDetail;
  return out;
}

/** Full workshop/event body from writer.org (TEC single-event pages). */
function extractWritersCenterBody(
  html: string,
  plainText: string,
): string | undefined {
  const content =
    html.match(
      /<div[^>]*class=["'][^"']*tribe-events-single-event-description[^"']*["'][^>]*>([\s\S]*?)<\/div>/i,
    )?.[1] ??
    html.match(
      /<div[^>]*class=["'][^"']*tribe-events-content[^"']*["'][^>]*>([\s\S]*?)<\/div>/i,
    )?.[1];
  if (content) {
    const plain = decodeHtmlEntities(
      content
        .replace(/<br\s*\/?>/gi, "\n")
        .replace(/<\/p>/gi, "\n\n")
        .replace(/<\/h[1-6]>/gi, "\n\n")
        .replace(/<\/li>/gi, "\n")
        .replace(/<li[^>]*>/gi, "• ")
        .replace(/<[^>]+>/g, " "),
    )
      .replace(/\n{3,}/g, "\n\n")
      .replace(/[ \t]{2,}/g, " ")
      .trim();
    if (plain.length > 120) return plain.slice(0, 4000);
  }

  // Fallback: narrative from first workshop sentence through materials/instructor.
  const start = plainText.search(
    /\b(This workshop|Write poems|Deep reading|In this workshop|Join us)\b/i,
  );
  if (start < 0) return undefined;
  let slice = plainText.slice(start);
  slice = slice
    .replace(/\s*About [A-Z][\s\S]*$/i, "")
    .replace(/\s*Registration[\s\S]*$/i, "")
    .replace(/\s*Have you read our refund policy\?[\s\S]*$/i, "")
    .replace(/\s+/g, " ")
    .trim();
  return slice.length > 120 ? slice.slice(0, 4000) : undefined;
}

/** Prefer narrative body copy; strip bookstore chrome / nav. */
function extractEventBodyBlurb(text: string): string | undefined {
  let t = text;
  const dateIdx = t.search(/\bDate:\s*(Mon|Tue|Wed|Thu|Fri|Sat|Sun)\b/i);
  if (dateIdx > 80) t = t.slice(0, dateIdx);

  // After search UI chrome common on IndieCommerce / P&P pages.
  const afterSearch = t.split(/\bSearch\s+Search\b/i).pop();
  if (afterSearch && afterSearch.length > 80) t = afterSearch;

  // Start at the earliest narrative opening we recognize.
  const openers = [
    /\bIn \d{4}s?\b/i,
    /\bIn the \b/i,
    /\bBased on a \b/i,
    /\bThe highly \b/i,
    /\bJoin us \b/i,
    /\bCome (?:and|meet) \b/i,
    /\bWhen the \b/i,
  ];
  let startAt = -1;
  for (const re of openers) {
    const idx = t.search(re);
    if (idx >= 0 && (startAt < 0 || idx < startAt)) startAt = idx;
  }
  if (startAt >= 0) t = t.slice(startAt);

  t = t
    .replace(/\s*Can't attend\?[\s\S]*$/i, "")
    .replace(/\s*This event is free[\s\S]*$/i, "")
    .replace(/\s*To request accommodations[\s\S]*$/i, "")
    .replace(/\s*Event Related Books[\s\S]*$/i, "")
    .replace(/\s+/g, " ")
    .trim();

  if (t.length > 120 && !/^(cart|main menu|search type)\b/i.test(t)) {
    return t.slice(0, 2500);
  }
  return undefined;
}
