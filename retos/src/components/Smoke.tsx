"use client";
import { useEffect, useRef, useState } from "react";
import { sfx } from "@/lib/sfx";
import { SMOKE_MIN_MS } from "@/lib/types";
import type { RoomView } from "@/lib/types";
import { Confetti } from "./Cards";
import { useSettings } from "./Settings";

const NUMS = [1, 2, 3, 4, 5];
const SECTOR = 72;
// Cada sector: [claro, oscuro] para el degradado con volumen
const FILLS: [string, string][] = [["#FF8A8A", "#D8323F"], ["#FFE08A", "#EDA10F"], ["#9AF0CC", "#22A97B"], ["#C9B6FF", "#6F4BE0"], ["#FFFAF0", "#E2CBA6"]];
const pt = (deg: number, r: number) => { const a = (deg - 90) * Math.PI / 180; return [r * Math.cos(a), r * Math.sin(a)]; };
const wedge = (i: number, r = 94) => { const [x0, y0] = pt(i * SECTOR, r), [x1, y1] = pt((i + 1) * SECTOR, r); return `M0 0 L${x0.toFixed(2)} ${y0.toFixed(2)} A${r} ${r} 0 0 1 ${x1.toFixed(2)} ${y1.toFixed(2)} Z`; };
/** Giro total para que el sector `n` quede bajo la flecha (arriba): varias vueltas + el sector, con un poco de azar dentro de él. */
const landing = (n: number, jitter: number) => 360 * 6 + 360 - ((n - 0.5) * SECTOR + jitter);
const PINS = Array.from({ length: 20 }, (_, i) => pt(i * 18, 97.5));
const CLOUDS = Array.from({ length: 14 }, (_, i) => ({
  x: `${(i * 37 + 8) % 100}%`, y: `${(i * 53 + 12) % 100}%`, s: `${62 + ((i * 29) % 48)}vmax`, d: `${(i % 7) * 0.16}s`, dx: `${((i * 41) % 44) - 22}vw`,
}));
const SPORES = Array.from({ length: 18 }, (_, i) => ({ x: `${(i * 23 + 5) % 100}%`, d: `${(i * 0.53) % 6}s`, t: `${6 + (i % 5)}s`, s: `${4 + (i % 4) * 2}px`, dx: `${((i * 17) % 40) - 20}px` }));

