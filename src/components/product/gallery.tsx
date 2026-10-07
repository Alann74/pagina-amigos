"use client";

import Image from "@/components/safe-image";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, CloseIcon } from "@/components/icons";

type GalleryImage = { url: string; alt: string };

// Galería de la ficha:
//  · celular: carrusel a pantalla completa (deslizar), miniaturas abajo y toque para ampliar
//  · compu: miniaturas a la izquierda, foto grande que entra entera en la pantalla, zoom al pasar el mouse y flechas
//  · ampliada: pantalla completa con zoom (pellizcar, doble toque o clic) y deslizar entre fotos
// Las fotos son 3:4 (así se procesan al subirlas): se muestran enteras, sin deformar ni recortar.

const Chevron = ({ dir }: { dir: "left" | "right" }) => <ChevronDown size={18} className={dir === "left" ? "rotate-90" : "-rotate-90"} />;

function Thumbs({ images, active, onSelect, vertical = false }: { images: GalleryImage[]; active: number; onSelect: (i: number) => void; vertical?: boolean }) {
  const listRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = listRef.current?.children[active] as HTMLElement | undefined;
    el?.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "smooth" });
  }, [active]);
  if (images.length < 2) return null;
  return (
    <div
      ref={listRef}
      className={vertical ? "scrollbar-none flex max-h-[calc(100svh-8rem)] flex-col gap-2 overflow-y-auto" : "scrollbar-none flex gap-1.5 overflow-x-auto px-4 sm:px-8"}
      role="tablist"
      aria-label="Miniaturas"
    >
      {images.map((img, i) => (
        <button
          key={img.url}
          type="button"
          role="tab"
          aria-selected={i === active}
          aria-label={`Foto ${i + 1} de ${images.length}`}
          onClick={() => onSelect(i)}
          className={`relative aspect-[3/4] shrink-0 overflow-hidden bg-soft transition-opacity ${vertical ? "w-[68px]" : "w-[52px]"} ${
            i === active ? "opacity-100 outline outline-1 outline-offset-[-1px] outline-ink" : "opacity-55 hover:opacity-100"
          }`}
          data-testid="gallery-thumb"
        >
          <Image src={img.url} alt="" fill sizes="80px" className="object-cover" />
        </button>
      ))}
    </div>
  );
}

