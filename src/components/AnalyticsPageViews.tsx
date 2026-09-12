"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

export function AnalyticsPageViews({ id }: { id: string }) {
  const pathname = usePathname();

  useEffect(() => {
    if (!id || typeof window.gtag !== "function") return;
    window.gtag("event", "page_view", {
      page_path: pathname,
      send_to: id,
    });
  }, [id, pathname]);

  return null;
}
