"use client";

import { useEffect, useState } from "react";
import { CITIES } from "@/data/cities";
import type { City } from "@/lib/workshop-types";

export function SubscribeForm({ city }: { city: City }) {
  const [email, setEmail] = useState("");
  const [cityId, setCityId] = useState(city.id);
  const [status, setStatus] = useState<"idle" | "saving" | "done" | "error">(
    "idle",
  );
  const [message, setMessage] = useState("");

  useEffect(() => {
    setCityId(city.id);
  }, [city.id]);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus("saving");
    setMessage("");
    const form = e.currentTarget;
    const honey = (form.elements.namedItem("company") as HTMLInputElement | null)
      ?.value ?? "";
    try {
      const res = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          cityId,
          company: honey,
        }),
      });
      const body = (await res.json()) as { error?: string };
      if (!res.ok) {
        setStatus("error");
        setMessage(body.error || "Something went wrong. Please try again.");
        return;
      }
      setStatus("done");
      setMessage("You’re on the list. We’ll write on the first of each month.");
      setEmail("");
    } catch {
      setStatus("error");
      setMessage("Something went wrong. Please try again.");
    }
  }

  return (
    <div className="mt-6 max-w-xl border-t border-[var(--line)] pt-5">
      <p className="font-serif text-[1.15rem] leading-snug text-[var(--ink)]">
        Never miss what’s happening.
      </p>
      <p className="mt-1.5 text-[0.92rem] leading-relaxed text-[var(--muted)]">
        Get one email at the beginning of each month with a link to your city’s
        latest LitList.
      </p>
      <form
        onSubmit={onSubmit}
        className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end"
      >
        <label className="absolute left-[-9999px]" htmlFor="subscribe-company">
          Company
        </label>
        <input
          id="subscribe-company"
          name="company"
          type="text"
          tabIndex={-1}
          autoComplete="off"
          className="absolute left-[-9999px]"
        />
        <div className="min-w-0 flex-1 sm:max-w-xs">
          <label
            htmlFor="subscribe-email"
            className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-[var(--muted)]"
          >
            Email address
          </label>
          <input
            id="subscribe-email"
            name="email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="mt-1 w-full border-0 border-b border-[var(--line)] bg-transparent px-0 py-1.5 text-sm text-[var(--ink)] placeholder:text-[var(--muted)]/65 focus:border-[var(--accent)] focus:outline-none"
          />
        </div>
        <div className="sm:w-44">
          <label
            htmlFor="subscribe-city"
            className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-[var(--muted)]"
          >
            City
          </label>
          <select
            id="subscribe-city"
            name="cityId"
            value={cityId}
            onChange={(e) => setCityId(e.target.value)}
            className="mt-1 block w-full border-0 border-b border-[var(--line)] bg-transparent px-0 py-1.5 text-sm text-[var(--ink)] focus:border-[var(--accent)] focus:outline-none"
          >
            {CITIES.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          disabled={status === "saving"}
          className="mt-1 shrink-0 self-start border-b border-[var(--accent)] pb-1.5 text-sm font-medium text-[var(--accent-ink)] hover:text-[var(--accent)] disabled:opacity-60 sm:mt-0 sm:self-end"
        >
          {status === "saving" ? "Subscribing…" : "Subscribe"}
        </button>
      </form>
      {message ? (
        <p
          className={`mt-2 text-sm ${status === "error" ? "text-[var(--accent)]" : "text-[var(--muted)]"}`}
          role="status"
        >
          {message}
        </p>
      ) : null}
    </div>
  );
}
