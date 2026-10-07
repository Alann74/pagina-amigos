"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import { addVariantOptions, deleteImage, reorderImages, setImageColor, setProductFlags, updateProduct, updateVariants } from "@/app/admin/actions";
import { CheckboxRow, Field, FeedbackText, Section, parseMoney, useAction } from "@/components/admin/ui";
import { uploadImage } from "@/components/admin/upload";
import { cashPrice, displayColor, displaySize, formatPrice } from "@/lib/format";

type Option = { id: number; name: string };

type EditorProduct = {
  id: number;
  slug: string;
  name: string;
  articleCode: string | null;
  description: string;
  categoryId: number | null;
  price: number;
  compareAtPrice: number | null;
  visible: boolean;
  featured: boolean;
  publishedAt: Date | string;
};

type EditorVariant = {
  id: number;
  size: string;
  sku: string;
  labelCode: string | null;
  stock: number | null;
  priceOverride: number | null;
  active: boolean;
  colorId: number | null;
  color: string | null;
};

type EditorImage = { id: number; url: string; colorId: number | null; sortOrder: number; sourceName: string | null };

export function ProductEditor({
  product,
  variants,
  images,
  categories,
  colors,
  sold,
  discount,
}: {
  product: EditorProduct;
  variants: EditorVariant[];
  images: EditorImage[];
  categories: Option[];
  colors: Option[];
  sold: number;
  discount: number;
}) {
  return (
    <>
      <ProductFields product={product} categories={categories} hasImages={images.length > 0} sold={sold} discount={discount} />
      <ImagesManager productId={product.id} images={images} colors={colors.filter((c) => variants.some((v) => v.colorId === c.id))} />
      <VariantsEditor productId={product.id} variants={variants} basePrice={product.price} />
    </>
  );
}

// ---------------------------------------------------------------- datos

function ProductFields({ product, categories, hasImages, sold, discount }: { product: EditorProduct; categories: Option[]; hasImages: boolean; sold: number; discount: number }) {
  const router = useRouter();
  const [form, setForm] = useState({
    name: product.name,
    articleCode: product.articleCode ?? "",
    description: product.description,
    categoryId: product.categoryId ? String(product.categoryId) : "",
    price: String(product.price || ""),
    compareAtPrice: product.compareAtPrice ? String(product.compareAtPrice) : "",
    visible: product.visible,
    featured: product.featured,
  });
  const { pending, feedback, run } = useAction();
  const markNew = useAction();
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }));
  const price = parseMoney(form.price);

  return (
    <Section title="Datos" aside={<span className="text-[12px] text-mute">{sold ? `${sold} unidades pedidas por la web` : "Sin pedidos todavía"}</span>}>
      <form
        className="grid gap-6 lg:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          run(
            () =>
              updateProduct(product.id, {
                name: form.name,
                articleCode: form.articleCode,
                description: form.description,
                categoryId: form.categoryId ? Number(form.categoryId) : null,
                price: price ?? 0,
                compareAtPrice: parseMoney(form.compareAtPrice),
                visible: form.visible,
                featured: form.featured,
              }),
            () => router.refresh(),
          );
        }}
      >
        <Field label="Nombre" htmlFor="pe-name">
          <input id="pe-name" className="field" value={form.name} onChange={(e) => set("name", e.target.value)} required maxLength={120} />
        </Field>
        <Field label="Artículo" htmlFor="pe-art" hint="Código de 5 dígitos de la etiqueta (ej. 39603). Une el producto con las fotos y el sistema del local.">
          <input id="pe-art" className="field tabular-nums" value={form.articleCode} onChange={(e) => set("articleCode", e.target.value)} inputMode="numeric" maxLength={20} />
        </Field>
        <Field label="Categoría" htmlFor="pe-cat">
          <select id="pe-cat" className="field" value={form.categoryId} onChange={(e) => set("categoryId", e.target.value)}>
            <option value="">Sin categoría</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
        <div className="grid grid-cols-2 gap-6">
          <Field label="Precio" htmlFor="pe-price" hint={price ? `Efectivo / transferencia: ${formatPrice(cashPrice(price, discount))}` : "Obligatorio para publicar"}>
            <input id="pe-price" className="field tabular-nums" value={form.price} onChange={(e) => set("price", e.target.value)} inputMode="numeric" required data-testid="admin-price" />
          </Field>
          <Field label="Precio anterior" htmlFor="pe-compare" hint="Opcional: se muestra tachado">
            <input id="pe-compare" className="field tabular-nums" value={form.compareAtPrice} onChange={(e) => set("compareAtPrice", e.target.value)} inputMode="numeric" />
          </Field>
        </div>
        <div className="lg:col-span-2">
          <Field label="Descripción" htmlFor="pe-desc" hint="Tela, calce, largo, cuidados. Se muestra en la ficha.">
            <textarea id="pe-desc" className="field min-h-28" value={form.description} onChange={(e) => set("description", e.target.value)} maxLength={4000} />
          </Field>
        </div>
        <div className="flex flex-wrap gap-x-8 lg:col-span-2">
          <CheckboxRow checked={form.visible} onChange={(v) => set("visible", v)} label={hasImages ? "Visible en la tienda" : "Visible en la tienda (necesita al menos una foto)"} />
          <CheckboxRow checked={form.featured} onChange={(v) => set("featured", v)} label="Destacado (aparece primero)" />
        </div>
        <div className="flex flex-wrap items-center gap-4 lg:col-span-2">
          <button type="submit" className="btn btn-primary min-w-40" disabled={pending}>
            Guardar
          </button>
          <button type="button" className="btn btn-secondary" disabled={markNew.pending} onClick={() => markNew.run(() => setProductFlags([product.id], { markNew: true }).then((r) => (r.ok ? { ok: true, message: "Marcado como nuevo ingreso" } : r)), () => router.refresh())}>
            Marcar como nuevo
          </button>
          <FeedbackText feedback={feedback ?? markNew.feedback} pending={pending || markNew.pending} />
        </div>
      </form>
    </Section>
  );
}

