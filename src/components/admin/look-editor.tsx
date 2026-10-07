"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { saveSettings } from "@/app/admin/actions";
import { ImageField } from "@/components/admin/image-field";
import { CheckboxRow, Field, FeedbackText, useAction } from "@/components/admin/ui";
import type { LookSettings } from "@/lib/site-config";

type P = { id: number; name: string; articleCode: string | null; imageUrl: string | null; visible: boolean };

export function LookEditor({ initial, products }: { initial: LookSettings; products: P[] }) {
  const router = useRouter();
  const [look, setLook] = useState(initial);
  const [q, setQ] = useState("");
  const { pending, feedback, run } = useAction();
  const byId = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);
  const matches = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (term.length < 2) return [];
    return products.filter((p) => !look.productIds.includes(p.id) && `${p.name} ${p.articleCode ?? ""}`.toLowerCase().includes(term)).slice(0, 8);
  }, [q, products, look.productIds]);

  return (
    <div className="grid gap-8 lg:grid-cols-2">
      <div className="space-y-6">
        <CheckboxRow checked={look.enabled} onChange={(v) => setLook({ ...look, enabled: v })} label="Mostrar “Comprá el look” en la home" />
        <Field label="Título" htmlFor="lk-title">
          <input id="lk-title" className="field" value={look.title} onChange={(e) => setLook({ ...look, title: e.target.value })} />
        </Field>
        <ImageField label="Foto del look" name="look" value={look.imageUrl} onChange={(url) => setLook({ ...look, imageUrl: url })} hint="Vertical. También podés elegir una desde Fotos → Looks." />
      </div>
      <div>
        <p className="label text-mute">Prendas del look ({look.productIds.length})</p>
        <ul className="mt-3 divide-y divide-line">
          {look.productIds.map((id) => {
            const p = byId.get(id);
            return (
              <li key={id} className="flex items-center gap-3 py-2">
                <div className="relative h-14 w-11 shrink-0 bg-soft">{p?.imageUrl ? <Image src={p.imageUrl} alt="" fill sizes="44px" className="object-cover" /> : null}</div>
                <p className="min-w-0 flex-1 truncate text-[14px]">
                  {p?.name ?? `Producto ${id}`} {p && !p.visible ? <span className="text-mute">· oculto (no se muestra)</span> : null}
                </p>
                <button type="button" className="label px-2 py-2 text-mute hover:text-ink" onClick={() => setLook({ ...look, productIds: look.productIds.filter((x) => x !== id) })}>
                  Quitar
                </button>
              </li>
            );
          })}
        </ul>
        {look.productIds.length < 6 ? (
          <div className="mt-4">
            <label htmlFor="lk-search" className="label text-mute">
              Agregar prenda
            </label>
            <input id="lk-search" type="search" className="field" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nombre o artículo" />
            {matches.length ? (
              <ul className="border border-t-0 border-line">
                {matches.map((p) => (
                  <li key={p.id}>
                    <button
                      type="button"
                      className="w-full px-3 py-2 text-left text-[14px] hover:bg-soft"
                      onClick={() => {
                        setLook({ ...look, productIds: [...look.productIds, p.id] });
                        setQ("");
                      }}
                    >
                      {p.name} <span className="text-mute">· {p.articleCode}</span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}
      </div>
      <div className="flex items-center gap-4 lg:col-span-2">
        <button type="button" className="btn btn-primary min-w-48" disabled={pending} onClick={() => run(() => saveSettings("look", look), () => router.refresh())}>
          Guardar look
        </button>
        <FeedbackText feedback={feedback} pending={pending} />
      </div>
    </div>
  );
}
