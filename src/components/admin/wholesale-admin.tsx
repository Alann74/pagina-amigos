"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { fetchSheetCsv, saveWholesalePrices, saveWholesaleSettings } from "@/app/admin/actions";
import { CopyButton } from "@/components/admin/copy-button";
import { Field, FeedbackText, Section, Toggle, parseMoney, useAction } from "@/components/admin/ui";
import { formatPrice } from "@/lib/format";
import type { WholesaleSettings } from "@/lib/wholesale-config";
import { csvToRows, normalizeName, parsePriceTable, type Cell, type PriceRow } from "@/lib/wholesale-import";

type Row = { id: number; name: string; articleCode: string | null; price: number; wholesalePrice: number | null; visible: boolean; categoryName: string | null };
type Change = { id: number; name: string; articleCode: string | null; from: number | null; to: number };
type Preview = { changes: Change[]; same: number; unknown: PriceRow[]; missing: Row[] };

export function WholesaleAdmin({ config, link, rows }: { config: WholesaleSettings; link: string; rows: Row[] }) {
  return (
    <>
      <AccessSettings config={config} link={link} />
      <PriceImport rows={rows} />
      <PriceTable rows={rows} />
    </>
  );
}

function AccessSettings({ config, link }: { config: WholesaleSettings; link: string }) {
  const [form, setForm] = useState({ ...config, minAmountText: config.minAmount ? String(config.minAmount) : "" });
  const action = useAction();
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }));
  const share = `Hola! Te paso el acceso a la tienda de INEDITA con precios por mayor: ${link} · Código: ${form.code}`;

  return (
    <Section title="Acceso" aside={<FeedbackText feedback={action.feedback} pending={action.pending} />}>
      <div className="grid max-w-3xl gap-6 sm:grid-cols-2">
        <div className="flex items-center gap-3 sm:col-span-2">
          <Toggle checked={form.enabled} onChange={(v) => set("enabled", v)} label="Acceso mayorista activo" />
          <span className="text-[14px]">{form.enabled ? "Acceso activo" : "Acceso desactivado"}</span>
        </div>
        <Field label="Código de acceso" htmlFor="ws-code" hint="Si lo cambiás, los mayoristas que ya habían entrado tienen que volver a ingresar.">
          <input id="ws-code" className="field uppercase tracking-[0.1em]" value={form.code} onChange={(e) => set("code", e.target.value.toUpperCase())} maxLength={40} />
        </Field>
        <Field label="Descuento extra efectivo/transferencia (%)" htmlFor="ws-cash" hint="0 = los precios por mayor ya son finales.">
          <input id="ws-cash" className="field" inputMode="numeric" value={form.cashDiscountPercent} onChange={(e) => set("cashDiscountPercent", Number(e.target.value.replace(/\D/g, "")) || 0)} />
        </Field>
        <Field label="Compra mínima ($)" htmlFor="ws-min" hint="Vacío = sin mínimo.">
          <input id="ws-min" className="field" inputMode="numeric" placeholder="Sin mínimo" value={form.minAmountText} onChange={(e) => set("minAmountText", e.target.value)} />
        </Field>
        <Field label="Mínimo de prendas" htmlFor="ws-units" hint="0 = sin mínimo.">
          <input id="ws-units" className="field" inputMode="numeric" value={form.minUnits} onChange={(e) => set("minUnits", Number(e.target.value.replace(/\D/g, "")) || 0)} />
        </Field>
        <Field label="Texto para mayoristas" htmlFor="ws-note" hint="Se ve en la bolsa al armar el pedido.">
          <textarea id="ws-note" className="field min-h-16" value={form.note} onChange={(e) => set("note", e.target.value)} maxLength={400} />
        </Field>
      </div>
      <button
        type="button"
        className="btn btn-primary mt-6"
        disabled={action.pending}
        onClick={() =>
          action.run(() =>
            saveWholesaleSettings({
              enabled: form.enabled,
              code: form.code,
              minAmount: parseMoney(form.minAmountText) ?? 0,
              minUnits: form.minUnits,
              cashDiscountPercent: form.cashDiscountPercent,
              note: form.note,
            }),
          )
        }
        data-testid="wholesale-save"
      >
        Guardar
      </button>
      <div className="mt-8 max-w-3xl border border-line p-4 sm:p-5">
        <p className="label text-mute">Link para mayoristas</p>
        <p className="mt-2 break-all text-[15px]">{link}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <CopyButton text={link} label="Copiar link" />
          {form.code ? <CopyButton text={share} label="Copiar mensaje con código" /> : null}
          {form.code ? (
            <a href={`https://wa.me/?text=${encodeURIComponent(share)}`} target="_blank" rel="noopener" className="label border border-ink px-3 py-2 hover:bg-ink hover:text-paper">
              Mandar por WhatsApp
            </a>
          ) : null}
        </div>
      </div>
    </Section>
  );
}

