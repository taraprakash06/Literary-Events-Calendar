"use client";

import { useMemo, useState } from "react";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

function buildMonthGrid(year: number, monthIndex: number): (number | null)[] {
  const first = new Date(year, monthIndex, 1);
  const last = new Date(year, monthIndex + 1, 0);
  const padStart = first.getDay();
  const daysInMonth = last.getDate();
  const cells: (number | null)[] = [];

  for (let i = 0; i < padStart; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  while (cells.length < 42) cells.push(null);

  return cells;
}

function shiftMonth(year: number, monthIndex: number, delta: number) {
  const d = new Date(year, monthIndex + delta, 1);
  return { year: d.getFullYear(), monthIndex: d.getMonth() };
}

export function CalendarShell() {
  const today = useMemo(() => new Date(), []);
  const [year, setYear] = useState(today.getFullYear());
  const [monthIndex, setMonthIndex] = useState(today.getMonth());

  const label = new Date(year, monthIndex, 1).toLocaleString("en-US", {
    month: "long",
    year: "numeric",
  });

  const grid = useMemo(
    () => buildMonthGrid(year, monthIndex),
    [year, monthIndex],
  );

  const isToday = (day: number | null) =>
    day !== null &&
    year === today.getFullYear() &&
    monthIndex === today.getMonth() &&
    day === today.getDate();

  return (
    <div className="mx-auto w-full max-w-3xl rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      <div className="mb-6 flex items-center justify-between gap-4">
        <h1 className="text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          {label}
        </h1>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => {
              const n = shiftMonth(year, monthIndex, -1);
              setYear(n.year);
              setMonthIndex(n.monthIndex);
            }}
            className="rounded-lg border border-zinc-200 px-3 py-1.5 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-900"
          >
            Prev
          </button>
          <button
            type="button"
            onClick={() => {
              const n = shiftMonth(year, monthIndex, 1);
              setYear(n.year);
              setMonthIndex(n.monthIndex);
            }}
            className="rounded-lg border border-zinc-200 px-3 py-1.5 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-900"
          >
            Next
          </button>
        </div>
      </div>

      <div className="mb-2 grid grid-cols-7 gap-1 text-center text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
        {WEEKDAYS.map((d) => (
          <div key={d} className="py-2">
            {d}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-sm">
        {grid.map((day, i) => (
          <div
            key={`${year}-${monthIndex}-${i}`}
            className={[
              "flex aspect-square items-center justify-center rounded-lg border border-transparent text-zinc-800 dark:text-zinc-100",
              day === null
                ? "bg-transparent"
                : isToday(day)
                  ? "border-amber-400/80 bg-amber-50 font-semibold text-amber-950 dark:border-amber-500/60 dark:bg-amber-950/40 dark:text-amber-50"
                  : "bg-zinc-50 dark:bg-zinc-900/60",
            ].join(" ")}
          >
            {day ?? ""}
          </div>
        ))}
      </div>
    </div>
  );
}
