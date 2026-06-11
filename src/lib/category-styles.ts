import type { WorkshopEventCategory } from "@/lib/workshop-types";

/** Soft, editorial tag treatments — backgrounds stay light for scanability. */
export const CATEGORY_TAG_STYLES: Record<
  WorkshopEventCategory,
  { tag: string; dot: string }
> = {
  workshop: {
    tag: "border-emerald-200/90 bg-emerald-50/90 text-emerald-900/85",
    dot: "bg-emerald-400/75",
  },
  "open-mic": {
    tag: "border-violet-200/90 bg-violet-50/90 text-violet-900/85",
    dot: "bg-violet-400/75",
  },
  reading: {
    tag: "border-rose-200/90 bg-rose-50/90 text-rose-900/90",
    dot: "bg-rose-400/80",
  },
  other: {
    tag: "border-stone-200/90 bg-stone-100/90 text-stone-800",
    dot: "bg-stone-400/70",
  },
};
