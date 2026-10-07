"use client";

import { useEffect, useRef, useState } from "react";
import { ProductCard } from "@/components/product/product-card";
import type { SearchEntry } from "@/lib/search";

type Prueba = { nombre: string; ok: boolean; ms: number; detalle?: string };

const WEBP_1PX = "data:image/webp;base64,UklGRiIAAABXRUJQVlA4IBYAAAAwAQCdASoBAAEADsD+JaQAA3AAAAAA";
const WEBP = /-w\d+\.webp$/;

function cargar(src: string, timeout = 15000): Promise<{ ok: boolean; ms: number; w: number; detalle?: string }> {
  return new Promise((resolve) => {
    const t0 = performance.now();
    const img = new Image();
    const timer = window.setTimeout(() => resolve({ ok: false, ms: Math.round(performance.now() - t0), w: 0, detalle: "tardó más de 15 s" }), timeout);
    img.onload = () => {
      window.clearTimeout(timer);
      resolve({ ok: img.naturalWidth > 0, ms: Math.round(performance.now() - t0), w: img.naturalWidth });
    };
    img.onerror = () => {
      window.clearTimeout(timer);
      resolve({ ok: false, ms: Math.round(performance.now() - t0), w: 0, detalle: "no cargó" });
    };
    img.src = src;
  });
}

export function PhotoDiagnostic({ sample, heroUrl }: { sample: SearchEntry[]; heroUrl: string | null }) {
  const [pruebas, setPruebas] = useState<Prueba[]>([]);
  const [servidor, setServidor] = useState<{ fotos: number; archivos: number; rotas: unknown[]; productosPublicados: number; productosSinFoto: unknown[] } | null>(null);
  const [estado, setEstado] = useState<"probando" | "listo" | "enviado">("probando");
  const gridRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancel = false;
    (async () => {
      const resultados: Prueba[] = [];
      const add = (p: Prueba) => {
        resultados.push(p);
        if (!cancel) setPruebas([...resultados]);
      };
      const webp = await cargar(WEBP_1PX, 5000);
      add({ nombre: "El equipo muestra fotos WebP", ok: webp.ok, ms: webp.ms, detalle: webp.ok ? undefined : "no soporta WebP: se usan las fotos JPG de respaldo" });
      for (const p of sample.filter((s) => s.image).slice(0, 4)) {
        const url = p.image!;
        const w = await cargar(url.replace(WEBP, "-w800.webp"));
        add({ nombre: `${p.name} (WebP)`, ok: w.ok, ms: w.ms, detalle: w.detalle });
        const j = await cargar(url.replace(WEBP, "-share.jpg"));
        add({ nombre: `${p.name} (JPG)`, ok: j.ok, ms: j.ms, detalle: j.detalle });
      }
      if (heroUrl) {
        const h = await cargar(heroUrl);
        add({ nombre: "Foto de portada", ok: h.ok, ms: h.ms, detalle: h.detalle });
      }
      // Las tarjetas reales de la tienda (las mismas que en el catálogo)
      await new Promise((r) => setTimeout(r, 2500));
      const imgs = [...(gridRef.current?.querySelectorAll("img") ?? [])].filter((i) => i.getBoundingClientRect().width > 0);
      const vistas = imgs.filter((i) => i.complete && i.naturalWidth > 0).length;
      add({ nombre: `Tarjetas del catálogo: ${vistas} de ${imgs.length} fotos visibles`, ok: imgs.length > 0 && vistas === imgs.length, ms: 0, detalle: imgs.length ? imgs.filter((i) => !(i.complete && i.naturalWidth > 0)).map((i) => i.currentSrc || i.src).slice(0, 3).join(" ") : "sin tarjetas" });
      if (cancel) return;
      setEstado("listo");

      const nav = navigator as Navigator & { connection?: { effectiveType?: string; saveData?: boolean } };
      const reporte = {
        pagina: location.href,
        navegador: navigator.userAgent,
        pantalla: `${window.innerWidth}x${window.innerHeight} @${window.devicePixelRatio}x`,
        conexion: nav.connection ? `${nav.connection.effectiveType ?? "?"}${nav.connection.saveData ? " ahorro de datos" : ""}` : "?",
        idioma: navigator.language,
        pruebas: resultados,
        tarjetas: imgs.map((i) => ({ src: (i.currentSrc || i.src).slice(-80), visible: i.complete && i.naturalWidth > 0, ancho: i.naturalWidth })),
      };
      await fetch("/api/diagnostico", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(reporte) }).catch(() => null);
      if (!cancel) setEstado("enviado");
      const srv = await fetch("/api/diagnostico", { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null);
      if (!cancel && srv) setServidor(srv);
    })();
    return () => {
      cancel = true;
    };
  }, [sample, heroUrl]);

  const fallas = pruebas.filter((p) => !p.ok);
  return (
    <div className="mx-auto max-w-[900px] px-5 pb-20 pt-10 sm:px-8">
      <p className="label text-mute">INEDITA</p>
      <h1 className="mt-2 text-[24px] font-light">Prueba de fotos</h1>
      <p className="mt-2 text-[14px] text-mute">Probamos cómo se ven las fotos en este equipo. El resultado nos llega solo: no hace falta hacer nada más.</p>

      <div className="mt-6 border border-ink p-4 text-[14px]" role="status" data-testid="diag-estado">
        {estado === "probando" ? "Probando…" : fallas.length ? `Se encontraron ${fallas.length} problemas (abajo el detalle).` : "✓ Todo bien: las fotos cargan en este equipo."}
        {estado === "enviado" ? <span className="text-mute"> · Resultado enviado.</span> : null}
      </div>

      <ul className="mt-6 divide-y divide-line text-[13px]">
        {pruebas.map((p, i) => (
          <li key={i} className="flex items-start justify-between gap-4 py-2">
            <span>
              {p.ok ? "✓" : "✗"} {p.nombre}
              {p.detalle ? <span className="block text-[12px] text-mute">{p.detalle}</span> : null}
            </span>
            {p.ms ? <span className="shrink-0 tabular-nums text-mute">{(p.ms / 1000).toFixed(1)} s</span> : null}
          </li>
        ))}
      </ul>

      {servidor ? (
        <p className="mt-6 text-[13px] text-mute" data-testid="diag-servidor">
          Servidor: {servidor.productosPublicados} productos publicados, {servidor.fotos} fotos revisadas en {servidor.archivos} archivos, {servidor.rotas.length} con problemas, {servidor.productosSinFoto.length} productos sin foto.
        </p>
      ) : null}

      <div ref={gridRef} className="mt-8 grid grid-cols-2 gap-x-1 gap-y-6 sm:grid-cols-3">
        {sample.map((p) => (
          <ProductCard key={p.id} product={p} />
        ))}
      </div>
    </div>
  );
}