/** Zoom con pellizco, doble toque/clic y arrastre. Sin zoom, deja pasar el deslizamiento horizontal. */
function ZoomPane({ image, onZoomChange, priority }: { image: GalleryImage; onZoomChange: (zoomed: boolean) => void; priority?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const [view, setView] = useState({ scale: 1, x: 0, y: 0 });
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<{ dist: number; scale: number; moved: boolean; lastTap: number }>({ dist: 0, scale: 1, moved: false, lastTap: 0 });

  const clamp = useCallback((scale: number, x: number, y: number) => {
    const el = ref.current;
    if (!el || scale <= 1) return { scale: 1, x: 0, y: 0 };
    const maxX = ((scale - 1) * el.clientWidth) / 2;
    const maxY = ((scale - 1) * el.clientHeight) / 2;
    return { scale, x: Math.max(-maxX, Math.min(maxX, x)), y: Math.max(-maxY, Math.min(maxY, y)) };
  }, []);

  const apply = useCallback(
    (next: { scale: number; x: number; y: number }) => {
      const v = clamp(next.scale, next.x, next.y);
      setView(v);
      onZoomChange(v.scale > 1);
    },
    [clamp, onZoomChange],
  );

  const zoomAt = (clientX: number, clientY: number) => {
    const el = ref.current;
    if (!el) return;
    if (view.scale > 1) return apply({ scale: 1, x: 0, y: 0 });
    const r = el.getBoundingClientRect();
    const scale = 2.5;
    // El punto tocado queda bajo el dedo
    apply({ scale, x: (r.width / 2 - (clientX - r.left)) * (scale - 1), y: (r.height / 2 - (clientY - r.top)) * (scale - 1) });
  };

  return (
    <div
      ref={ref}
      className="relative h-full w-full overflow-hidden"
      style={{ touchAction: view.scale > 1 ? "none" : "pan-x" }}
      onPointerDown={(e) => {
        pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
        gesture.current.moved = false;
        if (pointers.current.size === 2) {
          const [a, b] = [...pointers.current.values()];
          gesture.current.dist = Math.hypot(a.x - b.x, a.y - b.y);
          gesture.current.scale = view.scale;
        }
        if (view.scale > 1) (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      }}
      onPointerMove={(e) => {
        const prev = pointers.current.get(e.pointerId);
        if (!prev) return;
        pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (pointers.current.size === 2) {
          const [a, b] = [...pointers.current.values()];
          const dist = Math.hypot(a.x - b.x, a.y - b.y);
          if (gesture.current.dist > 0) apply({ scale: Math.min(4, Math.max(1, (gesture.current.scale * dist) / gesture.current.dist)), x: view.x, y: view.y });
          gesture.current.moved = true;
        } else if (view.scale > 1) {
          const dx = e.clientX - prev.x;
          const dy = e.clientY - prev.y;
          if (Math.abs(dx) + Math.abs(dy) > 2) gesture.current.moved = true;
          apply({ scale: view.scale, x: view.x + dx, y: view.y + dy });
        } else if (Math.abs(e.clientX - prev.x) > 3) gesture.current.moved = true;
      }}
      onPointerUp={(e) => {
        pointers.current.delete(e.pointerId);
        if (gesture.current.moved) return;
        // Doble toque en celular / clic en compu
        const now = Date.now();
        if (e.pointerType === "mouse" || now - gesture.current.lastTap < 300) {
          zoomAt(e.clientX, e.clientY);
          gesture.current.lastTap = 0;
        } else gesture.current.lastTap = now;
      }}
      onPointerCancel={(e) => pointers.current.delete(e.pointerId)}
    >
      <div
        className="absolute inset-0 transition-transform duration-200 ease-out will-change-transform"
        style={{ transform: `translate3d(${view.x}px, ${view.y}px, 0) scale(${view.scale})`, cursor: view.scale > 1 ? "zoom-out" : "zoom-in" }}
      >
        <Image src={image.url} alt={image.alt} fill priority={priority} sizes="(min-width: 1024px) 70vw, 100vw" className="select-none object-contain" draggable={false} />
      </div>
    </div>
  );
}

function Lightbox({ images, start, onClose }: { images: GalleryImage[]; start: number; onClose: (index: number) => void }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(start);
  const [zoomed, setZoomed] = useState(false);
  const [paneKey, setPaneKey] = useState(0);

  const go = useCallback(
    (i: number) => {
      const next = Math.max(0, Math.min(images.length - 1, i));
      const el = trackRef.current;
      setZoomed(false);
      setPaneKey((k) => k + 1); // vuelve a 1x
      setIndex(next);
      el?.scrollTo({ left: next * el.clientWidth, behavior: "smooth" });
    },
    [images.length],
  );

  useEffect(() => {
    const el = trackRef.current;
    if (el) el.scrollLeft = start * el.clientWidth;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [start]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose(index);
      if (e.key === "ArrowRight") go(index + 1);
      if (e.key === "ArrowLeft") go(index - 1);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [index, go, onClose]);

  return createPortal(
    <div className="fixed inset-0 z-[80] flex flex-col bg-paper animate-fade-in" role="dialog" aria-modal="true" aria-label="Fotos ampliadas" data-testid="gallery-lightbox">
      <div className="flex h-14 shrink-0 items-center justify-between px-2 sm:px-4">
        <p className="label px-2 tabular-nums text-mute" aria-live="polite">
          {index + 1} / {images.length}
        </p>
        <p className="label hidden text-mute sm:block">{zoomed ? "Arrastrá para mover · clic para alejar" : "Clic o doble toque para acercar"}</p>
        <button type="button" className="flex h-11 w-11 items-center justify-center" onClick={() => onClose(index)} aria-label="Cerrar">
          <CloseIcon />
        </button>
      </div>
      <div className="relative min-h-0 flex-1">
        <div
          ref={trackRef}
          className={`scrollbar-none flex h-full snap-x snap-mandatory ${zoomed ? "overflow-hidden" : "overflow-x-auto"}`}
          onScroll={(e) => {
            const el = e.currentTarget;
            const i = Math.round(el.scrollLeft / el.clientWidth);
            if (i !== index && !zoomed) setIndex(i);
          }}
        >
          {images.map((img, i) => (
            <div key={img.url} className="h-full w-full shrink-0 snap-center">
              {Math.abs(i - index) <= 1 ? <ZoomPane key={i === index ? paneKey : undefined} image={img} priority={i === start} onZoomChange={i === index ? setZoomed : () => {}} /> : null}
            </div>
          ))}
        </div>
        {images.length > 1 && !zoomed ? (
          <>
            <button type="button" onClick={() => go(index - 1)} disabled={index === 0} className="absolute left-2 top-1/2 hidden h-12 w-12 -translate-y-1/2 items-center justify-center bg-paper/80 disabled:opacity-0 sm:flex" aria-label="Foto anterior">
              <Chevron dir="left" />
            </button>
            <button
              type="button"
              onClick={() => go(index + 1)}
              disabled={index === images.length - 1}
              className="absolute right-2 top-1/2 hidden h-12 w-12 -translate-y-1/2 items-center justify-center bg-paper/80 disabled:opacity-0 sm:flex"
              aria-label="Foto siguiente"
            >
              <Chevron dir="right" />
            </button>
          </>
        ) : null}
      </div>
      <div className="shrink-0 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <div className="flex justify-center">
          <Thumbs images={images} active={index} onSelect={go} />
        </div>
      </div>
    </div>,
    document.body,
  );
}

/** Foto grande de escritorio: zoom al pasar el mouse, clic para ampliar. */
function HoverZoom({ image, priority, onOpen }: { image: GalleryImage; priority: boolean; onOpen: () => void }) {
  const [origin, setOrigin] = useState("50% 50%");
  const [zoom, setZoom] = useState(false);
  return (
    <button
      type="button"
      className="relative block h-full w-full cursor-zoom-in overflow-hidden bg-soft"
      onMouseEnter={() => setZoom(true)}
      onMouseLeave={() => setZoom(false)}
      onMouseMove={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        setOrigin(`${((e.clientX - r.left) / r.width) * 100}% ${((e.clientY - r.top) / r.height) * 100}%`);
      }}
      onClick={onOpen}
      aria-label={`Ampliar: ${image.alt}`}
    >
      <Image
        src={image.url}
        alt={image.alt}
        fill
        priority={priority}
        sizes="(min-width: 1024px) 45vw, 100vw"
        className="object-cover transition-transform duration-300 ease-out"
        style={{ transformOrigin: origin, transform: zoom ? "scale(2)" : "scale(1)" }}
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

  const select = (i: number) => {
    const next = Math.max(0, Math.min(images.length - 1, i));
    setActive(next);
    const el = trackRef.current;
    if (el && el.offsetParent !== null) el.scrollTo({ left: next * el.clientWidth, behavior: "smooth" });
  };

  if (images.length === 0) {
    return (
      <div className="flex aspect-[3/4] items-center justify-center bg-soft">
        <span className="pl-[0.32em] text-[11px] tracking-[0.32em] text-faint">INEDITA</span>
      </div>
    );
  }

  const current = images[Math.min(active, images.length - 1)];

  return (
    <>
      {/* Celular: carrusel con deslizamiento nativo + miniaturas */}
      <div className="lg:hidden">
        <div className="relative">
          <div
            ref={trackRef}
            className="scrollbar-none flex snap-x snap-mandatory overflow-x-auto"
            onScroll={(e) => {
              const el = e.currentTarget;
              const i = Math.round(el.scrollLeft / el.clientWidth);
              if (i !== active) setActive(i);
            }}
            aria-label={`Fotos de ${name}`}
            role="region"
            data-testid="gallery-track"
          >
            {images.map((img, i) => (
              <button
                key={img.url}
                type="button"
                className="relative aspect-[3/4] w-full shrink-0 snap-center bg-soft"
                onClick={() => setLightbox(i)}
                aria-label={`Ampliar foto ${i + 1}: ${img.alt}`}
              >
                <Image src={img.url} alt={img.alt} fill priority={i === 0} sizes="100vw" className="object-cover" />
              </button>
            ))}
          </div>
          <p className="label absolute right-3 top-3 bg-paper/85 px-1.5 py-0.5 tabular-nums" aria-live="polite">
            {active + 1}/{images.length}
          </p>
        </div>
        <div className="mt-2">
          <Thumbs images={images} active={active} onSelect={select} />
        </div>
      </div>

      {/* Compu: miniaturas a la izquierda + foto grande entera en pantalla */}
      <div className="hidden justify-center gap-3 lg:flex lg:items-start">
        <div className="sticky top-24 shrink-0">
          <Thumbs images={images} active={active} onSelect={select} vertical />
        </div>
        <div className="relative min-w-0" style={{ width: images.length > 1 ? "min(calc(100% - 80px), calc((100svh - 8rem) * 0.75))" : "min(100%, calc((100svh - 8rem) * 0.75))" }}>
          <div className="relative aspect-[3/4] w-full" data-testid="gallery-main">
            <HoverZoom key={current.url} image={current} priority={active === 0} onOpen={() => setLightbox(active)} />
            {images.length > 1 ? (
              <>
                <button type="button" onClick={() => select(active - 1)} disabled={active === 0} className="absolute left-3 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center bg-paper/85 transition-opacity disabled:opacity-0" aria-label="Foto anterior">
                  <Chevron dir="left" />
                </button>
                <button
                  type="button"
                  onClick={() => select(active + 1)}
                  disabled={active === images.length - 1}
                  className="absolute right-3 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center bg-paper/85 transition-opacity disabled:opacity-0"
                  aria-label="Foto siguiente"
                >
                  <Chevron dir="right" />
                </button>
                <p className="label absolute bottom-3 right-3 bg-paper/85 px-1.5 py-0.5 tabular-nums">
                  {active + 1}/{images.length}
                </p>
              </>
            ) : null}
          </div>
        </div>
      </div>

      {lightbox !== null ? (
        <Lightbox
          images={images}
          start={lightbox}
          onClose={(i) => {
            setLightbox(null);
            select(i);
          }}
        />
      ) : null}
    </>
  );
}
