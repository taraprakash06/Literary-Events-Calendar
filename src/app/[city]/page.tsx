import { notFound } from "next/navigation";
import { CITIES, getCityBySlug } from "@/data/cities";
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
      <header className="border-b border-[var(--line)]">
        <div className="masthead-copy mx-auto flex max-w-6xl flex-col gap-6 px-5 pb-7 pt-8 sm:px-8 sm:pb-8 sm:pt-10 lg:flex-row lg:items-end lg:justify-between lg:gap-16">
          <div className="max-w-2xl">
            <p className="font-serif text-[2.35rem] font-normal leading-none tracking-tight text-[var(--ink)] sm:text-5xl">
              The Lit List
            </p>
            <p className="mt-4 max-w-xl text-[1.05rem] leading-relaxed text-[var(--muted)] sm:mt-5 sm:text-lg">
              We gather literary events from library calendars, bookstore
              listings, Eventbrite, Instagram, and other scattered sources, then
              bring them together in one place. Use the filters below to
              discover events near you that fit your interests.
            </p>
          </div>

          <div className="lg:max-w-xs lg:pb-1 lg:text-right">
            <p className="text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-[var(--accent)]">
              Now viewing
            </p>
            <p className="mt-2 font-serif text-xl leading-snug text-[var(--ink)] sm:text-2xl">
              {city.name}
            </p>
          </div>
        </div>
      </header>

      <main
        id="calendar"
        className="flex flex-1 flex-col px-4 pb-14 pt-6 sm:px-6 sm:pb-16 sm:pt-8"
      >
        <WorkshopCalendar city={city} />
      </main>
    </div>
  );
}
