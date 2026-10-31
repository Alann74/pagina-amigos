import "@fontsource-variable/bricolage-grotesque/wdth.css";
import "./globals.css";
import type { Metadata, Viewport } from "next";
import { SettingsProvider } from "@/components/Settings";

export const metadata: Metadata = {
  title: "Boca Abajo · retos entre amigos",
  description: "Juego de retos para jugar con amigos desde el celular: cartas boca abajo, votación en secreto y una revelación con suspenso.",
};
export const viewport: Viewport = { themeColor: "#191329", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" data-motion="full">
      <body><div className="ambient" aria-hidden="true"><i /><i /><i /></div><SettingsProvider>{children}</SettingsProvider></body>
    </html>
  );
}
