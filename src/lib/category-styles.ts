import type { WorkshopEventCategory } from "@/lib/workshop-types";

/**
 * Soft category chips for calendar cards — light fills so titles stay readable
 * and event type is obvious at a glance.
 */
export const CATEGORY_TAG_STYLES: Record<
  WorkshopEventCategory,
  { tag: string; dot: string }
> = {
  workshop: {
    tag: "border-emerald-200/80 bg-emerald-50 text-emerald-900",
    dot: "bg-emerald-500/80",
  },
  "open-mic": {
    tag: "border-violet-200/80 bg-violet-50 text-violet-900",
    dot: "bg-violet-500/80",
  },
  reading: {
    tag: "border-rose-200/80 bg-rose-50 text-rose-900",
    dot: "bg-rose-500/80",
  },
  other: {
    tag: "border-stone-200 bg-stone-100 text-stone-700",
    dot: "bg-stone-400",
  },
};
