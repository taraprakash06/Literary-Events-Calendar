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
 * Collapse whitespace while keeping sentence breaks when a heading/paragraph
 * without end punctuation was joined to the next capitalised sentence
 * (e.g. Writer's Center `<h1>…commentary</h1><p>This workshop…`).
 */
export function collapseAboutWhitespace(text: string): string {
  return text
    .replace(/\r\n?/g, "\n")
    .replace(/([a-z0-9…’”'"”])[ \t]*\n+[ \t]*(?=[A-Z])/g, "$1. ")
    // Already-flattened joins (HTML tags stripped to spaces only).
    .replace(
      /([a-z0-9…’”'"”])\s+(?=(?:This workshop|Join us|Each week|By the end|No preparation|In-person class)\b)/g,
      "$1. ",
    )
    .replace(/\n+/g, " ")
    .replace(/\s+/g, " ")
    .replace(/([.!?…])\s*\.+/g, "$1")
    .trim();
}

const NAME_PARTICLE =
  /^(?:de|dela|del|da|di|van|von|der|den|el|al|la|le|st\.?|mc|mac)$/i;

/**
 * Fix common feed-copy issues before display: unpunctuated author lists that
 * run into the next sentence, missing commas between names, stray spaces.
 */
export function polishAboutText(input: string): string {
  let t = collapseAboutWhitespace(stripHtmlAndDecode(input).replace(/\uFFFD/g, ""));
  if (!t) return "";

  t = punctuateLabeledNameList(t);
  t = insertPeriodBeforeTrailingOrgSentence(t);

  return t
    .replace(/\s+([.!?,;:])/g, "$1")
    .replace(/([.!?]){2,}/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * "Readings from: Ada Limón Ocean Vuong Org is a …" →
 * "Readings from: Ada Limón, Ocean Vuong. Org is a …"
 */
function punctuateLabeledNameList(text: string): string {
  const labelRe =
    /\b((?:Readings?\s+from|Featuring(?:\s+readings?\s+by)?|With(?:\s+readings?\s+by)?|Readers?|Poets?|Authors?|Performers?)\s*:\s*)/i;
  const labelMatch = text.match(labelRe);
  if (!labelMatch || labelMatch.index == null) return text;

  const start = labelMatch.index + labelMatch[0].length;
  const before = text.slice(0, start);
  const after = text.slice(start);

  const sentStart = findOrgSentenceStart(after);
  if (sentStart == null || sentStart <= 0) {
    // Still try to comma-separate a bare name list with no following sentence.
    const names = splitPersonNames(after.trim());
    if (names.length >= 2 && !/[.!?]/.test(after)) {
      return `${before}${formatNameList(names)}.`;
    }
    return text;
  }

  const nameBlob = after.slice(0, sentStart).trim();
  const sentence = after.slice(sentStart).trim();
  const names = splitPersonNames(nameBlob);
  if (names.length === 0) return text;

  return `${before}${formatNameList(names)}. ${sentence}`;
}

/** When no label, still split "… Jonathan Mills Hesse Press is a …". */
function insertPeriodBeforeTrailingOrgSentence(text: string): string {
  if (/\.\s+[A-Z]/.test(text)) return text; // already has sentence breaks
  const sentStart = findOrgSentenceStart(text);
  if (sentStart == null || sentStart < 12) return text;

  const before = text.slice(0, sentStart).trim();
  const sentence = text.slice(sentStart).trim();
  if (!before || !sentence) return text;
  if (/[.!?]$/.test(before)) return text;

  // Only intervene when the lead-in looks like a name list (2+ people).
  const names = splitPersonNames(before.replace(/^.*?:\s*/, ""));
  if (names.length < 2) return text;

  const labelPrefix = before.match(/^.*?:\s*/)?.[0] ?? "";
  const namePart = labelPrefix ? before.slice(labelPrefix.length) : before;
  const formatted = formatNameList(splitPersonNames(namePart));
  return `${labelPrefix}${formatted}. ${sentence}`;
}

function findOrgSentenceStart(text: string): number | null {
  // First "is/are a|an|the|…" after the name list. Prefer a short org
  // immediately before the verb ("Hesse Press"), not a long run of names.
  const verb = /\b(is|are|was|were)\s+(a|an|the|based|dedicated|known|committed)\b/i;
  const m = verb.exec(text);
  if (!m || m.index == null || m.index < 1) return null;
  const before = text.slice(0, m.index).replace(/\s+$/, "");
  for (const wordCount of [2, 1, 3]) {
    const re = new RegExp(
      `\\b([A-Z][\\w'’-]*(?:\\s+[A-Z][\\w'’-]*){${wordCount - 1}})$`,
    );
    const org = before.match(re);
    if (org && org.index != null) return org.index;
  }
  return null;
}

function splitPersonNames(blob: string): string[] {
  const words = blob.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];

  const names: string[] = [];
  let i = 0;
  while (i < words.length) {
    const w0 = words[i];
    const w1 = words[i + 1];
    const w2 = words[i + 2];

    if (w1 && w2 && NAME_PARTICLE.test(w1) && looksLikeNameWord(w0) && looksLikeNameWord(w2)) {
      names.push(`${w0} ${w1} ${w2}`);
      i += 3;
      continue;
    }
    if (w1 && looksLikeNameWord(w0) && looksLikeNameWord(w1) && !NAME_PARTICLE.test(w1)) {
      names.push(`${w0} ${w1}`);
      i += 2;
      continue;
    }
    // Stop if we hit something that doesn't look like a name token.
    if (!looksLikeNameWord(w0) && !NAME_PARTICLE.test(w0)) break;
    names.push(w0);
    i += 1;
  }
  return names;
}

function looksLikeNameWord(w: string): boolean {
  return /^[A-Z][\p{L}'’-]*$/u.test(w);
}

function formatNameList(names: string[]): string {
  if (names.length === 0) return "";
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(", ")}, and ${names[names.length - 1]}`;
}

/**
 * Keep text readable and prevent “gibberish” from broken entities.
 * Also trims to a compact 1–2 sentence overview when possible.
 */
export function toShortOverview(input: string, maxChars = 320): string {
  const cleaned = polishAboutText(input);

  if (!cleaned) return "";

  const clipped = cleaned.slice(0, maxChars);
  const sentence = clipped.match(/^(.+?[.!?])(\s+|$)/);
  if (sentence?.[1] && sentence[1].length >= 40) return sentence[1].trim();

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
  let t = polishAboutText(input);
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
  // Protect common abbreviations so "8:00 P.M. Eastern" isn't three sentences.
  const protectedText = text
    .replace(/\b([AP])\.\s*M\./gi, "$1·M·")
    .replace(/\b(Mr|Mrs|Ms|Dr|Prof|St|vs|etc)\./gi, "$1·");
  const matches = protectedText.match(/[^.!?]+[.!?]+(?:\s+|$)|[^.!?]+$/g);
  if (!matches) return text ? [text] : [];
  return matches
    .map((s) => s.replace(/·/g, ".").trim())
    .filter((s) => s.length > 0)
    .filter((s) => !/^(?:HOST|About)\b/i.test(s));
}

