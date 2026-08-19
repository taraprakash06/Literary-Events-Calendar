import { NextResponse } from "next/server";
import { subscribeToCity } from "@/lib/subscribe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const record = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const email = typeof record.email === "string" ? record.email : "";
  const cityId = typeof record.cityId === "string" ? record.cityId : "";
  const honeypot = typeof record.company === "string" ? record.company : "";
  if (honeypot.trim()) {
    return NextResponse.json({ ok: true });
  }

  const result = await subscribeToCity(email, cityId);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({
    ok: true,
    status: result.status,
    cityId: result.city.id,
  });
}
