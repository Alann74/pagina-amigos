"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { FeedbackText, Section, useAction } from "@/components/admin/ui";
import type { PhotoStatus } from "@/lib/drive-import";

type Look = { driveId: string; title: string; codes: string[] };

async function post(body: unknown) {
  const res = await fetch("/api/admin/drive-import", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? `Error ${res.status}`);
  return data;
}

export function DriveImporter({ status, looks }: { status: PhotoStatus[]; looks: Look[] }) {
  const router = useRouter();
  const [progress, setProgress] = useState<{ done: number; total: number; current: string } | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [finished, setFinished] = useState<string | null>(null);
  const stopRef = useRef(false);
  const lookAction = useAction();
  const [allLooks, setAllLooks] = useState(false);

  const pendingArticles = status.filter((s) => s.productId && s.imported < s.total);
  const pendingFiles = pendingArticles.reduce((a, s) => a + s.total - s.imported, 0);
  const totalFiles = status.reduce((a, s) => a + s.total, 0);
  const importedFiles = status.reduce((a, s) => a + s.imported, 0);
  const complete = status.filter((s) => s.productId && s.imported >= s.total).length;

  async function runImport() {
    stopRef.current = false;
    setErrors([]);
    setFinished(null);
    const queue = [...pendingArticles];
    let done = 0;
    const total = pendingFiles;
    setProgress({ done, total, current: "" });
    const worker = async () => {
      while (queue.length && !stopRef.current) {
        const item = queue.shift()!;
        // Cada llamada procesa unas pocas fotos; se repite hasta terminar el artículo
        for (let round = 0; round < 20 && !stopRef.current; round++) {
          setProgress({ done, total, current: `${item.article} · ${item.name ?? ""}` });
          try {
            const r = await post({ action: "article", article: item.article });
            done += r.imported + (r.errors?.length ?? 0);
            if (r.errors?.length) setErrors((e) => [...e, ...r.errors]);
            setProgress({ done, total, current: `${item.article} · ${item.name ?? ""}` });
            if (!r.remaining || r.imported === 0) break;
          } catch (e) {
            setErrors((list) => [...list, `${item.article}: ${e instanceof Error ? e.message : "error"}`]);
            break;
          }
        }
      }
    };
    await Promise.all([worker(), worker()]);
    setProgress(null);
    setFinished(stopRef.current ? "Importación detenida. Podés seguir cuando quieras: continúa donde quedó." : "Importación terminada.");
    router.refresh();
  }

  const pct = progress && progress.total ? Math.round((progress.done / progress.total) * 100) : 0;

  return (
    <>
      <Section title="Importar desde Google Drive">
        <p className="max-w-2xl text-[14px] leading-relaxed">
          Las fotos de la carpeta <strong>Temporada 3 (2027) → FOTOS DE CAPSULAS LIMPIAS</strong> ya están cruzadas con los artículos por el número de 5 dígitos del nombre del archivo. Al importarlas se optimizan (WebP en 3 tamaños, 3:4) y se guardan en
          Vercel Blob: la web no depende de Drive.
        </p>
        <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <div className="border border-line p-4">
            <p className="label text-mute">Fotos a importar</p>
            <p className="mt-2 text-[22px] font-light tabular-nums">{totalFiles}</p>
          </div>
          <div className="border border-line p-4">
            <p className="label text-mute">Importadas</p>
            <p className="mt-2 text-[22px] font-light tabular-nums">{importedFiles}</p>
          </div>
          <div className="border border-line p-4">
            <p className="label text-mute">Pendientes</p>
            <p className="mt-2 text-[22px] font-light tabular-nums">{pendingFiles}</p>
          </div>
          <div className="border border-line p-4">
            <p className="label text-mute">Artículos completos</p>
            <p className="mt-2 text-[22px] font-light tabular-nums">
              {complete} / {status.length}
            </p>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-4">
          {progress ? (
            <button type="button" className="btn btn-secondary" onClick={() => (stopRef.current = true)}>
              Detener
            </button>
          ) : (
            <button type="button" className="btn btn-primary" disabled={pendingFiles === 0} onClick={runImport} data-testid="drive-import">
              {pendingFiles ? `Importar ${pendingFiles} fotos pendientes` : "Todo importado"}
            </button>
          )}
          {finished ? <span className="text-[13px] text-mute">{finished}</span> : null}
        </div>
        {progress ? (
          <div className="mt-5 max-w-xl" role="status" aria-live="polite">
            <div className="h-[3px] w-full bg-line">
              <div className="h-full bg-ink transition-all duration-500" style={{ width: `${pct}%` }} />
            </div>
            <p className="mt-2 text-[13px] tabular-nums text-mute">
              {progress.done} de {progress.total} ({pct}%) · {progress.current}
            </p>
            <p className="mt-1 text-[12px] text-mute">Podés dejar esta pantalla abierta. Tarda unos segundos por foto.</p>
          </div>
        ) : null}
        {errors.length ? (
          <details className="mt-4 text-[13px]" open={errors.length < 6}>
            <summary className="cursor-pointer font-medium">{errors.length} fotos con error (se pueden reintentar)</summary>
            <ul className="mt-2 list-disc pl-5 text-mute">
              {errors.slice(0, 100).map((e, i) => (
                <li key={i}>{e}</li>
              ))}
            </ul>
          </details>
        ) : null}
      </Section>

      {looks.length ? (
        <Section title="Looks y portada" aside={<FeedbackText feedback={lookAction.feedback} pending={lookAction.pending} />}>
          <p className="mb-4 max-w-2xl text-[14px] leading-relaxed text-mute">Fotos de conjuntos (“SET CON …”). Elegí una para el bloque “Comprá el look” de la home (con sus prendas) o para la portada.</p>
          <ul className="divide-y divide-line">
            {(allLooks ? looks : looks.slice(0, 12)).map((l) => (
              <li key={l.driveId} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="truncate text-[14px]">{l.title}</p>
                  <p className="text-[12px] text-mute">Artículos {l.codes.join(" + ")}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {(
                    [
                      ["look", "Comprá el look"],
                      ["hero", "Portada (foto 1)"],
                      ["hero2", "Portada (foto 2)"],
                    ] as const
                  ).map(([target, label]) => (
                    <button
                      key={target}
                      type="button"
                      className="label border border-ink px-3 py-2 hover:bg-ink hover:text-paper disabled:opacity-40"
                      disabled={lookAction.pending}
                      onClick={() =>
                        lookAction.run(async () => {
                          await post({ action: "use", target, driveId: l.driveId, codes: l.codes });
                          return { ok: true, message: target === "look" ? "“Comprá el look” actualizado" : "Portada actualizada" };
                        })
                      }
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </li>
            ))}
          </ul>
          {looks.length > 12 && !allLooks ? (
            <button type="button" className="label mt-4 border border-ink px-3 py-2 hover:bg-ink hover:text-paper" onClick={() => setAllLooks(true)}>
              Ver los {looks.length} looks
            </button>
          ) : null}
        </Section>
      ) : null}
    </>
  );
}
