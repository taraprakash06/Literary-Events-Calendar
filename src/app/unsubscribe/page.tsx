import { getCityById } from "@/data/cities";
import { cityInCopy } from "@/lib/subscribe-email";
import { removeSubscription } from "@/lib/subscribe-store";
import { tokenMatches } from "@/lib/subscribe-token";

export const dynamic = "force-dynamic";

export default async function UnsubscribePage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string; city?: string; token?: string }>;
}) {
  const q = await searchParams;
  const email = (q.email ?? "").trim().toLowerCase();
  const cityId = (q.city ?? "").trim();
  const token = (q.token ?? "").trim();
  const city = getCityById(cityId);

  let message = "That unsubscribe link is missing some information.";
  if (email && city && token && tokenMatches(email, cityId, token)) {
    await removeSubscription(email, cityId);
    message = `You’re unsubscribed from the ${cityInCopy(city)} LitList.`;
  } else if (email && cityId && token) {
    message = "That unsubscribe link isn’t valid. You may already be off the list.";
  }

  return (
    <main className="mx-auto flex min-h-[60vh] max-w-lg flex-col justify-center px-6 py-16">
      <p className="font-serif text-2xl text-[var(--ink)]">{message}</p>
      <p className="mt-4 text-sm text-[var(--muted)]">
        <a href={city ? `/${city.slug}` : "/"} className="underline-offset-2 hover:underline">
          Back to the calendar
        </a>
      </p>
    </main>
  );
}
