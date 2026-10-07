"use client";

import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import { Section } from "@/components/admin/ui";
import { uploadImage } from "@/components/admin/upload";

// [nombre del archivo en minúsculas, artículo, orden, id de Drive, color, tipo]
export type PlanEntry = [string, string, number, string, string, string];

type Job = { file: File; productId: number; article: string; fields: Record<string, string>; label: string };

const CODE_RE = /(?<!\d)(3[5-9]\d{3})(?!\d)/g;

/**
 * Subida masiva: se eligen todas las fotos (o la carpeta bajada de Drive) y cada una va al producto
 * cuyo número de artículo figura en el nombre del archivo, en el orden del cruce (principal, hover, resto).
 */
export function BulkUploader({ plan, products, importedDriveIds }: { plan: PlanEntry[]; products: { id: number; articleCode: string | null }[]; importedDriveIds: string[] }) {
  const router = useRouter();
  const [jobs, setJobs] = useState<Job[] | null>(null);
  const [ignored, setIgnored] = useState<string[]>([]);
  const [progress, setProgress] = useState<{ done: number; total: number; uploaded: number; skipped: number } | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [finished, setFinished] = useState<string | null>(null);
  const stopRef = useRef(false);

  const byTitle = useMemo(() => {
    const map = new Map<string, PlanEntry[]>();
    for (const e of plan) map.set(e[0], [...(map.get(e[0]) ?? []), e]);
    return map;
  }, [plan]);
  const productByArticle = useMemo(() => new Map(products.filter((p) => p.articleCode).map((p) => [p.articleCode!, p.id])), [products]);
  const imported = useMemo(() => new Set(importedDriveIds), [importedDriveIds]);

  function prepare(list: FileList | null) {
    if (!list?.length) return;
    const files = [...list].filter((f) => /\.(jpe?g|png|webp|heic|heif|avif)$/i.test(f.name) || f.type.startsWith("image/"));
    const next: Job[] = [];
    const skippedNames: string[] = [];
    for (const file of files) {
      const entries = byTitle.get(file.name.toLowerCase());
      if (entries?.length) {
        for (const [, article, index, driveId, color, kind] of entries) {
          const productId = productByArticle.get(article);
          if (!productId || imported.has(driveId)) continue;
          next.push({ file, productId, article, label: `${article} · ${file.name}`, fields: { kind: "product", productId: String(productId), driveFileId: driveId, sortOrder: String(index), photoKind: kind, ...(color ? { colorName: color } : {}) } });
        }
        continue;
      }
      // Fotos nuevas (otra temporada): se asignan por el número de artículo del nombre
      const codes = [...new Set([...file.name.matchAll(CODE_RE)].map((m) => m[1]))].filter((c) => productByArticle.has(c));
      if (codes.length === 0) {
        skippedNames.push(file.name);
        continue;
      }
      for (const article of codes) {
        next.push({ file, productId: productByArticle.get(article)!, article, label: `${article} · ${file.name}`, fields: { kind: "product", productId: String(productByArticle.get(article)), dedupe: "1", photoKind: /limpia|set con/i.test(file.name) ? "campana" : "catalogo" } });
      }
    }
    // Primero las principales de cada producto, así la tienda se completa rápido
    next.sort((a, b) => Number(a.fields.sortOrder ?? 99) - Number(b.fields.sortOrder ?? 99));
    setJobs(next);
    setIgnored(skippedNames);
    setErrors([]);
    setFinished(null);
  }

  async function run() {
    if (!jobs?.length) return;
    stopRef.current = false;
    const queue = [...jobs];
    const state = { done: 0, total: queue.length, uploaded: 0, skipped: 0 };
    setProgress({ ...state });
    const worker = async () => {
      while (queue.length && !stopRef.current) {
        const job = queue.shift()!;
        try {
          const res = await uploadImage(job.file, job.fields);
          if (res.skipped) state.skipped++;
          else state.uploaded++;
        } catch (e) {
          setErrors((list) => [...list, `${job.label}: ${e instanceof Error ? e.message : "error"}`]);
        }
        state.done++;
        setProgress({ ...state });
      }
    };
    await Promise.all([worker(), worker(), worker()]);
    setProgress(null);
    setJobs(null);
    setFinished(`${stopRef.current ? "Detenido" : "Listo"}: ${state.uploaded} fotos subidas${state.skipped ? `, ${state.skipped} ya estaban` : ""}.`);
    router.refresh();
  }

  const pct = progress ? Math.round((progress.done / Math.max(1, progress.total)) * 100) : 0;
  const productsInJobs = jobs ? new Set(jobs.map((j) => j.productId)).size : 0;

  return (
    <Section title="Subida masiva desde la compu">
      <p className="max-w-2xl text-[14px] leading-relaxed">
        Descargá la carpeta de Drive (queda un .zip: descomprimilo) y elegí todas las fotos juntas. Cada foto va al producto cuyo número de artículo figura en el nombre del archivo, en el orden correcto. Las que ya están cargadas se saltean.
      </p>
      <div className="mt-5 flex flex-wrap items-center gap-3">
        <label className="btn btn-secondary cursor-pointer">
          Elegir fotos
          <input type="file" accept="image/*" multiple className="sr-only" disabled={Boolean(progress)} onChange={(e) => {
              prepare(e.target.files);
              e.target.value = "";
            }} data-testid="bulk-files" />
        </label>
        <label className="btn btn-secondary cursor-pointer">
          Elegir carpeta
          <input
            type="file"
            multiple
            className="sr-only"
            disabled={Boolean(progress)}
            onChange={(e) => {
              prepare(e.target.files);
              e.target.value = "";
            }}
            {...({ webkitdirectory: "", directory: "" } as Record<string, string>)}
          />
        </label>
      </div>

      {jobs && !progress ? (
        <div className="mt-5 border border-ink p-4 sm:p-5">
          <p className="text-[14px]">
            <strong>{jobs.length}</strong> fotos para {productsInJobs} productos
            {ignored.length ? <span className="text-mute"> · {ignored.length} archivos sin número de artículo conocido (se ignoran)</span> : null}
          </p>
          {jobs.length ? (
            <button type="button" className="btn btn-primary mt-4" onClick={run} data-testid="bulk-start">
              Subir {jobs.length} fotos
            </button>
          ) : (
            <p className="mt-2 text-[13px] text-mute">No hay fotos nuevas para subir.</p>
          )}
        </div>
      ) : null}

      {progress ? (
        <div className="mt-5 max-w-xl" role="status" aria-live="polite">
          <div className="h-[3px] w-full bg-line">
            <div className="h-full bg-ink transition-all duration-500" style={{ width: `${pct}%` }} />
          </div>
          <p className="mt-2 text-[13px] tabular-nums text-mute">
            {progress.done} de {progress.total} ({pct}%) · dejá esta pestaña abierta
          </p>
          <button type="button" className="btn btn-secondary mt-3" onClick={() => (stopRef.current = true)}>
            Detener
          </button>
        </div>
      ) : null}
      {finished ? <p className="mt-4 text-[14px]">{finished}</p> : null}
      {errors.length ? (
        <details className="mt-3 text-[13px]" open={errors.length < 6}>
          <summary className="cursor-pointer font-medium">{errors.length} fotos con error (se pueden volver a subir)</summary>
          <ul className="mt-2 list-disc pl-5 text-mute">
            {errors.slice(0, 100).map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
        </details>
      ) : null}
    </Section>
  );
}
