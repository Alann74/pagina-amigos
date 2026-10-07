import Image from "next/image";
import Link from "next/link";

export type Tile = { slug: string; name: string; image: string | null };

export function CategoryTiles({ tiles }: { tiles: Tile[] }) {
  if (tiles.length === 0) return null;
  return (
    <ul className="scrollbar-none flex snap-x snap-mandatory gap-1 overflow-x-auto px-1 sm:gap-2 sm:px-2 lg:grid lg:grid-cols-6 lg:overflow-visible lg:px-3" aria-label="Categorías destacadas">
      {tiles.map((t) => (
        <li key={t.slug} className="w-[44vw] shrink-0 snap-start sm:w-[30vw] lg:w-auto">
          <Link href={`/categoria/${t.slug}`} className="group block">
            <div className="relative aspect-[3/4] overflow-hidden bg-soft">
              {t.image ? (
                <Image src={t.image} alt={t.name} fill sizes="(min-width: 1024px) 16vw, 44vw" className="object-cover transition-transform duration-700 group-hover:scale-[1.03]" />
              ) : null}
            </div>
            <p className="nav-link mt-3 px-0.5">{t.name}</p>
          </Link>
        </li>
      ))}
    </ul>
  );
}
