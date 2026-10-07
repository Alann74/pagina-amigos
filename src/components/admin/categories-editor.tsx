"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createCategory, updateCategory } from "@/app/admin/actions";
import { ImageField } from "@/components/admin/image-field";
import { CheckboxRow, FeedbackText, useAction } from "@/components/admin/ui";

type Cat = { id: number; slug: string; name: string; sortOrder: number; visible: boolean; featured: boolean; imageUrl: string | null; sizeGuide: string; productCount: number };

function CategoryRow({ cat }: { cat: Cat }) {
  const router = useRouter();
  const [c, setC] = useState(cat);
  const { pending, feedback, run } = useAction();
  const dirty = JSON.stringify(c) !== JSON.stringify(cat);
  return (
    <li className="grid gap-4 border-b border-line py-5 lg:grid-cols-[1fr_auto] lg:items-center">
      <div className="grid gap-4 sm:grid-cols-[1fr_90px_160px] sm:items-end">
        <div>
          <label className="label text-mute" htmlFor={`c-name-${c.id}`}>
            Nombre · {c.productCount} productos
          </label>
          <input id={`c-name-${c.id}`} className="field" value={c.name} onChange={(e) => setC({ ...c, name: e.target.value })} />
        </div>
        <div>
          <label className="label text-mute" htmlFor={`c-order-${c.id}`}>
            Orden
          </label>
          <input id={`c-order-${c.id}`} className="field tabular-nums" value={c.sortOrder} onChange={(e) => setC({ ...c, sortOrder: Number(e.target.value.replace(/[^\d-]/g, "")) || 0 })} inputMode="numeric" />
        </div>
        <div>
          <label className="label text-mute" htmlFor={`c-guide-${c.id}`}>
            Guía de talles
          </label>
          <select id={`c-guide-${c.id}`} className="field" value={c.sizeGuide} onChange={(e) => setC({ ...c, sizeGuide: e.target.value })}>
            <option value="letras">Prendas (S a XL)</option>
            <option value="jeans">Jeans (24 a 36)</option>
            <option value="unico">Talle único</option>
          </select>
        </div>
        <div className="flex flex-wrap gap-x-6 sm:col-span-3">
          <CheckboxRow checked={c.visible} onChange={(v) => setC({ ...c, visible: v })} label="Visible en el menú" />
          <CheckboxRow checked={c.featured} onChange={(v) => setC({ ...c, featured: v })} label="Destacada en la home" />
        </div>
        {c.featured ? (
          <div className="sm:col-span-3">
            <ImageField label="Foto de la categoría (home)" name={`categoria-${c.slug}`} value={c.imageUrl} onChange={(url) => setC({ ...c, imageUrl: url })} hint="Si no hay, se usa la foto de un producto." />
          </div>
        ) : null}
      </div>
      <div className="flex items-center gap-3">
        <button
          type="button"
          className="btn btn-secondary"
          disabled={!dirty || pending}
          onClick={() => run(() => updateCategory(c.id, { name: c.name, visible: c.visible, featured: c.featured, sortOrder: c.sortOrder, sizeGuide: c.sizeGuide, imageUrl: c.imageUrl }), () => router.refresh())}
        >
          Guardar
        </button>
        <FeedbackText feedback={feedback} pending={pending} />
      </div>
    </li>
  );
}

export function CategoriesEditor({ categories }: { categories: Cat[] }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const { pending, feedback, run } = useAction();
  return (
    <div>
      <ul>
        {categories.map((c) => (
          <CategoryRow key={`${c.id}-${c.name}-${c.sortOrder}-${c.imageUrl}`} cat={c} />
        ))}
      </ul>
      <div className="mt-8 flex flex-wrap items-end gap-4">
        <div className="min-w-60 flex-1 sm:max-w-sm">
          <label htmlFor="new-cat" className="label text-mute">
            Nueva categoría
          </label>
          <input id="new-cat" className="field" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej. Kimonos" />
        </div>
        <button type="button" className="btn btn-secondary" disabled={pending || name.trim().length < 2} onClick={() => run(() => createCategory(name), () => { setName(""); router.refresh(); })}>
          Crear
        </button>
        <FeedbackText feedback={feedback} pending={pending} />
      </div>
    </div>
  );
}
