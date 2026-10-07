"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { setProductFlags } from "@/app/admin/actions";
import { FeedbackText, Toggle, useAction } from "@/components/admin/ui";
import type { AdminProductRow } from "@/lib/admin-data";
import { formatPrice } from "@/lib/format";

type Status = "todos" | "visibles" | "ocultos" | "sin-foto" | "destacados" | "nuevos";

const STATUS_LABEL: Record<Status, string> = {
  todos: "Todos",
  visibles: "Publicados",
  ocultos: "Ocultos",
  "sin-foto": "Sin foto",
  destacados: "Destacados",
  nuevos: "Con etiqueta NUEVO",
};

function normalize(s: string) {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

export function ProductsTable({ rows, categories }: { rows: AdminProductRow[]; categories: { id: number; name: string }[] }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [category, setCategory] = useState<string>("");
  const [status, setStatus] = useState<Status>("todos");
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [local, setLocal] = useState(rows);
  const [prevRows, setPrevRows] = useState(rows);
  const { pending, feedback, run } = useAction();

  // Datos nuevos del servidor (después de guardar): reemplazan a los locales
  if (rows !== prevRows) {
    setPrevRows(rows);
    setLocal(rows);
  }

  const filtered = useMemo(() => {
    const term = normalize(q.trim());
    return local.filter((r) => {
      if (term && !normalize(`${r.name} ${r.articleCode ?? ""}`).includes(term)) return false;
      if (category === "none" ? r.categoryId !== null : category && String(r.categoryId) !== category) return false;
      if (status === "visibles" && !r.visible) return false;
      if (status === "ocultos" && r.visible) return false;
      if (status === "sin-foto" && r.imageCount > 0) return false;
      if (status === "destacados" && !r.featured) return false;
      if (status === "nuevos" && !r.isNew) return false;
      return true;
    });
  }, [local, q, category, status]);

  const allSelected = filtered.length > 0 && filtered.every((r) => selected.has(r.id));

  function patchLocal(ids: number[], patch: Partial<AdminProductRow>) {
    const set = new Set(ids);
    setLocal((prev) => prev.map((r) => (set.has(r.id) ? { ...r, ...patch } : r)));
  }

  function bulk(flags: { visible?: boolean; featured?: boolean; markNew?: boolean }) {
    const ids = [...selected];
    run(
      () => setProductFlags(ids, flags),
      () => {
        setSelected(new Set());
        router.refresh();
      },
    );
  }

  return (
    <div>
      <div className="grid gap-4 sm:grid-cols-[1fr_200px_200px]">
        <div>
          <label htmlFor="p-search" className="label text-mute">
            Buscar
          </label>
          <input id="p-search" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nombre o artículo" className="field" data-testid="admin-product-search" />
        </div>
        <div>
          <label htmlFor="p-cat" className="label text-mute">
            Categoría
          </label>
          <select id="p-cat" value={category} onChange={(e) => setCategory(e.target.value)} className="field">
            <option value="">Todas</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
            <option value="none">Sin categoría</option>
          </select>
        </div>
        <div>
          <label htmlFor="p-status" className="label text-mute">
            Mostrar
          </label>
          <select id="p-status" value={status} onChange={(e) => setStatus(e.target.value as Status)} className="field">
            {(Object.keys(STATUS_LABEL) as Status[]).map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="sticky top-[97px] z-20 mt-6 flex min-h-12 flex-wrap items-center gap-x-4 gap-y-2 border-y border-line bg-paper py-2">
        <label className="flex items-center gap-2 text-[13px]">
          <input
            type="checkbox"
            checked={allSelected}
            onChange={(e) => setSelected(e.target.checked ? new Set(filtered.map((r) => r.id)) : new Set())}
            className="h-4 w-4 appearance-none border border-ink checked:bg-ink"
            aria-label="Seleccionar todos"
          />
          {selected.size ? `${selected.size} seleccionados` : `${filtered.length} productos`}
        </label>
        {selected.size ? (
          <div className="flex flex-wrap gap-2">
            <button type="button" className="label border border-ink px-3 py-2 hover:bg-ink hover:text-paper" disabled={pending} onClick={() => bulk({ visible: true })}>
              Publicar
            </button>
            <button type="button" className="label border border-ink px-3 py-2 hover:bg-ink hover:text-paper" disabled={pending} onClick={() => bulk({ visible: false })}>
              Ocultar
            </button>
            <button type="button" className="label border border-ink px-3 py-2 hover:bg-ink hover:text-paper" disabled={pending} onClick={() => bulk({ featured: true })}>
              Destacar
            </button>
            <button type="button" className="label border border-ink px-3 py-2 hover:bg-ink hover:text-paper" disabled={pending} onClick={() => bulk({ featured: false })}>
              Quitar destacado
            </button>
            <button type="button" className="label border border-ink px-3 py-2 hover:bg-ink hover:text-paper" disabled={pending} onClick={() => bulk({ markNew: true })}>
              Marcar como nuevo
            </button>
          </div>
        ) : null}
        <FeedbackText feedback={feedback} pending={pending} />
      </div>

      {filtered.length === 0 ? (
        <p className="py-12 text-center text-[14px] text-mute">No hay productos con esos filtros.</p>
      ) : (
        <ul className="divide-y divide-line" data-testid="admin-products">
          {filtered.map((r) => {
            const isNew = r.isNew;
            return (
              <li key={r.id} className="flex items-center gap-3 py-3">
                <input
                  type="checkbox"
                  checked={selected.has(r.id)}
                  onChange={(e) => {
                    const next = new Set(selected);
                    if (e.target.checked) next.add(r.id);
                    else next.delete(r.id);
                    setSelected(next);
                  }}
                  className="h-4 w-4 shrink-0 appearance-none border border-ink checked:bg-ink"
                  aria-label={`Seleccionar ${r.name}`}
                />
                <Link href={`/admin/productos/${r.id}`} className="relative h-16 w-12 shrink-0 bg-soft">
                  {r.imageUrl ? <Image src={r.imageUrl} alt="" fill sizes="48px" className="object-cover" /> : <span className="absolute inset-0 flex items-center justify-center text-[9px] text-faint">SIN FOTO</span>}
                </Link>
                <Link href={`/admin/productos/${r.id}`} className="min-w-0 flex-1 hover:opacity-70">
                  <p className="truncate text-[14px] font-medium">{r.name}</p>
                  <p className="truncate text-[12px] text-mute">
                    {[r.articleCode ? `Art. ${r.articleCode}` : "Sin artículo", r.categoryName ?? "Sin categoría", r.stock === null ? "stock sin control" : `stock ${r.stock}`, `${r.imageCount} fotos`].join(" · ")}
                    {isNew ? " · NUEVO" : ""}
                  </p>
                  <p className="text-[13px] tabular-nums sm:hidden">{formatPrice(r.price)}</p>
                </Link>
                <p className="hidden w-28 shrink-0 text-right text-[14px] tabular-nums sm:block">{r.price > 0 ? formatPrice(r.price) : <span className="font-medium">SIN PRECIO</span>}</p>
                <div className="flex shrink-0 flex-col items-end gap-2 sm:flex-row sm:items-center sm:gap-5">
                  <span className="flex items-center gap-2">
                    <span className="label text-mute">Web</span>
                    <Toggle
                      checked={r.visible}
                      label={`Visible: ${r.name}`}
                      disabled={pending}
                      onChange={(v) => {
                        patchLocal([r.id], { visible: v });
                        run(
                          async () => {
                            const res = await setProductFlags([r.id], { visible: v });
                            if (!res.ok || (v && res.message?.startsWith("0 "))) patchLocal([r.id], { visible: !v });
                            return res;
                          },
                          () => router.refresh(),
                        );
                      }}
                    />
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="label text-mute">Dest.</span>
                    <Toggle
                      checked={r.featured}
                      label={`Destacado: ${r.name}`}
                      disabled={pending}
                      onChange={(v) => {
                        patchLocal([r.id], { featured: v });
                        run(() => setProductFlags([r.id], { featured: v }));
                      }}
                    />
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
