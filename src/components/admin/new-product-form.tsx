"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createProduct } from "@/app/admin/actions";
import { Field, FeedbackText, parseMoney, useAction } from "@/components/admin/ui";

const SIZE_PRESETS = [
  { label: "S a XL", value: "S, M, L, XL" },
  { label: "Jeans 24 a 34", value: "24, 26, 28, 30, 32, 34" },
  { label: "Único", value: "UNICO" },
];

export function NewProductForm({ categories }: { categories: { id: number; name: string }[] }) {
  const router = useRouter();
  const [form, setForm] = useState({ name: "", articleCode: "", categoryId: "", price: "", colors: "", sizes: "S, M, L, XL" });
  const { pending, feedback, setFeedback, run } = useAction();
  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));
  const split = (v: string) => v.split(",").map((s) => s.trim()).filter(Boolean);

  return (
    <form
      className="grid max-w-3xl gap-6 sm:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        const price = parseMoney(form.price);
        if (!price) return setFeedback({ kind: "error", text: "Ingresá el precio" });
        run(async () => {
          const res = await createProduct({ name: form.name, articleCode: form.articleCode, categoryId: form.categoryId ? Number(form.categoryId) : null, price, colors: split(form.colors), sizes: split(form.sizes) });
          if (res.ok && res.id) router.push(`/admin/productos/${res.id}`);
          return res.ok ? { ok: true, message: "Producto creado. Ahora subí las fotos." } : res;
        });
      }}
    >
      <Field label="Nombre" htmlFor="np-name">
        <input id="np-name" className="field" value={form.name} onChange={(e) => set("name", e.target.value)} required placeholder="Blusa Mía" />
      </Field>
      <Field label="Artículo" htmlFor="np-art" hint="El número de 5 dígitos de la etiqueta">
        <input id="np-art" className="field tabular-nums" value={form.articleCode} onChange={(e) => set("articleCode", e.target.value)} required inputMode="numeric" placeholder="39603" />
      </Field>
      <Field label="Categoría" htmlFor="np-cat">
        <select id="np-cat" className="field" value={form.categoryId} onChange={(e) => set("categoryId", e.target.value)}>
          <option value="">Sin categoría</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Precio" htmlFor="np-price">
        <input id="np-price" className="field tabular-nums" value={form.price} onChange={(e) => set("price", e.target.value)} required inputMode="numeric" placeholder="45000" />
      </Field>
      <Field label="Colores" htmlFor="np-colors" hint="Separados por coma. Vacío si tiene un solo color.">
        <input id="np-colors" className="field" value={form.colors} onChange={(e) => set("colors", e.target.value)} placeholder="NEGRO, OFF WHITE" />
      </Field>
      <Field
        label="Talles"
        htmlFor="np-sizes"
        hint={
          <span className="flex flex-wrap gap-2">
            {SIZE_PRESETS.map((p) => (
              <button key={p.label} type="button" className="underline underline-offset-2" onClick={() => set("sizes", p.value)}>
                {p.label}
              </button>
            ))}
          </span>
        }
      >
        <input id="np-sizes" className="field" value={form.sizes} onChange={(e) => set("sizes", e.target.value)} required />
      </Field>
      <div className="flex flex-wrap items-center gap-4 sm:col-span-2">
        <button type="submit" className="btn btn-primary min-w-48" disabled={pending}>
          Crear producto
        </button>
        <FeedbackText feedback={feedback} pending={pending} />
      </div>
      <p className="text-[12px] text-mute sm:col-span-2">Se crea oculto. Después de subir las fotos lo publicás desde la ficha o la lista.</p>
    </form>
  );
}
