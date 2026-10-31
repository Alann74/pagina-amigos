"use client";
import { useEffect, useRef, useState } from "react";
import { sfx } from "@/lib/sfx";
import { SMOKE_MIN_MS } from "@/lib/types";
import type { RoomView } from "@/lib/types";
import { useSettings } from "./Settings";

const NUMS = [1, 2, 3, 4, 5];
const SECTOR = 72;
const COLORS = ["#FF6B6B", "#FFD166", "#7EE0B5", "#B79CFF", "#FFF4E6"];
const pt = (deg: number, r: number) => { const a = (deg - 90) * Math.PI / 180; return [r * Math.cos(a), r * Math.sin(a)]; };
const wedge = (i: number) => { const [x0, y0] = pt(i * SECTOR, 98), [x1, y1] = pt((i + 1) * SECTOR, 98); return `M0 0 L${x0.toFixed(2)} ${y0.toFixed(2)} A98 98 0 0 1 ${x1.toFixed(2)} ${y1.toFixed(2)} Z`; };
/** Giro total para que el sector `n` quede bajo la flecha (arriba): varias vueltas + el sector, con un poco de azar dentro de él. */
const landing = (n: number, jitter: number) => 360 * 6 + 360 - ((n - 0.5) * SECTOR + jitter);
const CLOUDS = Array.from({ length: 16 }, (_, i) => ({
  x: `${(i * 37 + 8) % 100}%`, y: `${(i * 53 + 12) % 100}%`, s: `${60 + ((i * 29) % 50)}vmax`, d: `${(i % 8) * 0.18}s`, dx: `${((i * 41) % 40) - 20}vw`,
}));

/** Ruleta de humo: el humo llena la pantalla, aparece el personaje, gira un nombre y después un número del 1 al 5. */
export function SmokeRoulette({ view, onNext }: { view: RoomView; onNext: (id: string) => Promise<string | null> }) {
  const sm = view.smoke!;
  const { reduced } = useSettings();
  const names = view.players.filter((p) => p.active).map((p) => p.name);
  const chosen = view.players.find((p) => p.id === sm.playerId)?.name ?? "alguien";
  const stale = view.serverNow - sm.at > 14000; // quien reconecta tarde ve el resultado directo
  const instant = reduced || stale;
  // fase: 0 humo · 1 personaje · 2 gira el nombre · 3 gira el número · 4 resultado
  const [phase, setPhase] = useState(instant ? 4 : 0);
  const [shownName, setShownName] = useState(instant ? chosen : "…");
  const jitter = useRef((Math.random() - 0.5) * 40).current;
  const [spin, setSpin] = useState<number>(instant ? landing(sm.count, jitter) % 360 : 0);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [, tick] = useState(0);
  const start = useRef(Date.now());

  useEffect(() => {
    if (instant) return;
    const T: ReturnType<typeof setTimeout>[] = [];
    sfx.smoke();
    T.push(setTimeout(() => setPhase(1), 1500));
    // 2) gira el nombre (cada vez más lento) y aterriza en el elegido
    const pool = names.length > 1 ? names : [chosen, chosen];
    const seq: string[] = [];
    for (let i = 0; i < 15; i++) { let n = pool[Math.floor(Math.random() * pool.length)]; if (n === seq[seq.length - 1]) n = pool[(pool.indexOf(n) + 1) % pool.length]; seq.push(n); }
    if (seq[seq.length - 1] === chosen) seq[seq.length - 1] = pool.find((n) => n !== chosen) ?? chosen;
    seq.push(chosen);
    let t = 3000;
    T.push(setTimeout(() => setPhase(2), t));
    seq.forEach((n, i) => { t += 70 + Math.pow(i / seq.length, 3) * 330; T.push(setTimeout(() => { setShownName(n); sfx.tick(i); }, t)); });
    t += 600; // 3) gira la rueda 1..5 y cae sola
    T.push(setTimeout(() => { setPhase(3); sfx.heartbeat(); }, t));
    T.push(setTimeout(() => setSpin(landing(sm.count, jitter)), t + 150));
    for (let i = 0; i < 38; i++) { const at = t + 150 + 4300 * (1 - Math.pow(1 - i / 38, 1 / 2.2)); T.push(setTimeout(() => sfx.tick(Math.min(i, 20)), at)); } // clics de la rueda, cada vez más espaciados
    t += 150 + 4600;
    T.push(setTimeout(() => { setPhase(4); sfx.reveal(); if (navigator.vibrate) navigator.vibrate([80, 40, 120]); }, t));
    return () => T.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sm.id]);

  // el servidor no deja seguir antes de SMOKE_MIN_MS desde que salió la ruleta
  useEffect(() => { const i = setInterval(() => tick((n) => n + 1), 500); return () => clearInterval(i); }, []);
  const left = Math.max(0, Math.ceil((SMOKE_MIN_MS - (view.serverNow - sm.at) - (Date.now() - start.current)) / 1000));
  const ready = phase >= 4 && left <= 0;

  const go = async () => { setBusy(true); setErr(""); const e = await onNext(sm.id); setBusy(false); if (e) setErr(e); };

  return (
    <div className={`smoke-ov phase-${phase}`} role="dialog" aria-modal="true" aria-label="Ruleta de humo" aria-live="assertive">
      <div className="smoke-haze" aria-hidden="true">
        {CLOUDS.map((c, i) => <i key={i} style={{ left: c.x, top: c.y, width: c.s, height: c.s, animationDelay: c.d, ["--dx" as string]: c.dx }} />)}
      </div>
      <div className="smoke-inner">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="smoke-char" src="/humo.png" width={280} height={324} alt="" draggable={false} />
        <h2 className="smoke-title">¿Cuántas secas va a dar <span className={`smoke-name${phase >= 4 ? " is-set" : ""}`}>{shownName}</span>?</h2>
        <div className={`wheel-wrap${phase >= 3 ? " on" : ""}`} aria-hidden="true">
          <span className="wheel-pointer" />
          <svg className={`wheel${phase >= 3 && !instant ? " spinning" : ""}`} viewBox="-100 -100 200 200" style={{ transform: `rotate(${spin}deg)` }}>
            <circle r="99" fill="#191329" />
            {NUMS.map((n, i) => (
              <g key={n}>
                <path d={wedge(i)} fill={COLORS[i]} stroke="#191329" strokeWidth="3" />
                <text transform={`rotate(${i * SECTOR + SECTOR / 2}) translate(0 -62)`} textAnchor="middle" dominantBaseline="central" fontSize="34" fontWeight="800" fill="#191329">{n}</text>
              </g>
            ))}
            <circle r="13" fill="#191329" stroke="#FFF4E6" strokeWidth="3" />
          </svg>
        </div>
        <p className="smoke-result" aria-live="polite">{phase >= 4 ? `${chosen} da ${sm.count} ${sm.count === 1 ? "seca" : "secas"}. Es obligatorio.` : " "}</p>
        {phase >= 4 && (
          <div className="smoke-actions">
            <button className="btn btn-primary btn-xl" disabled={!ready || busy} onClick={go}>{ready ? "Hacelo cagón" : `Hacelo cagón (${left} s)`}</button>
            {err && <p className="error" role="alert">{err}</p>}
          </div>
        )}
      </div>
    </div>
  );
}
