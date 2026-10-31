"use client";
import { useEffect, useRef, useState } from "react";
import { sfx } from "@/lib/sfx";
import type { ViewTurn } from "@/lib/types";
import { Confetti } from "./Cards";
import { useSettings } from "./Settings";

/** El momento protagonista: ruleta de suspenso entre las cartas, aterrizaje, giro, nombre y reto. */
export function Reveal({ kind, turn, holderName, onClose }: { kind: "p" | "c"; turn: ViewTurn; holderName: string; onClose: () => void }) {
  const { reduced } = useSettings();
  const isC = kind === "c"; // "p": a quién le toca · "c": qué reto le toca
  const tiedArr = isC ? turn.pickTied : turn.tied;
  const tallyArr = isC ? turn.pickTally : turn.tally;
  const tie = (tiedArr?.length ?? 0) > 1;
  const winner = (isC ? turn.pickWinner : turn.winnerCard) ?? 1;
  const cards = Array.from({ length: (isC ? turn.pickCount : turn.cardCount) ?? 1 }, (_, i) => i + 1);
  const [step, setStep] = useState(reduced ? 3 : 0); // 0 ruleta · 1 giro · 2 nombre · 3 reto
  const [lit, setLit] = useState<number | null>(null);
  const [landed, setLanded] = useState(reduced);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    if (reduced) { sfx.reveal(); const a = setTimeout(() => closeRef.current(), 20000); return () => clearTimeout(a); }
    const T: ReturnType<typeof setTimeout>[] = [];
    const pool = tie ? tiedArr! : cards;
    const total = cards.length === 1 ? 1 : isC ? (tie ? 12 : 9) : (tie ? 18 : 14);
    const seq: number[] = [];
    let prev = -1;
    for (let i = 0; i < total - 1; i++) {
      let c = pool[Math.floor(Math.random() * pool.length)];
      let guard = 0;
      while (c === prev && pool.length > 1 && guard++ < 10) c = pool[Math.floor(Math.random() * pool.length)];
      seq.push(c); prev = c;
    }
    if (pool.length > 1 && seq[seq.length - 1] === winner) seq[seq.length - 1] = pool.find((c) => c !== winner)!;
    seq.push(winner);
    let t = 350;
    seq.forEach((c, i) => {
      t += 70 + Math.pow(i / seq.length, 3) * 430; // cada vez más lento
      T.push(setTimeout(() => { setLit(c); sfx.tick(i); }, t));
    });
    const landAt = t + 250;
    T.push(setTimeout(() => { setLanded(true); sfx.heartbeat(); }, landAt));
    T.push(setTimeout(() => { setStep(1); sfx.flip(); }, landAt + (isC ? 600 : 900)));
    T.push(setTimeout(() => { setStep(2); sfx.reveal(); if (navigator.vibrate) navigator.vibrate([60, 40, 90]); }, landAt + (isC ? 1250 : 1700)));
    T.push(setTimeout(() => setStep(3), landAt + (isC ? 2100 : 2800)));
    T.push(setTimeout(() => closeRef.current(), 25000));
    return () => T.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduced]);

  const votes = tallyArr?.[winner - 1] ?? 0;
  const kicker = !landed
    ? tie ? `Empate entre las cartas ${tiedArr!.join(" y ")}. Sorteo…` : cards.length === 1 ? "Queda un solo reto…" : isC ? "Contando votos del reto…" : "Contando votos…"
    : cards.length === 1 ? "Este es el reto" : `Carta ${winner}${tie ? " (ganó el sorteo)" : ""} · ${votes} ${votes === 1 ? "voto" : "votos"}`;
  const words = (turn.challenge ?? "").split(" ");
  const wordsEl = (cls: string) => words.map((w, i) => <span key={i} className={cls} style={{ animationDelay: `${i * 70}ms` }}>{w}</span>);
  return (
    <div className="reveal" role="dialog" aria-modal="true" aria-label={isC ? "Revelación del reto" : "Revelación de la carta"} aria-live="assertive">
      <div className="reveal-spot" aria-hidden="true" />
      <div className="reveal-inner">
        <p className="reveal-kicker" key={kicker}>{kicker}</p>
        <div className={`roulette${landed ? " is-landed" : ""}`} aria-hidden="true">
          {cards.map((n) => (
            <span key={n} className={`mini${lit === n && !landed ? " lit" : ""}${landed && n === winner ? " won" : ""}${landed && n !== winner ? " out" : ""}${tie && !tiedArr!.includes(n) ? " dim" : ""}`}>{n}</span>
          ))}
        </div>
        <div className={`flip${step >= 1 ? " is-flipped" : ""}${!landed ? " is-shaking" : ""}`}>
          {landed && <span className="shock" aria-hidden="true" />}
          <div className="flip-face flip-front card-back"><span className="card-num">{landed ? winner : "?"}</span></div>
          <div className={`flip-face flip-back${isC ? " is-text" : ""}`}>
            {isC ? (
              <>
                <span className="flip-label">El reto de {holderName}</span>
                {step >= 2 ? <strong className="flip-text" aria-label={turn.challenge}>{wordsEl("w")}</strong> : <strong className="flip-text" style={{ visibility: "hidden" }}>{turn.challenge}</strong>}
              </>
            ) : (
              <>
                <span className="flip-label">Le toca a</span>
                {step >= 2
                  ? <strong className="flip-name" aria-label={holderName}>{Array.from(holderName).map((ch, i) => <span key={i} className="ch" style={{ animationDelay: `${i * 55}ms` }} aria-hidden="true">{ch === " " ? "\u00A0" : ch}</span>)}</strong>
                  : <strong className="flip-name" style={{ visibility: "hidden" }}>{holderName}</strong>}
              </>
            )}
          </div>
        </div>
        {step >= 2 && <Confetti />}
        <button type="button" className="btn btn-primary" onClick={onClose} style={{ visibility: step >= 3 ? "visible" : "hidden" }} disabled={step < 3}>Seguir</button>
      </div>
    </div>
  );
}
