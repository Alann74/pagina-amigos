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
  title: { default: `${BRAND} — Ropa de mujer`, template: `%s · ${BRAND}` },
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

// Antes de pintar: si la persona entró como mayorista, se ocultan los precios de la tienda hasta que
// lleguen los precios por mayor (así no ve por un instante los precios minoristas).
const WHOLESALE_BOOT = `try{if(document.cookie.split(/;\\s*/).indexOf("inedita_my=1")>-1)document.documentElement.classList.add("mayorista")}catch(e){}`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es-AR" className={`${interTight.variable} antialiased`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: WHOLESALE_BOOT }} />
      </head>
      <body className="min-h-dvh bg-paper text-ink">
        {children}
        <MarketingScripts />
        <Analytics />
      </body>
    </html>
  );
}
