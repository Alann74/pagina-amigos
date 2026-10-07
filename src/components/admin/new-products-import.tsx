"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { applyNewProducts, previewNewProducts, type NewProductsPreview } from "@/app/admin/actions";
import { FeedbackText, Section, useAction } from "@/components/admin/ui";
import { formatPrice } from "@/lib/format";
import { parseProductTable } from "@/lib/product-import";
import { csvToRows, type Cell } from "@/lib/wholesale-import";

export function NewProductsImport() {
  const router = useRouter();
  const [preview, setPreview] = useState<NewProductsPreview | null>(null);
  const [withPrices, setWithPrices] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reading, setReading] = useState(false);
  const [paste, setPaste] = useState("");
  const action = useAction();

  const load = async (table: Cell[][]) => {
    const rows = parseProductTable(table);
    if (rows.length === 0) return setError("No encontramos productos. La lista tiene que tener el número de artículo (5 cifras), el nombre y el precio.");
    setError(null);
    const res = await previewNewProducts(rows);
    if (!res.ok) return setError(res.error);
    setPreview(res.preview);
  };

  const readFile = async (file: File | undefined) => {
    if (!file) return;
    setReading(true);
    try {
      if (/\.xlsx$/i.test(file.name)) {
        const { readSheet } = await import("read-excel-file/universal");
        await load((await readSheet(file)) as Cell[][]);
      } else if (/\.(csv|txt|tsv)$/i.test(file.name)) await load(csvToRows(await file.text()));
      else setError("Subí un archivo .xlsx (Excel) o .csv.");
    } catch {
      setError("No se pudo leer el archivo. Probá guardarlo de nuevo como .xlsx o .csv.");
    } finally {
      setReading(false);
    }
  };

  return (
    <>
      <Section title="Lista de precios" aside={<FeedbackText feedback={action.feedback} pending={action.pending} />}>
        <ol className="max-w-2xl list-decimal space-y-1 pl-5 text-[14px] leading-relaxed">
          <li>
            Subí las fotos a Drive (Temporada 3 → CAPSULAS FOTOS SOLAS) con el <strong>número de artículo en el nombre</strong> del archivo, ej. <em>40012 1.jpg</em>.
          </li>
          <li>Subí acá la lista (Excel o CSV): artículo, nombre y precio minorista. Si tiene columnas de categoría, colores o talles, también se usan.</li>
          <li>Los productos nuevos quedan ocultos con la etiqueta NUEVO y se publican cuando se importan sus fotos.</li>
        </ol>
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <label className="btn btn-secondary cursor-pointer">
            {reading ? "Leyendo…" : "Elegir Excel o CSV"}
            <input
              type="file"
              accept=".xlsx,.csv,.tsv,.txt"
              className="sr-only"
              onChange={(e) => {
                void readFile(e.target.files?.[0]);
                e.target.value = "";
              }}
              data-testid="new-products-file"
            />
          </label>
        </div>
        <details className="mt-4 max-w-3xl border border-line p-4">
          <summary className="label cursor-pointer text-mute">O pegar desde Excel</summary>
          <textarea className="field mt-3 min-h-28 font-mono text-[12px]" value={paste} onChange={(e) => setPaste(e.target.value)} placeholder={"ARTICULO\tNOMBRE\tPRECIO\n40012\tRemera Luna\t29900"} />
          <button type="button" className="btn btn-secondary mt-3" disabled={!paste.trim()} onClick={() => void load(csvToRows(paste))}>
            Ver vista previa
          </button>
        </details>
        {error ? (
          <p className="mt-4 max-w-3xl border border-ink p-3 text-[13px]" role="alert">
            {error}
          </p>
        ) : null}
      </Section>

      {preview ? (
        <Section title="Vista previa">
          <p className="text-[14px]">
            <strong>{preview.nuevos.length}</strong> productos nuevos · {preview.precios.length} con precio distinto · {preview.iguales} sin cambios
          </p>
          {preview.nuevos.length ? (
            <div className="mt-4 max-h-96 overflow-auto">
              <table className="w-full min-w-[560px] text-[13px]">
                <thead>
                  <tr className="label border-b border-line text-left text-mute">
                    <th className="py-2 pr-3 font-normal">Art.</th>
                    <th className="py-2 pr-3 font-normal">Producto</th>
                    <th className="py-2 pr-3 font-normal">Categoría</th>
                    <th className="py-2 pr-3 font-normal">Talles · colores</th>
                    <th className="py-2 text-right font-normal">Precio</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {preview.nuevos.map((n) => (
                    <tr key={n.code}>
                      <td className="py-2 pr-3 tabular-nums">{n.code}</td>
                      <td className="py-2 pr-3">{n.name}</td>
                      <td className="py-2 pr-3">{n.category ?? <span className="text-mute">sin categoría</span>}</td>
                      <td className="py-2 pr-3 text-mute">
                        {n.sizes.join(" ")}
                        {n.colors.length ? ` · ${n.colors.join(", ").toLowerCase()}` : ""}
                      </td>
                      <td className="py-2 text-right tabular-nums">{formatPrice(n.price)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
          {preview.precios.length ? (
            <label className="mt-4 flex items-center gap-2 text-[14px]">
              <input type="checkbox" checked={withPrices} onChange={(e) => setWithPrices(e.target.checked)} className="h-4 w-4" />
              Actualizar también {preview.precios.length} precios de productos que ya existen
            </label>
          ) : null}
          <div className="mt-5 flex flex-wrap gap-3">
            <button
              type="button"
              className="btn btn-primary"
              disabled={action.pending || (preview.nuevos.length === 0 && (!withPrices || preview.precios.length === 0))}
              onClick={() =>
                action.run(
                  () => applyNewProducts({ nuevos: preview.nuevos, precios: withPrices ? preview.precios.map((p) => ({ id: p.id, to: p.to })) : [] }),
                  () => {
                    setPreview(null);
                    router.refresh();
                  },
                )
              }
              data-testid="new-products-apply"
            >
              Crear {preview.nuevos.length} productos
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => setPreview(null)}>
              Cancelar
            </button>
          </div>
          <p className="mt-4 text-[13px] text-mute">
            Después: <Link href="/admin/fotos" className="link-underline">Fotos → Importar fotos pendientes</Link> para traer las fotos del Drive.
          </p>
        </Section>
      ) : null}
    </>
  );
}
