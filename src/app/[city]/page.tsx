import { notFound } from "next/navigation";
import { CITIES, getCityBySlug } from "@/data/cities";
import { LiteraryCalendarLogo } from "@/components/LiteraryCalendarLogo";
import { WorkshopCalendar } from "@/components/WorkshopCalendar";

export function generateStaticParams() {
  return CITIES.map((c) => ({ city: c.slug }));
}

export default async function CityCalendarPage({
  params,
}: {
  params: Promise<{ city: string }>;
}) {
  const { city: slug } = await params;
  const city = getCityBySlug(slug);
  if (!city) notFound();

  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b border-stone-200/90 bg-[var(--surface)]/95 px-4 py-8 backdrop-blur-sm dark:border-stone-700/80 dark:bg-stone-950/90">
        <div className="mx-auto flex max-w-6xl flex-col gap-4">
          <div className="flex flex-wrap items-center gap-3 sm:gap-4">
            <LiteraryCalendarLogo className="h-10 w-10 shrink-0 text-stone-800 dark:text-stone-100 sm:h-12 sm:w-12" />
            <h1 className="font-serif text-3xl font-semibold tracking-tight text-stone-900 dark:text-stone-50 sm:text-4xl">
              Literary Events Calendar
            </h1>
          </div>
          <p className="max-w-3xl text-lg leading-relaxed text-stone-700 dark:text-stone-300">
            This project is designed to strengthen literary communities by making
            existing events easier to find, attend, and support.
          </p>
          <p className="text-sm font-medium uppercase tracking-[0.12em] text-stone-500 dark:text-stone-400">
            {city.name}
          </p>
        </div>
      </header>

      <main className="flex flex-1 flex-col px-4 py-8 sm:py-10">
        <WorkshopCalendar city={city} />
      </main>
    </div>
  );
}
