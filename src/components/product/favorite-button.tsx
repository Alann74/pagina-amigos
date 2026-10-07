"use client";

import { HeartIcon } from "@/components/icons";
import { useHydrated } from "@/lib/use-hydrated";
import { useFavorites, type FavoriteItem } from "@/stores/favorites";

export function FavoriteButton({ item, className = "", size = 18, withLabel = false }: { item: FavoriteItem; className?: string; size?: number; withLabel?: boolean }) {
  const hydrated = useHydrated();
  const active = useFavorites((s) => s.items.some((i) => i.productId === item.productId));
  const toggle = useFavorites((s) => s.toggle);
  const on = hydrated && active;
  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        toggle(item);
      }}
      aria-pressed={on}
      aria-label={on ? `Quitar ${item.name} de favoritos` : `Agregar ${item.name} a favoritos`}
      className={`flex items-center justify-center gap-2 ${className}`}
      data-testid="favorite-button"
    >
      <HeartIcon size={size} filled={on} className={on ? "animate-[fade-in_200ms_ease-out]" : ""} />
      {withLabel ? <span className="nav-link">{on ? "En favoritos" : "Favorito"}</span> : null}
    </button>
  );
}
