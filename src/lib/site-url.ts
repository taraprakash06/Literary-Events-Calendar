/** Public site URL (Render: https://litlist.onrender.com). */
export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ??
  "https://litlist.onrender.com";
