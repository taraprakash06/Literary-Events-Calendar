import { CITIES, getCityById } from "@/data/cities";
import type { City } from "@/lib/workshop-types";
import { sendWelcomeEmail } from "@/lib/subscribe-email";
import { addSubscription } from "@/lib/subscribe-store";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(email: string): boolean {
  return EMAIL_RE.test(email.trim()) && email.length <= 254;
}

export function subscribeCities(): City[] {
  return CITIES;
}

export async function subscribeToCity(
  email: string,
  cityId: string,
): Promise<{ ok: true; status: "created" | "exists"; city: City } | { ok: false; error: string }> {
  const normalized = email.trim().toLowerCase();
  if (!isValidEmail(normalized)) {
    return { ok: false, error: "Please enter a valid email address." };
  }
  const city = getCityById(cityId);
  if (!city) {
    return { ok: false, error: "Please choose a city." };
  }
  const status = await addSubscription(normalized, city.id);
  if (status === "created") {
    void sendWelcomeEmail(normalized, city);
  }
  return { ok: true, status, city };
}
