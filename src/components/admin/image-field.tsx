"use client";

import Image from "next/image";
import { useState } from "react";
import { uploadImage } from "@/components/admin/upload";

export function ImageField({ label, value, onChange, name, hint }: { label: string; value: string | null; onChange: (url: string | null) => void; name: string; hint?: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <div>
      <p className="label text-mute">{label}</p>
      <div className="mt-2 flex items-start gap-4">
        <div className="relative h-28 w-24 shrink-0 bg-soft">
          {value ? <Image src={value} alt="" fill sizes="96px" className="object-cover" /> : <span className="absolute inset-0 flex items-center justify-center text-[10px] text-faint">SIN FOTO</span>}
        </div>
        <div className="flex flex-col items-start gap-2">
          <label className="label cursor-pointer border border-ink px-3 py-2 hover:bg-ink hover:text-paper">
            {busy ? "Subiendo…" : value ? "Cambiar" : "Subir foto"}
            <input
              type="file"
              accept="image/*"
              className="sr-only"
              disabled={busy}
              onChange={async (e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (!file) return;
                setBusy(true);
                setError(null);
                try {
                  const res = await uploadImage(file, { kind: "campaign", name });
                  onChange(String(res.url));
                } catch (err) {
                  setError(err instanceof Error ? err.message : "No se pudo subir");
                } finally {
                  setBusy(false);
                }
              }}
            />
          </label>
          {value ? (
            <button type="button" className="label px-1 py-1 text-mute hover:text-ink" onClick={() => onChange(null)}>
              Quitar
            </button>
          ) : null}
          {hint ? <p className="text-[12px] text-mute">{hint}</p> : null}
          {error ? <p className="text-[12px] font-medium">{error}</p> : null}
        </div>
      </div>
    </div>
  );
}
