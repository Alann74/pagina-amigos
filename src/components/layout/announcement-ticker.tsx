// Barra de anuncios: el texto corre de derecha a izquierda sin cortes (se pausa al pasar el mouse).
// Las partes separadas por "·" se muestran con un separador; con "reducir movimiento" queda quieto.
export function AnnouncementTicker({ text }: { text: string }) {
  const parts = text
    .split(/\s+·\s+/)
    .map((p) => p.trim())
    .filter(Boolean);
  const group = (hidden: boolean) => (
    <span className="flex shrink-0 items-center" aria-hidden={hidden || undefined}>
      {parts.map((p, i) => (
        <span key={i} className="label flex items-center whitespace-nowrap text-[10px] sm:text-2xs">
          <span className="px-6 sm:px-10">{p}</span>
          <span aria-hidden className="opacity-50">
            ·
          </span>
        </span>
      ))}
    </span>
  );
  return (
    <span className="group/ticker relative flex w-full overflow-hidden" data-testid="announcement">
      <span className="sr-only">{parts.join(" · ")}</span>
      {/* Dos copias seguidas: al llegar a la mitad vuelve al principio sin que se note */}
      <span className="flex w-max animate-marquee group-hover/ticker:[animation-play-state:paused]" aria-hidden>
        {group(true)}
        {group(true)}
      </span>
    </span>
  );
}