// ---------------------------------------------------------------- fotos

function ImagesManager({ productId, images, colors }: { productId: number; images: EditorImage[]; colors: Option[] }) {
  const router = useRouter();
  const [list, setList] = useState(images);
  const [prevImages, setPrevImages] = useState(images);
  if (images !== prevImages) {
    setPrevImages(images);
    setList(images);
  }
  const [uploading, setUploading] = useState<{ done: number; total: number } | null>(null);
  const [uploadColor, setUploadColor] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const { pending, feedback, setFeedback, run } = useAction();

  function move(index: number, delta: number) {
    const next = [...list];
    const target = index + delta;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    setList(next);
    run(() => reorderImages(productId, next.map((i) => i.id)).then((r) => (r.ok ? { ok: true, message: "Orden guardado" } : r)));
  }

  async function onFiles(files: FileList | null) {
    if (!files?.length) return;
    const arr = [...files];
    setUploading({ done: 0, total: arr.length });
    const errors: string[] = [];
    for (const [i, f] of arr.entries()) {
      try {
        await uploadImage(f, { kind: "product", productId: String(productId), ...(uploadColor ? { colorId: uploadColor } : {}) });
      } catch (e) {
        errors.push(`${f.name}: ${e instanceof Error ? e.message : "error"}`);
      }
      setUploading({ done: i + 1, total: arr.length });
    }
    setUploading(null);
    if (inputRef.current) inputRef.current.value = "";
    setFeedback(errors.length ? { kind: "error", text: errors.join(" · ") } : { kind: "ok", text: `${arr.length} ${arr.length === 1 ? "foto subida" : "fotos subidas"}` });
    router.refresh();
  }

  return (
    <Section title={`Fotos (${list.length})`} aside={<span className="text-[12px] text-mute">La primera es la principal y la segunda aparece al pasar el mouse</span>}>
      {list.length === 0 ? <p className="mb-6 text-[14px] text-mute">Este producto no tiene fotos: queda oculto hasta que subas al menos una.</p> : null}
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
        {list.map((img, i) => (
          <li key={img.id} className="border border-line">
            <div className="relative aspect-[3/4] bg-soft">
              <Image src={img.url} alt="" fill sizes="(min-width: 1024px) 16vw, 50vw" className="object-cover" />
              {i < 2 ? <span className="label absolute left-1.5 top-1.5 bg-ink px-1.5 py-0.5 text-paper">{i === 0 ? "Principal" : "Hover"}</span> : null}
            </div>
            <div className="space-y-2 p-2">
              {colors.length > 1 ? (
                <select
                  aria-label="Color de la foto"
                  value={img.colorId ?? ""}
                  onChange={(e) => {
                    const colorId = e.target.value ? Number(e.target.value) : null;
                    setList((l) => l.map((x) => (x.id === img.id ? { ...x, colorId } : x)));
                    run(() => setImageColor(img.id, colorId).then((r) => (r.ok ? { ok: true, message: "Color asignado" } : r)));
                  }}
                  className="h-9 w-full border border-line bg-paper px-1 text-[12px]"
                >
                  <option value="">Todos los colores</option>
                  {colors.map((c) => (
                    <option key={c.id} value={c.id}>
                      {displayColor(c.name)}
                    </option>
                  ))}
                </select>
              ) : null}
              <div className="flex items-center justify-between">
                <div className="flex">
                  <button type="button" className="flex h-9 w-9 items-center justify-center border border-line disabled:opacity-30" disabled={i === 0 || pending} onClick={() => move(i, -1)} aria-label="Mover antes">
                    ←
                  </button>
                  <button type="button" className="-ml-px flex h-9 w-9 items-center justify-center border border-line disabled:opacity-30" disabled={i === list.length - 1 || pending} onClick={() => move(i, 1)} aria-label="Mover después">
                    →
                  </button>
                </div>
                <button
                  type="button"
                  className="label h-9 px-2 text-mute hover:text-ink"
                  disabled={pending}
                  onClick={() => {
                    if (!confirm("¿Borrar esta foto? No se puede deshacer.")) return;
                    setList((l) => l.filter((x) => x.id !== img.id));
                    run(() => deleteImage(img.id).then((r) => (r.ok ? { ok: true, message: "Foto borrada" } : r)), () => router.refresh());
                  }}
                >
                  Borrar
                </button>
              </div>
            </div>
          </li>
        ))}
      </ul>
      <div className="mt-6 flex flex-wrap items-center gap-4">
        <label className="btn btn-secondary cursor-pointer">
          {uploading ? `Subiendo ${uploading.done}/${uploading.total}…` : "Subir fotos"}
          <input ref={inputRef} type="file" accept="image/*" multiple className="sr-only" disabled={Boolean(uploading)} onChange={(e) => onFiles(e.target.files)} data-testid="upload-images" />
        </label>
        {colors.length > 1 ? (
          <select aria-label="Color de las fotos que vas a subir" value={uploadColor} onChange={(e) => setUploadColor(e.target.value)} className="h-12 border border-line bg-paper px-2 text-[13px]">
            <option value="">Para todos los colores</option>
            {colors.map((c) => (
              <option key={c.id} value={c.id}>
                Color {displayColor(c.name)}
              </option>
            ))}
          </select>
        ) : null}
        <FeedbackText feedback={feedback} pending={pending} />
      </div>
      <p className="mt-2 text-[12px] text-mute">JPG, PNG o WebP. Se optimizan solas (WebP en 3 tamaños, proporción 3:4 con fondo blanco).</p>
    </Section>
  );
}

