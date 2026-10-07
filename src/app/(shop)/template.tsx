import { ViewTransition } from "react";

// Transición entre páginas: la anterior se desvanece y la nueva sube apenas (el encabezado queda quieto).
// Los cambios dentro de la misma página (filtros, orden) no se animan. Ver los estilos en globals.css.
export default function ShopTemplate({ children }: { children: React.ReactNode }) {
  return (
    <ViewTransition enter="pagina" exit="pagina" update="none" default="none">
      {children}
    </ViewTransition>
  );
}
