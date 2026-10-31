"use client";
import { useId } from "react";

// Coordenadas en el lienzo original del arte (1254×1254). La base no tiene humo ni boca: se animan acá.
const SMOKE = [
  "M1046 700 C1085 640 1130 640 1118 565 C1108 495 1185 470 1172 385 C1162 320 1100 300 1092 225",
  "M1046 700 C1070 650 1150 620 1135 550 C1122 480 1200 440 1190 360 C1182 300 1130 270 1135 205",
  "M1046 700 C1060 640 1100 600 1085 540 C1072 480 1150 470 1150 400 C1150 330 1080 320 1105 235",
];
const STAR = "M0 -46 C6 -14 14 -6 46 0 C14 6 6 14 0 46 C-6 14 -14 6 -46 0 C-14 -6 -6 -14 0 -46 Z";

/** Mascota: se mece, tiene brillo en los lentes y le sale humo del cigarrillo. La sonrisa es la del dibujo original. */
export function Mascot({ className = "" }: { className?: string }) {
  const id = useId().replace(/:/g, "");
  return (
    <div className={`mascot-wrap ${className}`} role="img" aria-label="Mono con gorra y anteojos, sonriendo y fumando: la mascota de Boca Abajo">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/mono-base.png" alt="" width={760} height={760} draggable={false} />
      <svg viewBox="0 0 1254 1254" aria-hidden="true" focusable="false">
        <defs>
          <radialGradient id={`e${id}`}>
            <stop offset="0" stopColor="#FFD27A" stopOpacity="0.95" />
            <stop offset="0.45" stopColor="#FF9E2C" stopOpacity="0.55" />
            <stop offset="1" stopColor="#FF6A00" stopOpacity="0" />
          </radialGradient>
        </defs>
        <g className="smoke">
          {SMOKE.map((d, i) => (
            <g key={i} className="puff" style={{ ["--d" as string]: `${i * 1.7}s` }}>
              <path className="puff-o" d={d} pathLength={100} />
              <path className="puff-i" d={d} pathLength={100} />
            </g>
          ))}
        </g>
        <circle className="ember" cx="1046" cy="712" r="46" fill={`url(#e${id})`} />
        <g transform="translate(560 352)"><path className="spark" style={{ ["--d" as string]: "0.9s" }} d={STAR} fill="#fff" /></g>
        <g transform="translate(822 452) scale(.8)"><path className="spark" style={{ ["--d" as string]: "1.35s" }} d={STAR} fill="#fff" /></g>
      </svg>
    </div>
  );
}