function buildPreview(parsed: PriceRow[], rows: Row[]): Preview {
  const byCode = new Map(rows.filter((r) => r.articleCode).map((r) => [r.articleCode!, r]));
  const byName = new Map(rows.map((r) => [normalizeName(r.name), r]));
  const changes = new Map<number, Change>();
  const unknown: PriceRow[] = [];
  let same = 0;
  for (const p of parsed) {
    // Por número de artículo; si el producto no tiene artículo cargado, por nombre
    const row = (p.code ? byCode.get(p.code) : undefined) ?? (p.name ? byName.get(normalizeName(p.name)) : undefined);
    if (!row) {
      unknown.push(p);
      continue;
    }
    if (row.wholesalePrice === p.price) same++;
    else changes.set(row.id, { id: row.id, name: row.name, articleCode: row.articleCode, from: row.wholesalePrice, to: p.price });
  }
  const touched = new Set(parsed.map((p) => (p.code ? byCode.get(p.code)?.id : undefined) ?? byName.get(normalizeName(p.name))?.id));
  const missing = rows.filter((r) => r.visible && !touched.has(r.id) && !r.wholesalePrice);
  return { changes: [...changes.values()], same, unknown, missing };
}

function PriceImport({ rows }: { rows: Row[] }) {
  const router = useRouter();
  const [preview, setPreview] = useState<Preview | null>(null);
  const [source, setSource] = useState<string>("");
  const [sheetLink, setSheetLink] = useState("");
  const [paste, setPaste] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [reading, setReading] = useState(false);
  const action = useAction();

  const load = (table: Cell[][], label: string) => {
    const parsed = parsePriceTable(table);
    if (parsed.length === 0) {
      setError("No encontramos precios en la planilla. Tiene que tener una columna con el número de artículo (o el nombre) y otra con el precio.");
      setPreview(null);
      return;
    }
    setError(null);
    setSource(`${label}: ${parsed.length} filas con precio`);
    setPreview(buildPreview(parsed, rows));
  };

  const readFile = async (file: File | undefined) => {
    if (!file) return;
    setReading(true);
    try {
      if (/\.xlsx$/i.test(file.name)) {
        const { readSheet } = await import("read-excel-file/universal");
        load((await readSheet(file)) as Cell[][], file.name);
      } else if (/\.(csv|txt|tsv)$/i.test(file.name)) {
        load(csvToRows(await file.text()), file.name);
      } else setError("Subí un archivo .xlsx (Excel) o .csv. Si es .xls viejo, guardalo como .xlsx.");
    } catch {
      setError("No se pudo leer el archivo. Probá guardarlo de nuevo como .xlsx o .csv.");
    } finally {
      setReading(false);
    }
  };

  const readSheetLink = async () => {
    setReading(true);
    setError(null);
    const res = await fetchSheetCsv(sheetLink);
    setReading(false);
    if (!res.ok) return setError(res.error);
    load(csvToRows(res.csv), "Google Sheets");
  };

  return (
    <Section title="Importar precios por mayor" aside={<FeedbackText feedback={action.feedback} pending={action.pending} />}>
      <p className="max-w-2xl text-[14px] leading-relaxed">
        Subí la planilla de precios por mayor (Excel o CSV) o pegá el link de Google Sheets. Se cruza por <strong>número de artículo</strong> (y por nombre si el producto no tiene artículo). Antes de aplicar ves todos los cambios.
      </p>
      <div className="mt-5 grid max-w-3xl gap-4 lg:grid-cols-2">
        <div className="border border-line p-4">
          <p className="label text-mute">Archivo</p>
          <label className="btn btn-secondary mt-3 cursor-pointer">
            {reading ? "Leyendo…" : "Elegir Excel o CSV"}
            <input
              type="file"
              accept=".xlsx,.csv,.tsv,.txt"
              className="sr-only"
              onChange={(e) => {
                void readFile(e.target.files?.[0]);
                e.target.value = "";
              }}
              data-testid="wholesale-file"
            />
          </label>
        </div>
        <div className="border border-line p-4">
          <p className="label text-mute">Google Sheets</p>
          <div className="mt-3 flex gap-2">
            <input className="field flex-1" placeholder="https://docs.google.com/spreadsheets/d/…" value={sheetLink} onChange={(e) => setSheetLink(e.target.value)} />
            <button type="button" className="btn btn-secondary" disabled={!sheetLink || reading} onClick={() => void readSheetLink()}>
              Leer
            </button>
          </div>
        </div>
        <details className="border border-line p-4 lg:col-span-2">
          <summary className="label cursor-pointer text-mute">O pegar desde Excel (copiar las columnas artículo, nombre y precio)</summary>
          <textarea className="field mt-3 min-h-28 font-mono text-[12px]" value={paste} onChange={(e) => setPaste(e.target.value)} placeholder={"39601\tRemera Niro\t$25,300"} />
          <button type="button" className="btn btn-secondary mt-3" disabled={!paste.trim()} onClick={() => load(csvToRows(paste), "Texto pegado")}>
            Ver cambios
          </button>
        </details>
      </div>
      {error ? (
        <p className="mt-4 max-w-3xl border border-ink p-3 text-[13px]" role="alert">
          {error}
        </p>
      ) : null}

      {preview ? (
        <div className="mt-6 max-w-3xl border border-ink p-4 sm:p-5" data-testid="wholesale-preview">
          <p className="text-[14px]">
            {source} · <strong>{preview.changes.length}</strong> cambios · {preview.same} sin cambios
            {preview.unknown.length ? ` · ${preview.unknown.length} que no están en la tienda` : ""}
          </p>
          {preview.changes.length ? (
            <div className="mt-4 max-h-80 overflow-y-auto">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="label text-left text-mute">
                    <th className="py-2 pr-3 font-normal">Producto</th>
                    <th className="py-2 pr-3 text-right font-normal">Antes</th>
                    <th className="py-2 text-right font-normal">Nuevo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {preview.changes.map((c) => (
                    <tr key={c.id}>
                      <td className="py-2 pr-3">
                        {c.name} <span className="text-mute">{c.articleCode ? `· ${c.articleCode}` : ""}</span>
                      </td>
                      <td className="py-2 pr-3 text-right tabular-nums text-mute">{c.from ? formatPrice(c.from) : "—"}</td>
                      <td className="py-2 text-right tabular-nums">{formatPrice(c.to)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
          {preview.unknown.length ? (
            <details className="mt-3 text-[13px]">
              <summary className="cursor-pointer text-mute">Filas sin producto en la tienda ({preview.unknown.length})</summary>
              <ul className="mt-2 list-disc pl-5 text-mute">
                {preview.unknown.slice(0, 80).map((u, i) => (
                  <li key={i}>
                    {u.code ?? "sin artículo"} · {u.name} · {formatPrice(u.price)}
                  </li>
                ))}
              </ul>
            </details>
          ) : null}
          {preview.missing.length ? (
            <details className="mt-3 text-[13px]">
              <summary className="cursor-pointer text-mute">Productos publicados que siguen sin precio por mayor ({preview.missing.length})</summary>
              <ul className="mt-2 list-disc pl-5 text-mute">
                {preview.missing.slice(0, 80).map((m) => (
                  <li key={m.id}>
                    {m.articleCode ?? "—"} · {m.name}
                  </li>
                ))}
              </ul>
            </details>
          ) : null}
          <div className="mt-5 flex flex-wrap gap-3">
            <button
              type="button"
              className="btn btn-primary"
              disabled={action.pending || preview.changes.length === 0}
              onClick={() =>
                action.run(
                  () => saveWholesalePrices(preview.changes.map((c) => ({ id: c.id, wholesalePrice: c.to }))),
                  () => {
                    setPreview(null);
                    router.refresh();
                  },
                )
              }
              data-testid="wholesale-apply"
            >
              Aplicar {preview.changes.length} cambios
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => setPreview(null)}>
              Cancelar
            </button>
          </div>
        </div>
      ) : null}
    </Section>
  );
}

function PriceTable({ rows }: { rows: Row[] }) {
  const router = useRouter();
  const [edits, setEdits] = useState<Record<number, string>>({});
  const [query, setQuery] = useState("");
  const action = useAction();
  const withPrice = rows.filter((r) => r.wholesalePrice).length;
  const shown = useMemo(() => {
    const q = normalizeName(query);
    return q ? rows.filter((r) => normalizeName(`${r.name} ${r.articleCode ?? ""}`).includes(q)) : rows;
  }, [rows, query]);
  const pending = Object.entries(edits)
    .map(([id, value]) => ({ id: Number(id), wholesalePrice: value.trim() ? parseMoney(value) : null }))
    .filter((c) => c.wholesalePrice === null || (c.wholesalePrice ?? 0) > 0);

  return (
    <Section title={`Precios por mayor (${withPrice} de ${rows.length})`} aside={<FeedbackText feedback={action.feedback} pending={action.pending} />}>
      <div className="flex flex-wrap items-center gap-3">
        <input className="field max-w-xs" placeholder="Buscar producto o artículo" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Buscar" />
        {pending.length ? (
          <button
            type="button"
            className="btn btn-primary"
            disabled={action.pending}
            onClick={() =>
              action.run(
                () => saveWholesalePrices(pending),
                () => {
                  setEdits({});
                  router.refresh();
                },
              )
            }
          >
            Guardar {pending.length} {pending.length === 1 ? "cambio" : "cambios"}
          </button>
        ) : null}
      </div>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[560px] text-[13px]">
          <thead>
            <tr className="label border-b border-line text-left text-mute">
              <th className="py-2 pr-3 font-normal">Producto</th>
              <th className="py-2 pr-3 text-right font-normal">Tienda</th>
              <th className="py-2 pr-3 text-right font-normal">Por mayor</th>
              <th className="py-2 text-right font-normal">Diferencia</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {shown.map((r) => {
              const value = edits[r.id] ?? (r.wholesalePrice ? String(r.wholesalePrice) : "");
              const current = parseMoney(value);
              return (
                <tr key={r.id} className={r.visible ? "" : "text-mute"}>
                  <td className="py-2 pr-3">
                    {r.name} <span className="text-mute">{r.articleCode ? `· ${r.articleCode}` : ""}</span>
                  </td>
                  <td className="py-2 pr-3 text-right tabular-nums">{formatPrice(r.price)}</td>
                  <td className="py-1 pr-3 text-right">
                    <input
                      className="w-28 border-b border-line bg-transparent py-1 text-right tabular-nums focus:border-ink focus:outline-none"
                      inputMode="numeric"
                      value={value}
                      placeholder="—"
                      onChange={(e) => setEdits((m) => ({ ...m, [r.id]: e.target.value }))}
                      aria-label={`Precio por mayor de ${r.name}`}
                    />
                  </td>
                  <td className="py-2 text-right tabular-nums text-mute">{current ? `${Math.round((1 - current / r.price) * 100)}% menos` : ""}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Section>
  );
}
