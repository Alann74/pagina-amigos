"use client";
import { useId } from "react";

// Coordenadas en el lienzo original del arte (1254×1254). La base no tiene humo ni boca: se animan acá.
const SMILE = "M540 606 C556 646 610 664 690 662 C760 660 812 642 838 620";
const GRIN = "M536 598 C552 640 610 656 690 654 C760 652 812 636 838 614 C836 690 770 746 690 746 C600 746 540 690 536 598 Z";
const TEETH = "M500 560 L880 560 L880 640 C810 690 740 698 690 698 C620 698 550 678 500 636 Z";
const SMOKE = [
  "M1046 700 C1085 640 1130 640 1118 565 C1108 495 1185 470 1172 385 C1162 320 1100 300 1092 225",
  "M1046 700 C1070 650 1150 620 1135 550 C1122 480 1200 440 1190 360 C1182 300 1130 270 1135 205",
  "M1046 700 C1060 640 1100 600 1085 540 C1072 480 1150 470 1150 400 C1150 330 1080 320 1105 235",
];
const STAR = "M0 -46 C6 -14 14 -6 46 0 C14 6 6 14 0 46 C-6 14 -14 6 -46 0 C-14 -6 -6 -14 0 -46 Z";

/** Mascota: respira, sonríe (se abre en una sonrisa grande), tiene brillo en los lentes y le sale humo del cigarrillo. */
export function Mascot({ className = "" }: { className?: string }) {
  const id = useId().replace(/:/g, "");
  return (
    <div className={`mascot-wrap ${className}`} role="img" aria-label="Mono con gorra y anteojos, sonriendo y fumando: la mascota de Boca Abajo">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/mono-base.png" alt="" width={760} height={760} draggable={false} />
      <svg viewBox="0 0 1254 1254" aria-hidden="true" focusable="false">
        <defs>
          <clipPath id={`m${id}`}><path d={GRIN} /></clipPath>
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
        <path className="smile" d={SMILE} />
        <g className="grin">
          <path d={GRIN} fill="#3A0E0B" />
          <g clipPath={`url(#m${id})`}>
            <ellipse cx="700" cy="748" rx="86" ry="46" fill="#E31E26" />
            <path d={TEETH} fill="#FFF1E0" />
            {[598, 650, 702, 754, 806].map((x) => <line key={x} x1={x} y1="560" x2={x} y2="700" stroke="#C9B49C" strokeWidth="4" />)}
          </g>
          <path d={GRIN} fill="none" stroke="#120A07" strokeWidth="11" strokeLinejoin="round" />
        </g>
        <g transform="translate(560 352)"><path className="spark" style={{ ["--d" as string]: "0.9s" }} d={STAR} fill="#fff" /></g>
        <g transform="translate(822 452) scale(.8)"><path className="spark" style={{ ["--d" as string]: "1.35s" }} d={STAR} fill="#fff" /></g>
      </svg>
    </div>
  );
}
