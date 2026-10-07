"use client";

import Link from "next/link";
import { useEffect } from "react";

const KEY = "inedita:recover";

/**
 * Pantalla de error en castellano. Si la falla fue al navegar justo cuando la página se estaba
 * actualizando (por ejemplo, después de un cambio en el admin), recarga sola una vez: una carga
 * completa siempre trae la versión nueva.
 */
export function ErrorView({ error, retry, homeHref = "/" }: { error: Error & { digest?: string }; retry: () => void; homeHref?: string }) {
  useEffect(() => {
    console.error(error);
    try {
      const last = Number(sessionStorage.getItem(KEY) ?? 0);
      if (Date.now() - last > 30_000) {
        sessionStorage.setItem(KEY, String(Date.now()));
        window.location.reload();
      }
    } catch {
      // sin sessionStorage (modo privado estricto): se muestra el mensaje con los botones
    }
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-6 py-24 text-center" role="alert">
      <p className="label text-mute">Algo no cargó bien</p>
      <h1 className="mt-4 text-[22px] font-light uppercase tracking-[0.12em]">Probemos de nuevo</h1>
      <p className="mt-4 max-w-sm text-[14px] leading-relaxed text-mute">Puede ser la conexión o que la página se esté actualizando. Tu bolsa y tus favoritos siguen guardados.</p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <button
          type="button"
          className="btn btn-primary min-w-44"
          onClick={() => {
            retry();
            window.location.reload();
          }}
        >
          Reintentar
        </button>
        <Link href={homeHref} className="btn btn-secondary min-w-44">
          Ir al inicio
        </Link>
      </div>
    </div>
  );
}
