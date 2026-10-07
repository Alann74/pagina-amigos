"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { saveSettings } from "@/app/admin/actions";
import { CheckboxRow, Field, FeedbackText, useAction } from "@/components/admin/ui";
import { Markdown } from "@/lib/markdown";
import { PAGE_ROUTES, type PageKey, type PagesContent } from "@/lib/site-config";

const ORDER: PageKey[] = ["faq", "cambios", "envios", "talles", "contacto"];

export function PagesEditor({ initial }: { initial: PagesContent }) {
  const router = useRouter();
  const [pages, setPages] = useState(initial);
  const [active, setActive] = useState<PageKey>("faq");
  const [preview, setPreview] = useState(false);
  const { pending, feedback, run } = useAction();
  const page = pages[active];
  const set = (patch: Partial<PagesContent[PageKey]>) => setPages((p) => ({ ...p, [active]: { ...p[active], ...patch } }));

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {ORDER.map((k) => (
          <button key={k} type="button" onClick={() => setActive(k)} className={`label border px-3 py-2 ${k === active ? "border-ink bg-ink text-paper" : "border-line hover:border-ink"}`}>
            {pages[k].title}
            {pages[k].draft ? " · borrador" : ""}
          </button>
        ))}
      </div>

      <div className="mt-8 grid gap-6">
        {page.draft ? <p className="border border-ink px-4 py-3 text-[13px] font-medium">BORRADOR — REVISAR: este texto lo propusimos nosotros. Revisalo y destildá “Borrador” cuando esté OK.</p> : null}
        <div className="grid gap-6 sm:grid-cols-[1fr_auto] sm:items-end">
          <Field label="Título" htmlFor="pg-title">
            <input id="pg-title" className="field" value={page.title} onChange={(e) => set({ title: e.target.value })} />
          </Field>
          <CheckboxRow checked={page.draft} onChange={(v) => set({ draft: v })} label="Borrador (sin revisar)" />
        </div>
        <div>
          <div className="flex items-center justify-between">
            <p className="label text-mute">Contenido</p>
            <button type="button" className="label text-mute underline underline-offset-4 hover:text-ink" onClick={() => setPreview((v) => !v)}>
              {preview ? "Editar" : "Vista previa"}
            </button>
          </div>
          {preview ? (
            <div className="mt-3 border border-line p-5">
              <Markdown source={page.body} />
            </div>
          ) : (
            <textarea aria-label="Contenido" className="mt-2 min-h-[420px] w-full border border-line p-3 font-mono text-[13px] leading-relaxed focus:border-ink focus:outline-none" value={page.body} onChange={(e) => set({ body: e.target.value })} />
          )}
          <p className="mt-2 text-[12px] text-mute">“## Título” para subtítulos · **negrita** · “- ” para listas · [texto](https://link) · tablas con | columnas |</p>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <button type="button" className="btn btn-primary min-w-48" disabled={pending} onClick={() => run(() => saveSettings("pages", pages), () => router.refresh())}>
            Guardar textos
          </button>
          <Link href={PAGE_ROUTES[active]} target="_blank" className="nav-link link-underline">
            Ver página ↗
          </Link>
          <FeedbackText feedback={feedback} pending={pending} />
        </div>
      </div>
    </div>
  );
}
