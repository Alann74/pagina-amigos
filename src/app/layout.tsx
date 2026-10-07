import type { Metadata, Viewport } from "next";
import { Inter_Tight } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { MarketingScripts } from "@/components/marketing-scripts";
import { BRAND, DEFAULT_DESCRIPTION, SITE_URL } from "@/lib/site";
import "./globals.css";

const interTight = Inter_Tight({
  variable: "--font-inter-tight",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: `${BRAND} · Rosario`, template: `%s · ${BRAND}` },
  description: DEFAULT_DESCRIPTION,
  applicationName: BRAND,
  openGraph: { type: "website", locale: "es_AR", siteName: BRAND },
  twitter: { card: "summary_large_image" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: "#ffffff",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es-AR" className={`${interTight.variable} antialiased`}>
      <body className="min-h-dvh bg-paper text-ink">
        {children}
        <MarketingScripts />
        <Analytics />
      </body>
    </html>
  );
}
