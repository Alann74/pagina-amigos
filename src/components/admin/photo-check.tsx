"use client";

import { useRouter } from "next/navigation";
import { runPhotoCheck } from "@/app/admin/actions";
import { FeedbackText, Section, useAction } from "@/components/admin/ui";
import type { PhotoCheck } from "@/lib/photo-check";

type Report = { key: string; fecha: string; navegador: string; pantalla: string; fallas: string[] };

function equipo(ua: string) {
  if (/iPhone|iPad/.test(ua)) return `iPhone/iPad (iOS ${ua.match(/OS (\d+[_\d]*)/)?.[1]?.replace(/_/g, ".") ?? "?"})${/Instagram/.test(ua) ? " · Instagram" : ""}`;
  if (/Android/.test(ua)) return `Android ${ua.match(/Android ([\d.]+)/)?.[1] ?? ""}${/Instagram/.test(ua) ? " · Instagram" : ""}`;
  if (/Mac OS X/.test(ua)) return `Mac (${/Chrome/.test(ua) ? "Chrome" : "Safari"})`;
  if (/Windows/.test(ua)) return "Windows";
  return ua.slice(0, 40);
}

export function PhotoCheckPanel({ last, reports }: { last: PhotoCheck | null; reports: Report[] }) {
  const router = useRouter();
  const action = useAction();
  return (
    <Section title="Revisión de fotos" aside={<FeedbackText feedback={action.feedback} pending={action.pending} />}>
      <p className="max-w-2xl text-[14px] leading-relaxed">
        Revisa desde el servidor que cada foto publicada exista en todos sus tamaños. Para probar un celular o compu donde no se ven las fotos, abrí en ese equipo{" "}
        <a href="/diagnostico" target="_blank" className="link-underline">
          /diagnostico
        </a>{" "}
        y el resultado aparece acá.
      </p>
      <button type="button" className="btn btn-secondary mt-4" disabled={action.pending} onClick={() => action.run(() => runPhotoCheck(), () => router.refresh())} data-testid="photo-check">
        Revisar todas las fotos
      </button>
      {last ? (
        <div className="mt-5 text-[13px]">
          <p>
            Última revisión ({new Date(last.fecha).toLocaleString("es-AR")}): {last.productosPublicados} productos publicados · {last.fotos} fotos · {last.archivos} archivos ·{" "}
            <strong className="font-medium">{last.rotas.length ? `${last.rotas.length} con problemas` : "todo bien"}</strong>
            {last.productosSinFoto.length ? ` · ${last.productosSinFoto.length} productos sin foto` : ""}
          </p>
          {last.rotas.length ? (
            <ul className="mt-2 list-disc pl-5 text-mute">
              {last.rotas.slice(0, 30).map((r, i) => (
                <li key={i}>
                  {r.article} {r.name} · {String(r.estado)} · {r.url.split("/").pop()}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
      {reports.length ? (
        <div className="mt-6">
          <p className="label text-mute">Equipos que hicieron la prueba</p>
          <ul className="mt-2 divide-y divide-line text-[13px]">
            {reports.map((r) => (
              <li key={r.key} className="py-2">
                {new Date(r.fecha).toLocaleString("es-AR")} · {equipo(r.navegador)} · {r.pantalla} ·{" "}
                {r.fallas.length ? <strong className="font-medium">{r.fallas.join(" · ")}</strong> : "todo bien"}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </Section>
  );
}
