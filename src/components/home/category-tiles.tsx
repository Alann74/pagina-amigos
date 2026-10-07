import Image from "next/image";
import Link from "next/link";

export type Tile = { slug: string; name: string; image: string | null };

export function CategoryTiles({ tiles }: { tiles: Tile[] }) {
  if (tiles.length === 0) return null;
  return (
    <ul className="scrollbar-none flex snap-x snap-mandatory scroll-px-4 gap-2 overflow-x-auto px-4 sm:scroll-px-8 sm:gap-3 sm:px-8 lg:grid lg:grid-cols-6 lg:overflow-visible lg:px-8" aria-label="Categorías destacadas">
      {tiles.map((t) => (
        <li key={t.slug} className="w-[42vw] shrink-0 snap-start sm:w-[28vw] lg:w-auto">
          <Link href={`/categoria/${t.slug}`} className="group block">
            <div className="relative aspect-[3/4] overflow-hidden bg-soft">
              {t.image ? (
                <Image src={t.image} alt="" fill sizes="(min-width: 1024px) 16vw, 44vw" className="object-cover transition-transform duration-700 group-hover:scale-[1.03]" />
              ) : null}
            </div>
            <p className="nav-link mt-3 flex items-center justify-between">
              {t.name}
              <span aria-hidden className="translate-x-0 transition-transform duration-300 group-hover:translate-x-1">→</span>
            </p>
          </Link>
        </li>
      ))}
    </ul>
  );
}
