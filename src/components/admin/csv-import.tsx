"use client";

import Papa from "papaparse";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { applyCsvImport, previewCsvImport, type CsvChange } from "@/app/admin/actions";
import { FeedbackText, useAction } from "@/components/admin/ui";
import { formatPrice } from "@/lib/format";

const KIND_LABEL: Record<CsvChange["kind"], string> = { precio: "Precio", nombre: "Nombre", stock: "Stock", visible: "Visible", etiqueta: "Etiqueta" };

export function CsvImport() {
  const router = useRouter();
  const [rows, setRows] = useState<Record<string, string>[] | null>(null);
  const [fileName, setFileName] = useState("");
  const [preview, setPreview] = useState<{ changes: CsvChange[]; unknown: string[] } | null>(null);
  const { pending, feedback, setFeedback, run } = useAction();

  function onFile(file: File | undefined) {
    setPreview(null);
    setRows(null);
    if (!file) return;
    setFileName(file.name);
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => h.trim().toLowerCase().replace(/^﻿/, ""),
      complete: (res) => {
        const fields = res.meta.fields ?? [];
        if (!fields.includes("articulo") && !fields.includes("sku")) {
          setFeedback({ kind: "error", text: "El archivo tiene que tener una columna “articulo” o “sku” (usá el CSV exportado como modelo)." });
          return;
        }
        setRows(res.data);
        run(async () => {
          const r = await previewCsvImport(res.data);
          if (r.ok) setPreview({ changes: r.changes, unknown: r.unknown });
          return r.ok ? { ok: true, message: `${r.changes.length} cambios detectados` } : r;
        });
      },
      error: () => setFeedback({ kind: "error", text: "No se pudo leer el archivo" }),
    });
  }

  const fmt = (c: CsvChange, v: string) => (c.kind === "precio" ? formatPrice(Number(v)) : v || "—");

  return (
    <div>
      <label className="btn btn-secondary cursor-pointer">
        {fileName ? `Elegir otro archivo` : "Elegir archivo CSV"}
        <input type="file" accept=".csv,text/csv" className="sr-only" onChange={(e) => onFile(e.target.files?.[0])} data-testid="csv-file" />
      </label>
      {fileName ? <span className="ml-4 text-[13px] text-mute">{fileName} · {rows?.length ?? 0} filas</span> : null}
      <div className="mt-4">
        <FeedbackText feedback={feedback} pending={pending} />
      </div>

      {preview ? (
        <div className="mt-6 border border-ink p-4 sm:p-6">
          <p className="text-[14px]">
            <strong>{preview.changes.length}</strong> cambios para aplicar
          </p>
          {preview.unknown.length ? (
            <details className="mt-2 text-[13px] text-mute">
              <summary className="cursor-pointer">{preview.unknown.length} filas que no se van a aplicar</summary>
              <ul className="mt-2 list-disc pl-5">
                {preview.unknown.slice(0, 100).map((u) => (
                  <li key={u}>{u}</li>
                ))}
              </ul>
            </details>
          ) : null}
          {preview.changes.length ? (
            <ul className="mt-4 max-h-96 divide-y divide-line overflow-y-auto text-[13px]">
              {preview.changes.slice(0, 500).map((c, i) => (
                <li key={`${c.kind}-${c.key}-${i}`} className="flex justify-between gap-4 py-1.5">
                  <span className="min-w-0 truncate">
                    <span className="label mr-2 text-mute">{KIND_LABEL[c.kind]}</span>
                    {c.label}
                  </span>
                  <span className="shrink-0 tabular-nums">
                    <span className="text-mute">{fmt(c, c.from)}</span> → <strong>{fmt(c, c.to)}</strong>
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-[13px] text-mute">No hay diferencias con lo que está cargado.</p>
          )}
          {preview.changes.length ? (
            <div className="mt-5 flex flex-wrap gap-3">
              <button
                type="button"
                className="btn btn-primary"
                disabled={pending || !rows}
                onClick={() =>
                  rows &&
                  run(
                    () => applyCsvImport(rows),
                    () => {
                      setPreview(null);
                      setRows(null);
                      setFileName("");
                      router.refresh();
                    },
                  )
                }
              >
                Aplicar {preview.changes.length} cambios
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => setPreview(null)}>
                Cancelar
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
