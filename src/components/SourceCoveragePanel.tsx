"use client";

import { useEffect, useState } from "react";
import type { ConnectorStatus } from "@/lib/source-connectors";

type Payload = {
  updatedAt: string;
  connectors: ConnectorStatus[];
};

export function SourceCoveragePanel() {
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/ingestion/status")
      .then((r) => {
        if (!r.ok) throw new Error(String(r.status));
        return r.json() as Promise<Payload>;
      })
      .then((json) => {
        if (!cancelled) setData(json);
      })
      .catch(() => {
        if (!cancelled) setError("Could not load connector status.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section
      className="rounded-sm border border-stone-200/90 bg-[var(--surface)] p-5 shadow-sm dark:border-stone-700/80 dark:bg-stone-900/30 sm:p-6"
      aria-labelledby="source-coverage-heading"
    >
      <h2
        id="source-coverage-heading"
        className="font-serif text-lg font-semibold text-stone-900 dark:text-stone-50"
      >
        Where this platform checks
      </h2>
      <p className="mt-2 max-w-3xl text-sm leading-relaxed text-stone-600 dark:text-stone-400">
        The calendar is built to aggregate public literary events from the sources
        below. Each connector can be wired independently (API keys, iCal URLs, RSS
        feeds, or curated link lists). Status reflects environment variables only —
        fetch jobs still need to be implemented per connector.
      </p>

      {error ? (
        <p className="mt-4 text-sm text-rose-800 dark:text-rose-300">{error}</p>
      ) : null}

      {!data && !error ? (
        <p className="mt-4 text-sm text-stone-500">Loading connector status…</p>
      ) : null}

      {data ? (
        <ul className="mt-5 grid gap-3 sm:grid-cols-2">
          {data.connectors.map((c) => (
            <li
              key={c.id}
              className="flex gap-3 rounded-sm border border-stone-200/80 bg-white/80 px-3 py-3 dark:border-stone-700/80 dark:bg-stone-950/50"
            >
              <span
                className={[
                  "mt-1 h-2.5 w-2.5 shrink-0 rounded-full",
                  c.configured ? "bg-emerald-500/90" : "bg-stone-300 dark:bg-stone-600",
                ].join(" ")}
                title={c.configured ? "Configured" : "Not configured"}
                aria-hidden
              />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-stone-900 dark:text-stone-100">
                  {c.title}
                </p>
                <p className="mt-0.5 text-xs leading-snug text-stone-600 dark:text-stone-400">
                  {c.blurb}
                </p>
                <p className="mt-1.5 text-[11px] text-stone-500 dark:text-stone-500">
                  {c.detail}
                </p>
              </div>
            </li>
          ))}
        </ul>
      ) : null}

      {data ? (
        <p className="mt-4 text-xs text-stone-500 dark:text-stone-500">
          Last checked (build): {new Date(data.updatedAt).toLocaleString()}
        </p>
      ) : null}
    </section>
  );
}
