import type { Metadata } from "next";
import { Libre_Baskerville, Source_Sans_3 } from "next/font/google";
import { SITE_URL } from "@/lib/site-url";
import "./globals.css";

const sourceSans = Source_Sans_3({
  variable: "--font-source-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const libreBaskerville = Libre_Baskerville({
  variable: "--font-libre-baskerville",
  subsets: ["latin"],
  weight: ["400", "700"],
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "The Lit List",
  description:
    "Literary events near you — readings, workshops, and open mics gathered from libraries, bookstores, Eventbrite, and Instagram into one calendar.",
  openGraph: {
    title: "The Lit List",
    description:
      "Find the next reading, workshop, or open mic in your city — pulled from scattered listings into one place.",
    url: SITE_URL,
    siteName: "The Lit List",
  },
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
    apple: [{ url: "/icon.svg", type: "image/svg+xml" }],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${sourceSans.variable} ${libreBaskerville.variable} h-full antialiased`}
      style={{ colorScheme: "light" }}
    >
      <body className="flex min-h-full flex-col font-sans">{children}</body>
    </html>
  );
}
