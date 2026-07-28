import type { PriceKind } from "@/lib/workshop-types";
import { decodeHtmlEntities } from "@/lib/text";

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
 * Condense a long bookstore/event blurb into an About upshot:
 * opening premise + book framing + conversation host — not full bios/retail chrome.
 */
export function toEventAboutUpshot(full: string, maxChars = 720): string {
  let t = full.replace(/\s+/g, " ").trim();
  if (!t) return "";

  t = t
    .replace(/\s*Current price:[\s\S]*$/i, "")
    .replace(/\s*Can't attend\?[\s\S]*$/i, "")
    .replace(/\s*This event is free[\s\S]*$/i, "")
    .replace(/\s*To request accommodations[\s\S]*$/i, "")
    .replace(/\s*Event Related Books[\s\S]*$/i, "")
    .replace(/\s*ISBN:\s*\d[\s\S]*$/i, "")
    .trim();

  const based = t
    .match(/\bBased on a true story\b[^.!?]*[.!?]/i)?.[0]
    ?.trim();
  const convo =
    t.match(
      /\b[A-Z][a-zA-Z.'’-]+(?:\s+[A-Z][a-zA-Z.'’-]+){0,3}\s+will be in conversation with [^.!?]+[.!?]/,
    )?.[0]?.trim() ??
    t.match(/\bIn conversation with [^.!?]+[.!?]/i)?.[0]?.trim();

  let plot = t;
  if (based) {
    const idx = t.indexOf(based);
    if (idx >= 0) plot = t.slice(0, idx).trim();
  } else {
    const bioCut = plot.search(
      /\b(?:received an MFA|holds a Ph\.?D|her writing has appeared|his writing has appeared|is the author of)\b/i,
    );
    if (bioCut > 180) plot = plot.slice(0, bioCut).trim();
    const bornIntro = plot.search(
      /\b[A-Z][a-zA-Z.'’-]+(?:\s+[A-Z][a-zA-Z.'’-]+){1,3},\s+born in\b/,
    );
    if (bornIntro > 180) plot = plot.slice(0, bornIntro).trim();
  }

  const plotSentences =
    plot.match(/[^.!?]+[.!?]+(?:\s+|$)/g)?.map((s) => s.trim()) ??
    (plot ? [plot] : []);

  const parts: string[] = [];
  for (const s of plotSentences.slice(0, 2)) parts.push(s);
  if (parts.join(" ").length < 300 && plotSentences[2]) {
    parts.push(plotSentences[2]);
  }
  if (based) parts.push(based);
  if (convo) parts.push(convo);

  const framingTail = [based, convo].filter(Boolean) as string[];
  while (parts.join(" ").length > maxChars && parts.length > framingTail.length + 1) {
    // Drop the last plot sentence before framing lines.
    parts.splice(parts.length - framingTail.length - 1, 1);
  }

  let out = parts.join(" ").replace(/\s+/g, " ").replace(/\s+([.!?])/g, "$1").trim();
  if (out.length <= maxChars) return out;

  // Last resort: keep opening sentence + framing.
  const opening = plotSentences[0];
  const fallback = [opening, ...framingTail].filter(Boolean).join(" ").trim();
  if (fallback.length <= maxChars) return fallback;
  const clipped = fallback.slice(0, maxChars);
  const stop = Math.max(
    clipped.lastIndexOf(". "),
    clipped.lastIndexOf("! "),
    clipped.lastIndexOf("? "),
  );
  return stop > maxChars * 0.4
    ? clipped.slice(0, stop + 1).trim()
    : `${clipped.replace(/\s+\S*$/, "").trim()}…`;
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
    // Bookstore pages often include the full jacket + bios; show an upshot in About.
    // Keep Writer's Center / Busboys workshop copy intact.
    if (
      !fromVenueDescriptionBlock &&
      !isWritersCenter &&
      description.length > 520
    ) {
      description = toEventAboutUpshot(description);
    }
  }

  const out: RsvpPageEnrichment = {};
  if (description && description.length > 40) out.description = description;
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
