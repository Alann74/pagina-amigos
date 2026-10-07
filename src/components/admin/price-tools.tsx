"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { applyBulkIncrease, updatePrices } from "@/app/admin/actions";
import { Field, FeedbackText, Section, parseMoney, useAction } from "@/components/admin/ui";
import { formatPrice } from "@/lib/format";
import { applyPercent, ROUNDING_LABEL, type Rounding } from "@/lib/pricing";

type Row = { id: number; name: string; articleCode: string | null; categoryId: number | null; categoryName: string | null; price: number; visible: boolean };
type Scope = "todos" | "categoria" | "seleccion";

function normalize(s: string) {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

export function PriceTools({ rows, categories }: { rows: Row[]; categories: { id: number; name: string }[] }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("");
  const [edits, setEdits] = useState<Record<number, string>>({});
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [percent, setPercent] = useState("10");
  const [scope, setScope] = useState<Scope>("todos");
  const [bulkCategory, setBulkCategory] = useState(categories[0] ? String(categories[0].id) : "");
  const [rounding, setRounding] = useState<Rounding>("100");
  const [previewKey, setPreviewKey] = useState<string | null>(null);
  const [prevRows, setPrevRows] = useState(rows);
  const save = useAction();
  const bulk = useAction();

  // Después de guardar llegan precios nuevos del servidor: se limpian las ediciones
  if (rows !== prevRows) {
    setPrevRows(rows);
    setEdits({});
  }

  const filtered = useMemo(() => {
    const term = normalize(q.trim());
    return rows.filter((r) => (!term || normalize(`${r.name} ${r.articleCode ?? ""}`).includes(term)) && (!category || String(r.categoryId) === category));
  }, [rows, q, category]);

  const changes = Object.entries(edits)
    .map(([id, v]) => ({ id: Number(id), price: parseMoney(v) }))
    .filter((c): c is { id: number; price: number } => c.price !== null && c.price > 0 && rows.find((r) => r.id === c.id)?.price !== c.price);

  const pct = Number(percent.replace(",", "."));
  const affected = useMemo(() => {
    if (scope === "todos") return rows;
    if (scope === "categoria") return rows.filter((r) => String(r.categoryId) === bulkCategory);
    return rows.filter((r) => selected.has(r.id));
  }, [rows, scope, bulkCategory, selected]);
  const preview = Number.isFinite(pct) && pct !== 0 ? affected.map((r) => ({ ...r, next: applyPercent(r.price, pct, rounding) })) : [];
  const beforeTotal = preview.reduce((a, r) => a + r.price, 0);
  const afterTotal = preview.reduce((a, r) => a + r.next, 0);

  // La vista previa se oculta sola si cambia cualquier parámetro
  const paramsKey = JSON.stringify([percent, scope, bulkCategory, rounding, [...selected].sort()]);
  const showPreview = previewKey === paramsKey;
  const setShowPreview = (v: boolean) => setPreviewKey(v ? paramsKey : null);

  const allSelected = filtered.length > 0 && filtered.every((r) => selected.has(r.id));

  return (
    <>
      <Section title="Aumento masivo por porcentaje">
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4 lg:items-end">
          <Field label="Porcentaje" htmlFor="b-pct" hint="Negativo para bajar (ej. -15)">
            <div className="flex items-center">
              <input id="b-pct" className="field tabular-nums" value={percent} onChange={(e) => setPercent(e.target.value)} inputMode="decimal" data-testid="bulk-percent" />
              <span className="ml-2 text-[15px]">%</span>
            </div>
          </Field>
          <Field label="Aplicar a" htmlFor="b-scope">
            <select id="b-scope" className="field" value={scope} onChange={(e) => setScope(e.target.value as Scope)}>
              <option value="todos">Todos los productos ({rows.length})</option>
              <option value="categoria">Una categoría</option>
              <option value="seleccion">Los seleccionados en la tabla ({selected.size})</option>
            </select>
          </Field>
          {scope === "categoria" ? (
            <Field label="Categoría" htmlFor="b-cat">
              <select id="b-cat" className="field" value={bulkCategory} onChange={(e) => setBulkCategory(e.target.value)}>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </Field>
          ) : (
            <div className="hidden lg:block" />
          )}
          <Field label="Redondeo" htmlFor="b-round" hint="Siempre hacia arriba">
            <select id="b-round" className="field" value={rounding} onChange={(e) => setRounding(e.target.value as Rounding)}>
              {(Object.keys(ROUNDING_LABEL) as Rounding[]).map((r) => (
                <option key={r} value={r}>
                  {ROUNDING_LABEL[r]}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <div className="mt-6 flex flex-wrap items-center gap-4">
          <button type="button" className="btn btn-secondary" disabled={preview.length === 0} onClick={() => setShowPreview(true)} data-testid="bulk-preview">
            Ver vista previa
          </button>
          <FeedbackText feedback={bulk.feedback} pending={bulk.pending} />
        </div>

        {showPreview && preview.length ? (
          <div className="mt-6 border border-ink p-4 sm:p-6" data-testid="bulk-preview-panel">
            <p className="text-[14px]">
              <strong>{preview.length}</strong> productos · {pct > 0 ? "suben" : "bajan"} {Math.abs(pct)}% · {ROUNDING_LABEL[rounding].toLowerCase()}
            </p>
            <p className="mt-1 text-[13px] text-mute tabular-nums">
              Suma de precios: {formatPrice(beforeTotal)} → {formatPrice(afterTotal)}
            </p>
            <ul className="mt-4 max-h-80 divide-y divide-line overflow-y-auto text-[13px]">
              {preview.slice(0, 200).map((r) => (
                <li key={r.id} className="flex justify-between gap-4 py-1.5">
                  <span className="min-w-0 truncate">
                    {r.name} {r.articleCode ? <span className="text-mute">· {r.articleCode}</span> : null}
                  </span>
                  <span className="shrink-0 tabular-nums">
                    <span className="text-mute line-through">{formatPrice(r.price)}</span> → <strong>{formatPrice(r.next)}</strong>
                  </span>
                </li>
              ))}
            </ul>
            <div className="mt-5 flex flex-wrap gap-3">
              <button
                type="button"
                className="btn btn-primary"
                disabled={bulk.pending}
                data-testid="bulk-apply"
                onClick={() => {
                  if (!confirm(`¿Aplicar el ${pct > 0 ? "aumento" : "descuento"} del ${Math.abs(pct)}% a ${preview.length} productos?`)) return;
                  bulk.run(
                    () => applyBulkIncrease({ percent: pct, scope, categoryId: scope === "categoria" ? Number(bulkCategory) : null, productIds: [...selected], rounding }),
                    () => {
                      setShowPreview(false);
                      setSelected(new Set());
                      router.refresh();
                    },
                  );
                }}
              >
                Aplicar a {preview.length} productos
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => setShowPreview(false)}>
                Cancelar
              </button>
            </div>
          </div>
        ) : null}
      </Section>

      <Section title="Edición rápida" aside={<span className="text-[12px] text-mute">Cambiá los precios y tocá Guardar</span>}>
        <div className="grid gap-4 sm:grid-cols-[1fr_220px]">
          <div>
            <label htmlFor="pr-q" className="label text-mute">
              Buscar
            </label>
            <input id="pr-q" type="search" className="field" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nombre o artículo" />
          </div>
          <div>
            <label htmlFor="pr-cat" className="label text-mute">
              Categoría
            </label>
            <select id="pr-cat" className="field" value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="">Todas</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="sticky top-[97px] z-20 mt-6 flex min-h-14 flex-wrap items-center justify-between gap-3 border-y border-line bg-paper py-2">
          <label className="flex items-center gap-2 text-[13px]">
            <input
              type="checkbox"
              checked={allSelected}
              onChange={(e) => {
                const next = new Set(selected);
                for (const r of filtered) {
                  if (e.target.checked) next.add(r.id);
                  else next.delete(r.id);
                }
                setSelected(next);
              }}
              className="h-4 w-4 appearance-none border border-ink checked:bg-ink"
              aria-label="Seleccionar los de la lista"
            />
            {selected.size ? `${selected.size} seleccionados para el aumento` : `${filtered.length} productos`}
          </label>
          <div className="flex items-center gap-3">
            <FeedbackText feedback={save.feedback} pending={save.pending} />
            <button type="button" className="btn btn-primary" disabled={save.pending || changes.length === 0} onClick={() => save.run(() => updatePrices(changes), () => router.refresh())} data-testid="save-prices">
              Guardar{changes.length ? ` (${changes.length})` : ""}
            </button>
          </div>
        </div>

        <ul className="divide-y divide-line">
          {filtered.map((r) => {
            const value = edits[r.id] ?? String(r.price);
            const changed = parseMoney(value) !== r.price;
            return (
              <li key={r.id} className="flex items-center gap-3 py-2">
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
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14px]">{r.name}</p>
                  <p className="truncate text-[12px] text-mute">
                    {r.articleCode ?? "Sin artículo"} · {r.categoryName ?? "Sin categoría"}
                    {r.visible ? "" : " · oculto"}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-[14px] text-mute">$</span>
                  <input
                    aria-label={`Precio de ${r.name}`}
                    value={value}
                    onChange={(e) => setEdits((d) => ({ ...d, [r.id]: e.target.value }))}
                    inputMode="numeric"
                    className={`h-10 w-28 border px-2 text-right tabular-nums ${changed ? "border-ink font-medium" : "border-line"}`}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      </Section>
    </>
  );
}
