"use client";

import "./globals.css";
import { ErrorView } from "@/components/error-view";

export default function GlobalError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <html lang="es-AR">
      <body className="bg-paper text-ink">
        <title>INEDITA</title>
        <p className="pt-10 text-center text-[15px] font-medium tracking-[0.32em] pl-[0.32em]">INEDITA</p>
        <ErrorView error={error} retry={retry} />
      </body>
    </html>
  );
}