/** Ruleta de humo: el humo tapa la pantalla, el personaje irrumpe, pregunta en un globo, gira un nombre y después una rueda 3D cae en un número del 1 al 5. */
export function SmokeRoulette({ view, onNext }: { view: RoomView; onNext: (id: string) => Promise<string | null> }) {
  const sm = view.smoke!;
  const { reduced } = useSettings();
  const names = view.players.filter((p) => p.active).map((p) => p.name);
  const chosen = view.players.find((p) => p.id === sm.playerId)?.name ?? "alguien";
  const stale = view.serverNow - sm.at > 30000; // quien reconecta tarde ve el resultado directo
  const instant = reduced || stale;
  // fase: 0 humo · 1 irrumpe el personaje · 2 pregunta y gira el nombre · 3 gira la rueda · 4 resultado
  const [phase, setPhase] = useState(instant ? 4 : 0);
  const [shownName, setShownName] = useState(instant ? chosen : "…");
  const [slot, setSlot] = useState(0);
  const jitter = useRef((Math.random() < 0.5 ? -1 : 1) * (22 + Math.random() * 9)).current; // cae cerca del borde del sector: "casi" en el de al lado
  const [flap, setFlap] = useState(0);
  const [tense, setTense] = useState(false);
  const [hint, setHint] = useState("");
  const [shownSecas, setShownSecas] = useState(instant ? sm.count : 0);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [, tick] = useState(0);
  const start = useRef(Date.now());
  const tilt = useRef<HTMLDivElement>(null);
  const wheelRef = useRef<SVGSVGElement>(null);
  const raf = useRef(0);

  useEffect(() => {
    if (instant) return;
    const T: ReturnType<typeof setTimeout>[] = [];
    const at = (ms: number, fn: () => void) => T.push(setTimeout(fn, ms));
    sfx.smoke();
    at(300, () => setHint("Se viene el humo…"));
    at(2700, () => { setPhase(1); setHint(""); sfx.thump(); if (navigator.vibrate) navigator.vibrate(70); });
    // 2) el nombre gira, cada vez más lento, y frena con suspenso en el elegido
    const pool = names.length > 1 ? names : [chosen, chosen];
    const seq: string[] = [];
    for (let i = 0; i < 30; i++) { let n = pool[Math.floor(Math.random() * pool.length)]; if (n === seq[seq.length - 1]) n = pool[(pool.indexOf(n) + 1) % pool.length]; seq.push(n); }
    if (seq[seq.length - 1] === chosen) seq[seq.length - 1] = pool.find((n) => n !== chosen) ?? chosen;
    seq.push(chosen);
    let t = 4400;
    at(t, () => { setPhase(2); setHint("Elegimos a quién le toca…"); sfx.riser(5.6); });
    seq.forEach((n, i) => { t += 55 + 640 * Math.pow(i / seq.length, 4); at(t, () => { setShownName(n); setSlot((k) => k + 1); sfx.tick(Math.min(i, 24)); }); });
    t += 500;
    at(t, () => { setHint(`¡Le toca a ${chosen}!`); sfx.thump(); if (navigator.vibrate) navigator.vibrate([60, 40, 100]); });
    t += 1700; // 3) sube la rueda y gira ~8 s, frenando de a poco
    at(t, () => { setPhase(3); setHint("Girando la rueda…"); sfx.heartbeat(); });
    const SPIN_START = t + 1100, SPIN_MS = 8200, total = landing(sm.count, jitter);
    at(SPIN_START - 100, () => sfx.riser(5.5));
    let lastPin = 0, lastTick = 0, lastBeat = 0;
    at(SPIN_START, () => {
      const t0 = performance.now();
      const frame = (now: number) => {
        const k = Math.min(1, (now - t0) / SPIN_MS), ang = total * (1 - Math.pow(1 - k, 4.4));
        if (wheelRef.current) wheelRef.current.style.transform = `rotate(${ang}deg)`;
        const pin = Math.floor(ang / 18);
        if (pin !== lastPin && now - lastTick > 38) { sfx.tick(Math.min(24, Math.round((1 - k) * 24))); setFlap((f) => f + 1); lastTick = now; }
        lastPin = pin;
        if (k > 0.55 && now - lastBeat > 900 - 380 * (k - 0.55)) { sfx.heartbeat(); if (navigator.vibrate) navigator.vibrate(25); lastBeat = now; }
        if (k < 1) raf.current = requestAnimationFrame(frame);
      };
      raf.current = requestAnimationFrame(frame);
    });
    at(SPIN_START + SPIN_MS * 0.45, () => { setTense(true); setHint("¡Ya casi…!"); });
    at(SPIN_START + SPIN_MS * 0.8, () => setHint("¿Cae ahí…?"));
    t = SPIN_START + SPIN_MS + 700;
    at(t, () => { setTense(false); setPhase(4); setHint(""); sfx.reveal(); sfx.thump(); if (navigator.vibrate) navigator.vibrate([80, 40, 160]); });
    for (let i = 0; i < sm.count; i++) at(t + 1500 + i * 800, () => { setShownSecas(i + 1); sfx.puff(); if (navigator.vibrate) navigator.vibrate(30); });
    return () => { T.forEach(clearTimeout); cancelAnimationFrame(raf.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sm.id]);

  // el servidor no deja seguir antes de SMOKE_MIN_MS desde que salió la ruleta
  useEffect(() => { const i = setInterval(() => tick((n) => n + 1), 500); return () => clearInterval(i); }, []);
  const left = Math.max(0, Math.ceil((SMOKE_MIN_MS - (view.serverNow - sm.at) - (Date.now() - start.current)) / 1000));
  const ready = phase >= 4 && shownSecas >= sm.count && left <= 0;

  const go = async () => { setBusy(true); setErr(""); const e = await onNext(sm.id); setBusy(false); if (e) setErr(e); };
  // 3D: el personaje se inclina hacia donde tocás / movés el mouse
  const onMove = (e: React.PointerEvent) => {
    if (reduced || !tilt.current) return;
    const r = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
    tilt.current.style.transform = `rotateY(${(x * 26).toFixed(1)}deg) rotateX(${(-y * 18).toFixed(1)}deg)`;
  };

  const f = FILLS;
  return (
    <div className={`smoke-ov sm phase-${phase}${instant ? " is-instant" : ""}${tense ? " is-tense" : ""}`} role="dialog" aria-modal="true" aria-label="Ruleta de humo" onPointerMove={onMove}>
      <div className="sm-rays" aria-hidden="true" />
      <div className="sm-spores" aria-hidden="true">{SPORES.map((p, i) => <i key={i} style={{ left: p.x, width: p.s, height: p.s, animationDelay: p.d, animationDuration: p.t, ["--dx" as string]: p.dx }} />)}</div>
      <div className="sm-fog" aria-hidden="true">{CLOUDS.map((c, i) => <i key={i} style={{ left: c.x, top: c.y, width: c.s, height: c.s, animationDelay: c.d, ["--dx" as string]: c.dx }} />)}</div>
      <div className="sm-flash" aria-hidden="true" />

      <div className="sm-main">
        {/* El personaje hace la pregunta */}
        <div className="sm-scene">
          <div className="sm-char" aria-hidden="true">
            <div className="sm-char-tilt" ref={tilt}>
              <div className="sm-char-sway">
                <span className="sm-aura" />
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/humo.png" width={483} height={560} alt="" draggable={false} />
                <span className="sm-puffs">{[0, 1, 2, 3, 4].map((i) => <i key={i} style={{ animationDelay: `${i * 0.55}s` }} />)}</span>
              </div>
            </div>
            <span className="sm-char-shadow" />
          </div>
          <div className="sm-bubble" aria-live="polite">
            <p className="sm-q">¿Cuántas secas va a dar <span className={`sm-name${phase >= 3 ? " is-set" : ""}`}><span key={slot} className="sm-slot">{shownName}</span></span>?</p>
          </div>
        </div>

        {/* Rueda 3D */}
        <div className={`sm-wheelbox${phase >= 3 ? " on" : ""}${tense ? " is-tense" : ""}`} aria-hidden="true">
          <span className="sm-wheel-shadow" />
          <div className="sm-wheel3d">
            <span className="sm-wheel-depth" />
            <span key={flap} className="sm-pointer" />
            <svg ref={wheelRef} className="wheel" viewBox="-100 -100 200 200" style={instant ? { transform: `rotate(${landing(sm.count, jitter) % 360}deg)` } : undefined}>
              <defs>
                {f.map((c, i) => (
                  <radialGradient key={i} id={`sg${i}`} cx="0" cy="0" r="95" gradientUnits="userSpaceOnUse"><stop offset="0" stopColor={c[1]} /><stop offset="0.55" stopColor={c[0]} /><stop offset="1" stopColor={c[1]} /></radialGradient>
                ))}
                <linearGradient id="rim" x1="0" y1="-100" x2="0" y2="100" gradientUnits="userSpaceOnUse"><stop offset="0" stopColor="#FFF1B8" /><stop offset="0.5" stopColor="#E7A90E" /><stop offset="1" stopColor="#8A5A00" /></linearGradient>
                <radialGradient id="hub" cx="-4" cy="-6" r="16" gradientUnits="userSpaceOnUse"><stop offset="0" stopColor="#FFF1B8" /><stop offset="0.6" stopColor="#E7A90E" /><stop offset="1" stopColor="#7A4E00" /></radialGradient>
              </defs>
              <circle r="100" fill="url(#rim)" />
              <circle r="95.5" fill="#1a0f06" />
              {NUMS.map((n, i) => (
                <g key={n}>
                  <path d={wedge(i)} fill={`url(#sg${i})`} stroke="#1a0f06" strokeWidth="2.5" strokeLinejoin="round" />
                  <text transform={`rotate(${i * SECTOR + SECTOR / 2}) translate(0 -60)`} textAnchor="middle" dominantBaseline="central" fontSize="38" fontWeight="800" fill="#1a0f06" stroke="rgba(255,255,255,0.55)" strokeWidth="0.8" paintOrder="stroke">{n}</text>
                </g>
              ))}
              {phase >= 4 && <path className="sm-win" d={wedge(sm.count - 1, 93)} />}
              {PINS.map(([x, y], i) => <circle key={i} className="sm-pin" cx={x} cy={y} r="2.7" style={{ animationDelay: `${(i % 2) * 0.4}s` }} />)}
              <circle r="15" fill="url(#hub)" stroke="#1a0f06" strokeWidth="2.5" />
            </svg>
            <span className="sm-gloss" />
          </div>
        </div>

        {/* Resultado y botón */}
        <div className="sm-foot">
          {hint && phase < 4 && <p key={hint} className="sm-hint">{hint}</p>}
          <p className="smoke-result" aria-live="polite">
            {phase >= 4 ? <>{chosen} da <b className="sm-num">{sm.count}</b> {sm.count === 1 ? "seca" : "secas"}. <span className="sm-must">Es obligatorio.</span></> : " "}
          </p>
          {phase >= 4 && (
            <div className="sm-secas" aria-hidden="true">
              {Array.from({ length: sm.count }, (_, i) => <span key={i} className={`sm-seca${i < shownSecas ? " on" : ""}`}><b>{i + 1}</b></span>)}
            </div>
          )}
          {phase >= 4 && (
            <div className="smoke-actions">
              <button className="btn btn-smoke btn-xl" disabled={!ready || busy} onClick={go}>{ready || left <= 0 ? "Hacelo cagón" : `Hacelo cagón (${left} s)`}</button>
              {err && <p className="error" role="alert">{err}</p>}
            </div>
          )}
        </div>
      </div>
      {phase >= 4 && !instant && <Confetti />}
    </div>
  );
}