// ---------------------------------------------------------------- variantes y stock

type VariantDraft = { stock: string; active: boolean; priceOverride: string; labelCode: string };

function VariantsEditor({ productId, variants, basePrice }: { productId: number; variants: EditorVariant[]; basePrice: number }) {
  const router = useRouter();
  const initial = useMemo(
    () => Object.fromEntries(variants.map((v) => [v.id, { stock: v.stock === null ? "" : String(v.stock), active: v.active, priceOverride: v.priceOverride ? String(v.priceOverride) : "", labelCode: v.labelCode ?? "" }])) as Record<number, VariantDraft>,
    [variants],
  );
  const [draft, setDraft] = useState(initial);
  const [prevInitial, setPrevInitial] = useState(initial);
  if (initial !== prevInitial) {
    setPrevInitial(initial);
    setDraft(initial);
  }
  const [newColors, setNewColors] = useState("");
  const [newSizes, setNewSizes] = useState("");
  const { pending, feedback, run } = useAction();
  const add = useAction();

  const dirty = variants.filter((v) => JSON.stringify(draft[v.id]) !== JSON.stringify(initial[v.id]));
  const groups = useMemo(() => {
    const map = new Map<string, EditorVariant[]>();
    for (const v of variants) {
      const key = v.color ?? "";
      map.set(key, [...(map.get(key) ?? []), v]);
    }
    return [...map.entries()];
  }, [variants]);

  const setV = (id: number, patch: Partial<VariantDraft>) => setDraft((d) => ({ ...d, [id]: { ...d[id], ...patch } }));

  return (
    <Section title={`Talles, colores y stock (${variants.length})`} aside={<span className="text-[12px] text-mute">Stock vacío = sin control (se vende como disponible)</span>}>
      {groups.map(([color, list]) => (
        <div key={color || "sin-color"} className="mb-8">
          <p className="label mb-2 font-medium">{color ? displayColor(color) : "Sin color"}</p>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-[13px]">
              <thead>
                <tr className="label text-left text-mute">
                  <th className="py-2 pr-3 font-normal">Talle</th>
                  <th className="py-2 pr-3 font-normal">SKU</th>
                  <th className="py-2 pr-3 font-normal">Stock</th>
                  <th className="py-2 pr-3 font-normal">Precio propio</th>
                  <th className="py-2 pr-3 font-normal">Código de etiqueta</th>
                  <th className="py-2 font-normal">Activa</th>
                </tr>
              </thead>
              <tbody>
                {list.map((v) => {
                  const d = draft[v.id];
                  if (!d) return null;
                  return (
                    <tr key={v.id} className={`border-t border-line ${d.active ? "" : "text-faint"}`}>
                      <td className="py-1.5 pr-3 font-medium">{displaySize(v.size)}</td>
                      <td className="py-1.5 pr-3 text-mute">{v.sku}</td>
                      <td className="py-1.5 pr-3">
                        <input aria-label={`Stock ${v.sku}`} value={d.stock} onChange={(e) => setV(v.id, { stock: e.target.value.replace(/\D/g, "") })} inputMode="numeric" placeholder="—" className="h-9 w-20 border border-line px-2 tabular-nums" />
                      </td>
                      <td className="py-1.5 pr-3">
                        <input aria-label={`Precio propio ${v.sku}`} value={d.priceOverride} onChange={(e) => setV(v.id, { priceOverride: e.target.value })} inputMode="numeric" placeholder={formatPrice(basePrice)} className="h-9 w-28 border border-line px-2 tabular-nums" />
                      </td>
                      <td className="py-1.5 pr-3">
                        <input aria-label={`Etiqueta ${v.sku}`} value={d.labelCode} onChange={(e) => setV(v.id, { labelCode: e.target.value.toUpperCase() })} placeholder="39603%DMS" className="h-9 w-32 border border-line px-2" />
                      </td>
                      <td className="py-1.5">
                        <input type="checkbox" aria-label={`Activa ${v.sku}`} checked={d.active} onChange={(e) => setV(v.id, { active: e.target.checked })} className="h-4 w-4 appearance-none border border-ink checked:bg-ink" />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ))}
      <div className="flex flex-wrap items-center gap-4">
        <button
          type="button"
          className="btn btn-primary min-w-40"
          disabled={pending || dirty.length === 0}
          onClick={() =>
            run(
              () =>
                updateVariants(
                  productId,
                  dirty.map((v) => ({
                    id: v.id,
                    stock: draft[v.id].stock === "" ? null : Number(draft[v.id].stock),
                    active: draft[v.id].active,
                    priceOverride: parseMoney(draft[v.id].priceOverride),
                    labelCode: draft[v.id].labelCode,
                  })),
                ),
              () => router.refresh(),
            )
          }
        >
          Guardar stock{dirty.length ? ` (${dirty.length})` : ""}
        </button>
        <FeedbackText feedback={feedback} pending={pending} />
      </div>

      <div className="mt-10 grid gap-4 border-t border-line pt-6 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <Field label="Agregar colores" htmlFor="nv-colors" hint="Separados por coma: NEGRO, OFF WHITE">
          <input id="nv-colors" className="field" value={newColors} onChange={(e) => setNewColors(e.target.value)} />
        </Field>
        <Field label="Agregar talles" htmlFor="nv-sizes" hint="Separados por coma: S, M, L o 26, 28">
          <input id="nv-sizes" className="field" value={newSizes} onChange={(e) => setNewSizes(e.target.value)} />
        </Field>
        <button
          type="button"
          className="btn btn-secondary"
          disabled={add.pending || (!newColors.trim() && !newSizes.trim())}
          onClick={() =>
            add.run(
              () => addVariantOptions(productId, { colors: newColors.split(",").map((s) => s.trim()).filter(Boolean), sizes: newSizes.split(",").map((s) => s.trim()).filter(Boolean) }),
              () => {
                setNewColors("");
                setNewSizes("");
                router.refresh();
              },
            )
          }
        >
          Agregar
        </button>
        <div className="sm:col-span-3">
          <FeedbackText feedback={add.feedback} pending={add.pending} />
        </div>
      </div>
    </Section>
  );
}
