"use client";
import { useEffect, useRef, useState } from "react";
import { sfx } from "@/lib/sfx";
import { SMOKE_MIN_MS } from "@/lib/types";
import type { RoomView } from "@/lib/types";
import { useSettings } from "./Settings";

const NUMS = [1, 2, 3, 4, 5];
const CLOUDS = Array.from({ length: 16 }, (_, i) => ({
  x: `${(i * 37 + 8) % 100}%`, y: `${(i * 53 + 12) % 100}%`, s: `${60 + ((i * 29) % 50)}vmax`, d: `${(i % 8) * 0.18}s`, dx: `${((i * 41) % 40) - 20}vw`,
}));

/** Ruleta de humo: el humo llena la pantalla, aparece el personaje, gira un nombre y después un número del 1 al 5. */
export function SmokeRoulette({ view, onNext }: { view: RoomView; onNext: (id: string, skipped: boolean) => Promise<string | null> }) {
  const sm = view.smoke!;
  const { reduced } = useSettings();
  const names = view.players.filter((p) => p.active).map((p) => p.name);
  const chosen = view.players.find((p) => p.id === sm.playerId)?.name ?? "alguien";
  const isMe = sm.playerId === view.me.id;
  const stale = view.serverNow - sm.at > 14000; // quien reconecta tarde ve el resultado directo
  const instant = reduced || stale;
  // fase: 0 humo · 1 personaje · 2 gira el nombre · 3 gira el número · 4 resultado
  const [phase, setPhase] = useState(instant ? 4 : 0);
  const [shownName, setShownName] = useState(instant ? chosen : "…");
  const [lit, setLit] = useState<number | null>(instant ? sm.count : null);
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
    t += 600; // 3) gira el número 1..5
    T.push(setTimeout(() => { setPhase(3); sfx.heartbeat(); }, t));
    const nseq: number[] = [];
    for (let i = 0; i < 11; i++) { let n = NUMS[Math.floor(Math.random() * 5)]; if (n === nseq[nseq.length - 1]) n = (n % 5) + 1; nseq.push(n); }
    if (nseq[nseq.length - 1] === sm.count) nseq[nseq.length - 1] = (sm.count % 5) + 1;
    nseq.push(sm.count);
    nseq.forEach((n, i) => { t += 90 + Math.pow(i / nseq.length, 3) * 420; T.push(setTimeout(() => { setLit(n); sfx.tick(i + 4); }, t)); });
    T.push(setTimeout(() => { setPhase(4); sfx.reveal(); if (navigator.vibrate) navigator.vibrate([80, 40, 120]); }, t + 500));
    return () => T.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sm.id]);

  // el servidor no deja seguir antes de SMOKE_MIN_MS desde que salió la ruleta
  useEffect(() => { const i = setInterval(() => tick((n) => n + 1), 500); return () => clearInterval(i); }, []);
  const left = Math.max(0, Math.ceil((SMOKE_MIN_MS - (view.serverNow - sm.at) - (Date.now() - start.current)) / 1000));
  const ready = phase >= 4 && left <= 0;

  const go = async (skipped: boolean) => { setBusy(true); setErr(""); const e = await onNext(sm.id, skipped); setBusy(false); if (e) setErr(e); };

  return (
    <div className={`smoke-ov phase-${phase}`} role="dialog" aria-modal="true" aria-label="Ruleta de humo" aria-live="assertive">
      <div className="smoke-haze" aria-hidden="true">
        {CLOUDS.map((c, i) => <i key={i} style={{ left: c.x, top: c.y, width: c.s, height: c.s, animationDelay: c.d, ["--dx" as string]: c.dx }} />)}
      </div>
      <div className="smoke-inner">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="smoke-char" src="/humo.png" width={280} height={324} alt="" draggable={false} />
        <h2 className="smoke-title">¿Cuántas secas va a dar <span className={`smoke-name${phase >= 4 ? " is-set" : ""}`}>{shownName}</span>?</h2>
        <div className={`smoke-nums${phase >= 3 ? " on" : ""}`} aria-hidden="true">
          {NUMS.map((n) => <span key={n} className={`${lit === n ? (phase >= 4 ? "won" : "lit") : ""}`}>{n}</span>)}
        </div>
        <p className="smoke-result" aria-live="polite">{phase >= 4 ? `${chosen} da ${sm.count} ${sm.count === 1 ? "seca" : "secas"}` : " "}</p>
        {phase >= 4 && (
          <div className="smoke-actions">
            <button className="btn btn-primary btn-xl" disabled={!ready || busy} onClick={() => go(false)}>{ready ? "Seguir" : `Seguir (${left} s)`}</button>
            {isMe && <button className="btn btn-ghost" disabled={!ready || busy} onClick={() => go(true)}>Paso (no me toca)</button>}
            {err && <p className="error" role="alert">{err}</p>}
          </div>
        )}
      </div>
    </div>
  );
}
