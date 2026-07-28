const HTML_NAMED_ENTITIES: Record<string, string> = {
  hellip: "\u2026",
  middot: "\u00b7",
  apos: "'",
  rsquo: "\u2019",
  lsquo: "\u2018",
  rdquo: "\u201d",
  ldquo: "\u201c",
  ndash: "\u2013",
  mdash: "\u2014",
  nbsp: " ",
};

export function decodeHtmlEntities(input: string): string {
  return input
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#0*39;/g, "'")
    .replace(/&#x0*27;/gi, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => {
      const code = Number.parseInt(hex, 16);
      if (!Number.isFinite(code) || code <= 0) return "";
      try {
        return String.fromCodePoint(code);
      } catch {
        return "";
      }
    })
    .replace(/&#(\d+);/g, (_, n) => {
      const code = Number(n);
      if (!Number.isFinite(code) || code <= 0) return "";
      try {
        return String.fromCodePoint(code);
      } catch {
        return "";
      }
    })
    .replace(/&([a-z]+);/gi, (full, name) => {
      const ch = HTML_NAMED_ENTITIES[name.toLowerCase()];
      return ch ?? full;
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

/**
 * Cap About copy at a few sentences and drop appended host/artist bios.
 * Used so listings stay event-focused instead of full CVs.
 */
export function limitAboutToSentences(
  input: string,
  maxSentences = 4,
): string {
  let t = stripHtmlAndDecode(input).replace(/\s+/g, " ").trim();
  if (!t) return "";

  // Busboys open mics often put the series pitch after a "* * *" bio break.
  const starParts = t
    .split(/\*\s*\*\s*\*/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (starParts.length >= 2) {
    const tail = starParts[starParts.length - 1];
    if (
      tail.length > 80 &&
      /\b(open mic|audiences can expect|\$\s*\d+\s*cover|workshop|come out|for two hours|expect to be moved)\b/i.test(
        tail,
      )
    ) {
      t = tail;
    }
  }

  t = t
    .replace(/\s*\bHOST:\s*[\s\S]*$/i, "")
    .replace(
      /\s*\bAbout (?:the )?(?:Host|Artist|Instructor|Author|Performer)\b[:\s][\s\S]*$/i,
      "",
    )
    .replace(/\s*If you need an accommodation for this workshop[\s\S]*$/i, "")
    .trim();

  // If a long personal bio precedes the event pitch, start at the pitch.
  const pitchAt = t.search(
    /\b(?:ASL\b|OPEN MIC PRESENTS|On this night|Come out and enjoy|For two hours|This workshop|Join us|Deep reading|Write poems|Live video conference)\b/i,
  );
  if (pitchAt > 60) t = t.slice(pitchAt).trim();

  const sentences = splitAboutSentences(t);
  if (sentences.length === 0) return t;
  return sentences.slice(0, Math.max(1, maxSentences)).join(" ").trim();
}

function splitAboutSentences(text: string): string[] {
  const matches = text.match(/[^.!?]+[.!?]+(?:\s+|$)|[^.!?]+$/g);
  if (!matches) return text ? [text] : [];
  return matches
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .filter((s) => !/^(?:HOST|About)\b/i.test(s));
}

