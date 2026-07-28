import { NextResponse } from "next/server";
import { parseEnrichmentFromEventPageHtml } from "@/lib/rsvp-page-enrichment";

export const revalidate = 3600;

/** Browser-like UA — some venues (P&P) block generic scrapers with 403. */
const UA =
  "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)";

const ALLOWED_HOSTS = new Set([
  "politics-prose.com",
  "www.politics-prose.com",
  "busboysandpoets.com",
  "www.busboysandpoets.com",
  "writer.org",
  "www.writer.org",
  "www.eventbrite.com",
  "eventbrite.com",
]);

function isAllowedEventUrl(raw: string): URL | null {
  try {
    const u = new URL(raw);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    const host = u.hostname.toLowerCase();
    if (ALLOWED_HOSTS.has(host)) return u;
    // Allow common Eventbrite subdomains.
    if (host.endsWith(".eventbrite.com")) return u;
    return null;
  } catch {
    return null;
  }
}

async function fetchHtml(
  url: string,
): Promise<{ ok: boolean; status: number; html: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    let lastStatus = 0;
    for (let attempt = 0; attempt < 4; attempt++) {
      if (attempt > 0) {
        await new Promise((r) => setTimeout(r, 800 * 2 ** (attempt - 1)));
      }
      const res = await fetch(url, {
        headers: {
          Accept: "text/html,application/xhtml+xml",
          "Accept-Language": "en-US,en;q=0.9",
          "User-Agent": UA,
        },
        cache: "no-store",
        signal: controller.signal,
      });
      lastStatus = res.status;
      if (res.status === 429 || res.status === 403) continue;
      const html = await res.text();
      return { ok: res.ok, status: res.status, html };
    }
    return { ok: false, status: lastStatus, html: "" };
  } catch {
    return { ok: false, status: 0, html: "" };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Server-side enricher for sparse About/price fields.
 * The browser cannot fetch many venue pages (CORS / bot walls); this proxies one URL.
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const raw = searchParams.get("url")?.trim() ?? "";
  const parsedUrl = isAllowedEventUrl(raw);
  if (!parsedUrl) {
    return NextResponse.json({ error: "unsupported url" }, { status: 400 });
  }

  const fetched = await fetchHtml(parsedUrl.toString());
  if (!fetched.ok) {
    return NextResponse.json(
      { error: "fetch failed", status: fetched.status },
      { status: 502 },
    );
  }

  const enrichment = parseEnrichmentFromEventPageHtml(fetched.html);
  return NextResponse.json({
    url: parsedUrl.toString(),
    ...enrichment,
  });
}
