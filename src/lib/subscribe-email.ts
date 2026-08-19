import { DateTime } from "luxon";
import type { City } from "@/lib/workshop-types";
import { CITIES, getCityById } from "@/data/cities";
import { SITE_URL } from "@/lib/site-url";
import { subscribeToken } from "@/lib/subscribe-token";
import {
  hasResend,
  listSubscriptions,
  markSubscriptionSent,
  type CalendarSubscription,
} from "@/lib/subscribe-store";

const FROM_DEFAULT = "The Lit List <beth.t@example.com>";

export function cityInCopy(city: City): string {
  switch (city.id) {
    case "dmv":
      return "the DMV";
    case "nyc":
      return "New York";
    case "la":
      return "Los Angeles";
    case "sf":
      return "the Bay Area";
    case "tn":
      return "Tennessee";
    case "ne":
      return "Omaha / Lincoln";
    case "sd":
      return "San Diego";
    default:
      return city.label;
  }
}

export function cityCalendarUrl(city: City): string {
  return `${SITE_URL}/${city.slug}`;
}

function fromAddress(): string {
  return process.env.RESEND_FROM?.trim() || FROM_DEFAULT;
}

function unsubscribeUrl(email: string, cityId: string): string {
  const token = subscribeToken(email, cityId);
  const u = new URL("/unsubscribe", SITE_URL);
  u.searchParams.set("email", email);
  u.searchParams.set("city", cityId);
  u.searchParams.set("token", token);
  return u.toString();
}

function wrapEmail(opts: {
  title: string;
  preview: string;
  inner: string;
  unsub: string;
}): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${opts.title}</title>
</head>
<body style="margin:0;padding:0;background:#f5f4f1;color:#111111;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${opts.preview}</div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f5f4f1;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:520px;background:#fcfcfa;border:1px solid #d6d3cc;padding:36px 32px 28px;">
          <tr>
            <td style="font-family:Georgia,'Times New Roman',serif;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:#b31b1b;">
              The Lit List
            </td>
          </tr>
          <tr>
            <td style="padding-top:18px;font-family:Georgia,'Times New Roman',serif;font-size:26px;line-height:1.25;color:#111111;">
              ${opts.title}
            </td>
          </tr>
          <tr>
            <td style="padding-top:16px;font-family:'Source Sans 3',Helvetica,Arial,sans-serif;font-size:16px;line-height:1.55;color:#5a5650;">
              ${opts.inner}
            </td>
          </tr>
          <tr>
            <td style="padding-top:28px;font-family:'Source Sans 3',Helvetica,Arial,sans-serif;font-size:12px;line-height:1.5;color:#8a8680;">
              You’re receiving this because you subscribed to a city LitList.
              <a href="${opts.unsub}" style="color:#8a8680;">Unsubscribe</a>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function monthlyHtml(city: City, monthName: string, email: string): string {
  const url = cityCalendarUrl(city);
  const place = cityInCopy(city);
  const inner = `
    <p style="margin:0 0 14px;">
      ${monthName}’s LitList for ${place} is live. Find readings, workshops,
      open mics, author talks, and more happening near you this month.
    </p>
    <p style="margin:24px 0 0;">
      <a href="${url}" style="display:inline-block;background:#b31b1b;color:#fcfcfa;text-decoration:none;padding:10px 16px;font-size:14px;letter-spacing:0.02em;">
        Explore ${monthName} →
      </a>
    </p>
    <p style="margin:18px 0 0;font-size:13px;">
      <a href="${url}" style="color:#7a1212;">${url}</a>
    </p>
  `;
  return wrapEmail({
    title: `What’s happening in the literary world this ${monthName}?`,
    preview: `${monthName}’s LitList for ${place} is live.`,
    inner,
    unsub: unsubscribeUrl(email, city.id),
  });
}

function welcomeHtml(city: City, email: string): string {
  const url = cityCalendarUrl(city);
  const place = cityInCopy(city);
  const inner = `
    <p style="margin:0 0 14px;">
      You’re on the list for ${place}. On the first of each month we’ll send
      one email with a link to that city’s latest LitList — nothing else.
    </p>
    <p style="margin:0;">
      You can browse anytime:
      <a href="${url}" style="color:#7a1212;">${url}</a>
    </p>
  `;
  return wrapEmail({
    title: `You’re subscribed to the ${place} LitList`,
    preview: `One email a month with ${place}’s literary calendar.`,
    inner,
    unsub: unsubscribeUrl(email, city.id),
  });
}

async function sendResendEmail(opts: {
  to: string;
  subject: string;
  html: string;
}): Promise<{ ok: boolean; error?: string }> {
  const key = process.env.RESEND_API_KEY?.trim();
  if (!key) {
    console.info("[subscribe] RESEND_API_KEY unset; would send", {
      to: opts.to,
      subject: opts.subject,
    });
    return { ok: true };
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: fromAddress(),
      to: [opts.to],
      subject: opts.subject,
      html: opts.html,
    }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    return { ok: false, error: `Resend ${res.status} ${text.slice(0, 240)}` };
  }
  return { ok: true };
}

export async function sendWelcomeEmail(
  email: string,
  city: City,
): Promise<void> {
  const place = cityInCopy(city);
  const result = await sendResendEmail({
    to: email,
    subject: `You’re on the LitList — ${place}`,
    html: welcomeHtml(city, email),
  });
  if (!result.ok) {
    console.warn("[subscribe] welcome email failed", result.error);
  }
}

export type MonthlySendResult = {
  monthKey: string;
  monthName: string;
  attempted: number;
  sent: number;
  skipped: number;
  failed: number;
  dryRun: boolean;
  errors: string[];
};

function monthParts(now = DateTime.now().setZone("America/New_York")): {
  monthKey: string;
  monthName: string;
} {
  return {
    monthKey: now.toFormat("yyyy-LL"),
    monthName: now.toFormat("MMMM"),
  };
}

export async function sendMonthlyLitListEmails(opts?: {
  force?: boolean;
}): Promise<MonthlySendResult> {
  const { monthKey, monthName } = monthParts();
  const dryRun = !hasResend();
  const subs = await listSubscriptions();
  const errors: string[] = [];
  let sent = 0;
  let skipped = 0;
  let failed = 0;
  let attempted = 0;

  const grouped = new Map<string, CalendarSubscription[]>();
  for (const sub of subs) {
    const list = grouped.get(sub.cityId) ?? [];
    list.push(sub);
    grouped.set(sub.cityId, list);
  }

  for (const city of CITIES) {
    const citySubs = grouped.get(city.id) ?? [];
    for (const sub of citySubs) {
      if (!opts?.force && sub.lastSentMonth === monthKey) {
        skipped += 1;
        continue;
      }
      attempted += 1;
      const result = await sendResendEmail({
        to: sub.email,
        subject: `What’s happening in the literary world this ${monthName}?`,
        html: monthlyHtml(city, monthName, sub.email),
      });
      if (!result.ok) {
        failed += 1;
        errors.push(`${sub.email} (${city.id}): ${result.error}`);
        continue;
      }
      sent += 1;
      await markSubscriptionSent(sub.email, city.id, monthKey);
    }
  }

  return {
    monthKey,
    monthName,
    attempted,
    sent,
    skipped,
    failed,
    dryRun,
    errors: errors.slice(0, 20),
  };
}

export function cityFromId(cityId: string): City | undefined {
  return getCityById(cityId);
}
