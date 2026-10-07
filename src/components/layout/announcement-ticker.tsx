"use client";

import { useEffect, useState } from "react";

// En mobile, si el anuncio tiene varias partes separadas por "·", se muestran de a una.
export function AnnouncementTicker({ text }: { text: string }) {
  const parts = text.split(/\s+·\s+/).map((p) => p.trim()).filter(Boolean);
  const [index, setIndex] = useState(0);
  useEffect(() => {
    if (parts.length < 2) return;
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (media.matches) return;
    const id = window.setInterval(() => setIndex((i) => (i + 1) % parts.length), 3800);
    return () => window.clearInterval(id);
  }, [parts.length]);
  return (
    <>
      <span className="label hidden truncate px-4 text-center sm:block">{text}</span>
      <span className="label block px-4 text-center text-[10px] sm:hidden" aria-live="off">
        <span key={index} className="inline-block animate-fade-in">
          {parts[index] ?? text}
        </span>
      </span>
    </>
  );
}
