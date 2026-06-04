export type IcsEvent = {
  uid?: string;
  summary?: string;
  description?: string;
  location?: string;
  url?: string;
  dtstart?: string;
  dtend?: string;
};

function unfoldIcsLines(ics: string): string[] {
  const raw = ics.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  const out: string[] = [];
  for (const line of raw) {
    if (!line) continue;
    if (/^[ \t]/.test(line) && out.length > 0) {
      out[out.length - 1] += line.trimStart();
    } else {
      out.push(line);
    }
  }
  return out;
}

function valueAfterColon(line: string): string {
  const idx = line.indexOf(":");
  return idx === -1 ? "" : line.slice(idx + 1).trim();
}

export function parseIcsEvents(ics: string, maxEvents = 500): IcsEvent[] {
  const lines = unfoldIcsLines(ics);
  const events: IcsEvent[] = [];
  let cur: IcsEvent | null = null;

  for (const line of lines) {
    if (line === "BEGIN:VEVENT") {
      cur = {};
      continue;
    }
    if (line === "END:VEVENT") {
      if (cur) events.push(cur);
      cur = null;
      if (events.length >= maxEvents) break;
      continue;
    }
    if (!cur) continue;

    if (line.startsWith("UID")) cur.uid = valueAfterColon(line);
    else if (line.startsWith("SUMMARY")) cur.summary = valueAfterColon(line);
    else if (line.startsWith("DESCRIPTION")) cur.description = valueAfterColon(line);
    else if (line.startsWith("LOCATION")) cur.location = valueAfterColon(line);
    else if (line.startsWith("URL")) cur.url = valueAfterColon(line);
    else if (line.startsWith("DTSTART")) cur.dtstart = valueAfterColon(line);
    else if (line.startsWith("DTEND")) cur.dtend = valueAfterColon(line);
  }

  return events;
}

