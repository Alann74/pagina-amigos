"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { CloseIcon } from "@/components/icons";

type GalleryImage = { url: string; alt: string };

function ZoomableImage({ image, priority, onOpen }: { image: GalleryImage; priority: boolean; onOpen: () => void }) {
  const [origin, setOrigin] = useState("50% 50%");
  const [zoom, setZoom] = useState(false);
  return (
    <button
      type="button"
      className="relative block aspect-[3/4] w-full cursor-zoom-in overflow-hidden bg-soft"
      onMouseEnter={() => setZoom(true)}
      onMouseLeave={() => setZoom(false)}
      onMouseMove={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        setOrigin(`${((e.clientX - r.left) / r.width) * 100}% ${((e.clientY - r.top) / r.height) * 100}%`);
      }}
      onClick={onOpen}
      aria-label={`Ampliar imagen: ${image.alt}`}
    >
      <Image
        src={image.url}
        alt={image.alt}
        fill
        priority={priority}
        sizes="(min-width: 1024px) 30vw, 100vw"
        className="object-cover transition-transform duration-300 ease-out"
        style={{ transformOrigin: origin, transform: zoom ? "scale(1.9)" : "scale(1)" }}
      />
    </button>
  );
}

export function Gallery({ images, name }: { images: GalleryImage[]; name: string }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const [lightbox, setLightbox] = useState<number | null>(null);
  const [shownImages, setShownImages] = useState(images);

  // Al cambiar de color cambian las fotos: se vuelve a la primera
  if (shownImages !== images) {
    setShownImages(images);
    setActive(0);
  }

  useEffect(() => {
    trackRef.current?.scrollTo({ left: 0 });
  }, [images]);

  useEffect(() => {
    if (lightbox === null) return;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLightbox(null);
      if (e.key === "ArrowRight") setLightbox((i) => (i === null ? i : Math.min(images.length - 1, i + 1)));
      if (e.key === "ArrowLeft") setLightbox((i) => (i === null ? i : Math.max(0, i - 1)));
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      document.removeEventListener("keydown", onKey);
    };
  }, [lightbox, images.length]);

  if (images.length === 0) {
    return (
      <div className="flex aspect-[3/4] items-center justify-center bg-soft">
        <span className="pl-[0.32em] text-[11px] tracking-[0.32em] text-faint">INEDITA</span>
      </div>
    );
  }

  return (
    <>
      {/* Mobile: carrusel con swipe nativo (scroll-snap) */}
      <div className="relative lg:hidden">
        <div
          ref={trackRef}
          className="scrollbar-none flex snap-x snap-mandatory overflow-x-auto"
          onScroll={(e) => {
            const el = e.currentTarget;
            setActive(Math.round(el.scrollLeft / el.clientWidth));
          }}
          aria-label={`Fotos de ${name}`}
          role="region"
          data-testid="gallery-track"
        >
          {images.map((img, i) => (
            <div key={img.url} className="relative aspect-[3/4] w-full shrink-0 snap-center bg-soft">
              <Image src={img.url} alt={img.alt} fill priority={i === 0} sizes="(min-width: 1024px) 1px, 100vw" className="object-cover" />
            </div>
          ))}
        </div>
        {images.length > 1 ? (
          <div className="pointer-events-none absolute inset-x-0 bottom-4 flex justify-center gap-1.5" aria-hidden>
            {images.map((img, i) => (
              <span key={img.url} className={`h-[2px] transition-all duration-300 ${i === active ? "w-6 bg-ink" : "w-3 bg-ink/25"}`} />
            ))}
          </div>
        ) : null}
        <p className="label absolute right-3 top-3 bg-paper/80 px-1.5 py-0.5 tabular-nums" aria-live="polite">
          {active + 1}/{images.length}
        </p>
      </div>

      {/* Desktop: grilla de 2 columnas con zoom al pasar el mouse */}
      <div className="hidden grid-cols-2 gap-1 lg:grid">
        {images.map((img, i) => (
          <ZoomableImage key={img.url} image={img} priority={i < 2} onOpen={() => setLightbox(i)} />
        ))}
      </div>

      {lightbox !== null ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-paper animate-fade-in" role="dialog" aria-modal="true" aria-label="Imagen ampliada">
          <button type="button" className="absolute right-4 top-4 z-10 flex h-11 w-11 items-center justify-center" onClick={() => setLightbox(null)} aria-label="Cerrar">
            <CloseIcon />
          </button>
          <div className="relative h-full w-full max-w-[1200px]">
            <Image src={images[lightbox].url} alt={images[lightbox].alt} fill sizes="100vw" className="object-contain" />
          </div>
          {images.length > 1 ? (
            <div className="absolute bottom-6 flex gap-6">
              <button type="button" className="nav-link" onClick={() => setLightbox(Math.max(0, lightbox - 1))} disabled={lightbox === 0}>
                Anterior
              </button>
              <span className="label tabular-nums text-mute">
                {lightbox + 1}/{images.length}
              </span>
              <button type="button" className="nav-link" onClick={() => setLightbox(Math.min(images.length - 1, lightbox + 1))} disabled={lightbox === images.length - 1}>
                Siguiente
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
    </>
  );
}
