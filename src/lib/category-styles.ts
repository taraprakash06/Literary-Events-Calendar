import type { WorkshopEventCategory } from "@/lib/workshop-types";

/** Soft, editorial tag treatments — backgrounds stay light for scanability. */
export const CATEGORY_TAG_STYLES: Record<
  WorkshopEventCategory,
  { tag: string; dot: string }
> = {
  reading: {
    tag: "border-rose-200/90 bg-rose-50/90 text-rose-900/90",
    dot: "bg-rose-400/80",
  },
  workshop: {
    tag: "border-emerald-200/90 bg-emerald-50/90 text-emerald-900/85",
    dot: "bg-emerald-400/75",
  },
  "open-mic": {
    tag: "border-violet-200/90 bg-violet-50/90 text-violet-900/85",
    dot: "bg-violet-400/75",
  },
  festival: {
    tag: "border-amber-200/90 bg-amber-50/90 text-amber-950/80",
    dot: "bg-amber-400/70",
  },
  "book-club": {
    tag: "border-sky-200/90 bg-sky-50/90 text-sky-950/85",
    dot: "bg-sky-400/75",
  },
  panel: {
    tag: "border-teal-200/90 bg-teal-50/90 text-teal-950/85",
    dot: "bg-teal-400/70",
  },
  launch: {
    tag: "border-orange-200/90 bg-orange-50/90 text-orange-950/85",
    dot: "bg-orange-400/70",
  },
  theater: {
    tag: "border-fuchsia-200/90 bg-fuchsia-50/90 text-fuchsia-950/85",
    dot: "bg-fuchsia-400/65",
  },
  other: {
    tag: "border-stone-200/90 bg-stone-100/90 text-stone-800",
    dot: "bg-stone-400/70",
  },
};
