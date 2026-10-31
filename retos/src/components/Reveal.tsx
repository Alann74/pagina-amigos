"use client";
import { useEffect, useRef, useState } from "react";
import { sfx } from "@/lib/sfx";
import type { ViewTurn } from "@/lib/types";
import { Confetti } from "./Cards";
import { useSettings } from "./Settings";

/** El momento protagonista: suspenso, giro de carta, nombre y reto. */
export function Reveal({ turn, holderName, onClose }: { turn: ViewTurn; holderName: string; onClose: () => void }) {
  const { reduced } = useSettings();
  const [step, setStep] = useState(reduced ? 3 : 0);
  const tie = (turn.tied?.length ?? 0) > 1;
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    if (reduced) { sfx.reveal(); const t = setTimeout(() => setStep(3), 150); const a = setTimeout(() => closeRef.current(), 20000); return () => { clearTimeout(t); clearTimeout(a); }; }
    const wait = tie ? 3000 : 2000;
    const T: ReturnType<typeof setTimeout>[] = [];
    sfx.heartbeat();
    T.push(setTimeout(() => sfx.heartbeat(), 900));
    if (tie) T.push(setTimeout(() => sfx.heartbeat(), 1900));
    T.push(setTimeout(() => { setStep(1); sfx.flip(); }, wait));
    T.push(setTimeout(() => { setStep(2); sfx.reveal(); if (navigator.vibrate) navigator.vibrate(80); }, wait + 800));
    T.push(setTimeout(() => setStep(3), wait + 1900));
    T.push(setTimeout(() => closeRef.current(), 20000));
    return () => T.forEach(clearTimeout);
  }, [reduced, tie]);

  const winner = turn.winnerCard ?? 0;
  const votes = turn.tally?.[winner - 1] ?? 0;
  const flipped = step >= 1;
  return (
    <div className="reveal" role="dialog" aria-modal="true" aria-label="Revelación de la carta" aria-live="assertive">
      <div className="reveal-spot" aria-hidden="true" />
      <div className="reveal-inner">
        <p className="reveal-kicker">
          {step === 0 ? (tie ? `Empate entre las cartas ${turn.tied!.join(" y ")}. Sorteo…` : "Contando votos…") : `Carta ${winner}${tie ? " (ganó el sorteo)" : ""} · ${votes} ${votes === 1 ? "voto" : "votos"}`}
        </p>
        <div className={`flip${flipped ? " is-flipped" : ""}${step === 0 ? " is-shaking" : ""}`}>
          <div className="flip-face flip-front card-back"><span className="card-num">{winner}</span></div>
          <div className="flip-face flip-back">
            <span className="flip-label">Le toca a</span>
            <strong className="flip-name">{holderName}</strong>
          </div>
        </div>
        {step >= 2 && <Confetti />}
        <div className="reveal-challenge" aria-hidden={step < 3}>
          {step >= 3 && (<><span className="chip-label">El reto</span><p>{turn.challenge}</p></>)}
        </div>
        <button type="button" className="btn btn-primary" onClick={onClose} style={{ visibility: step >= 3 ? "visible" : "hidden" }} disabled={step < 3}>Seguir</button>
      </div>
    </div>
  );
}
