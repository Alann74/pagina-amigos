"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function SetupButton({ label }: { label: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  return (
    <div className="flex flex-wrap items-center gap-4">
      <button
        type="button"
        className="btn btn-primary"
        disabled={busy}
        data-testid="setup-db"
        onClick={async () => {
          setBusy(true);
          setResult(null);
          try {
            const res = await fetch("/api/admin/setup", { method: "POST" });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.error ?? `Error ${res.status}`);
            const s = data.summary;
            setResult({ ok: true, text: `Listo: ${s.nuevos} productos nuevos (${s.productos} en el archivo del POS), ${s.variantes} variantes, ${s.categorias} categorías.` });
            router.refresh();
          } catch (e) {
            setResult({ ok: false, text: e instanceof Error ? e.message : "Error" });
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? "Preparando…" : label}
      </button>
      {result ? (
        <span role={result.ok ? "status" : "alert"} className={`text-[13px] ${result.ok ? "text-mute" : "font-medium"}`}>
          {result.text}
        </span>
      ) : null}
    </div>
  );
}
