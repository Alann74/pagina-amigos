import "@fontsource-variable/bricolage-grotesque/wdth.css";
import "./globals.css";
import type { Metadata, Viewport } from "next";
import { SettingsProvider } from "@/components/Settings";
import { Splash } from "@/components/Splash";

export const metadata: Metadata = {
  title: "Boca Abajo · retos entre amigos",
  appleWebApp: { capable: true, title: "Boca Abajo", statusBarStyle: "black-translucent" },
  description: "Juego de retos para jugar con amigos desde el celular: cartas boca abajo, votación en secreto y una revelación con suspenso.",
};
export const viewport: Viewport = { themeColor: "#191329", width: "device-width", initialScale: 1, viewportFit: "cover" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" data-motion="full">
      <body><div className="ambient" aria-hidden="true"><i /><i /><i /></div><SettingsProvider>{children}<Splash /></SettingsProvider></body>
    </html>
  );
}
