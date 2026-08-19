import { createHmac, timingSafeEqual } from "node:crypto";

function signingSecret(): string {
  return (
    process.env.SUBSCRIBE_SECRET?.trim() ||
    process.env.CRON_SECRET?.trim() ||
    process.env.RESEND_API_KEY?.trim() ||
    "dev-only-subscribe-secret"
  );
}

export function subscribeToken(email: string, cityId: string): string {
  return createHmac("sha256", signingSecret())
    .update(`${email.toLowerCase().trim()}|${cityId}`)
    .digest("hex");
}

export function tokenMatches(
  email: string,
  cityId: string,
  token: string,
): boolean {
  const expected = subscribeToken(email, cityId);
  const a = Buffer.from(expected);
  const b = Buffer.from(token);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
