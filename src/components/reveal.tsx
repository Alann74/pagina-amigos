"use client";

import { useEffect } from "react";

/**
 * Aparición suave al bajar: los elementos con data-reveal entran con un fundido y un leve ascenso cuando
 * llegan a la pantalla. Lo que ya se ve al abrir la página no se anima (no demora la primera foto) y con
 * "reducir movimiento" activado no se usa. Un solo observador para toda la tienda.
 */
export function RevealOnScroll() {
  useEffect(() => {
    if (!("IntersectionObserver" in window) || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const root = document.documentElement;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          e.target.classList.add("is-visible");
          io.unobserve(e.target);
        }
      },
      { rootMargin: "0px 0px -6% 0px", threshold: 0.01 },
    );
    const seen = new WeakSet<Element>();
    // Lo que ya está en pantalla cuando aparece (al abrir o al cambiar de página) se muestra directo:
    // de eso se encarga la transición de página
    const scan = () => {
      document.querySelectorAll("[data-reveal]:not(.is-visible)").forEach((el) => {
        if (seen.has(el)) return;
        seen.add(el);
        const r = el.getBoundingClientRect();
        if (r.top < window.innerHeight && r.bottom > 0) el.classList.add("is-visible");
        else io.observe(el);
      });
    };
    scan();
    root.classList.add("reveal");
    // Páginas que se abren sin recargar (y "Ver más" del catálogo): se observan los elementos nuevos
    let frame = 0;
    const mo = new MutationObserver(() => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        scan();
      });
    });
    mo.observe(document.body, { childList: true, subtree: true });
    return () => {
      io.disconnect();
      mo.disconnect();
      cancelAnimationFrame(frame);
      root.classList.remove("reveal");
    };
  }, []);
  return null;
}
