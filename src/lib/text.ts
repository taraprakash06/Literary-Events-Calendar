export function decodeHtmlEntities(input: string): string {
  return input
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#0*39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_, n) => {
      const code = Number(n);
      if (!Number.isFinite(code) || code <= 0) return "";
      try {
        return String.fromCodePoint(code);
      } catch {
        return "";
      }
    });
}

export function stripHtmlAndDecode(input: string): string {
  return decodeHtmlEntities(
    input.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(),
  );
}

/**
 * Keep text readable and prevent “gibberish” from broken entities.
 * Also trims to a compact 1–2 sentence overview when possible.
 */
export function toShortOverview(input: string, maxChars = 320): string {
  const cleaned = stripHtmlAndDecode(input)
    .replace(/\uFFFD/g, "") // replacement char
    .replace(/\s+/g, " ")
    .trim();

  if (!cleaned) return "";

  const clipped = cleaned.slice(0, maxChars);
  const sentence = clipped.match(/^(.+?[.!?])(\s+|$)/);
  if (sentence?.[1] && sentence[1].length >= 60) return sentence[1].trim();

  // Try two sentences if the first is short.
  const two = clipped.match(/^(.+?[.!?])\s+(.+?[.!?])(\s+|$)/);
  if (two?.[1] && two?.[2]) return `${two[1].trim()} ${two[2].trim()}`.trim();

  return clipped.replace(/\s+$/g, "").trim();
}

