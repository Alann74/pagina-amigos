"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ApiError, api, lastName, saveName } from "@/lib/client";
import { sfx } from "@/lib/sfx";
import { useRoom } from "@/lib/useRoom";
import { LIMITS } from "@/lib/types";
import type { RoomView } from "@/lib/types";
import { JOKER_INFO, JokerChip } from "./Cards";
import { Icon } from "./Icon";
import { Reveal } from "./Reveal";
import { Final, Lobby, Revealed, Summary, Voting, Writing } from "./Screens";
import type { Ctx } from "./Screens";
import { useSettings } from "./Settings";

function JoinGate({ code, onJoined }: { code: string; onJoined: (c: { playerId: string; token: string }) => void }) {
  const [name, setName] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => setName(lastName()), []);
  const go = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setErr("");
    try { const r = await api.join(code, name); saveName(name); sfx.unlock(); onJoined({ playerId: r.playerId, token: r.token }); }
    catch (x) { setErr(x instanceof ApiError ? x.message : "No pudimos entrar."); }
    finally { setBusy(false); }
  };
  return (
    <main className="page narrow">
      <div className="panel center">
        <p className="eyebrow">Te invitaron a la sala</p>
        <div className="code small-code" aria-label={`Código ${code}`}>{code.split("").map((ch, i) => <span key={i}>{ch}</span>)}</div>
        <form onSubmit={go} className="stack">
          <label htmlFor="n" className="h2">¿Cómo te llamás?</label>
          <input id="n" className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={20} autoComplete="nickname" placeholder="Tu nombre" />
          {err && <p className="error" role="alert"><Icon name="x" size={16} /> {err}</p>}
          <button className="btn btn-primary btn-xl" disabled={busy || !name.trim()}>Entrar a la sala</button>
        </form>
        <p className="muted small">No hace falta registrarse. Si ya estabas, escribí el mismo nombre para volver a tu lugar.</p>
      </div>
    </main>
  );
}

export function Game({ code }: { code: string }) {
  const { creds, setCreds, view, fatal, online, busy, send } = useRoom(code);
  const [toasts, setToasts] = useState<{ id: number; m: string }[]>([]);
  const toast = useCallback((m: string) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t.slice(-2), { id, m }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4200);
  }, []);

  if (fatal) return <main className="page narrow"><div className="panel center"><h1 className="h1">Sala no encontrada</h1><p className="muted">{fatal.message}</p><a className="btn btn-primary" href="/">Volver al inicio</a></div></main>;
  if (creds === undefined) return <main className="page narrow"><p className="muted center" role="status">Cargando…</p></main>;
  if (creds === null) return <JoinGate code={code} onJoined={setCreds} />;
  if (!view) return <main className="page narrow"><p className="muted center" role="status">Entrando a la sala…</p></main>;
  return <Room view={view} online={online} busy={busy} send={send} toast={toast} toasts={toasts} onLeave={() => setCreds(null)} />;
}

type SheetKind = null | "menu" | "history" | "jokers";

function Room({ view, online, busy, send, toast, toasts, onLeave }: {
  view: RoomView; online: boolean; busy: boolean; send: Ctx["send"]; toast: (m: string) => void; toasts: { id: number; m: string }[]; onLeave: () => void;
}) {
  const { sound, reduced, toggleSound, toggleMotion } = useSettings();
  const [sheet, setSheet] = useState<SheetKind>(null);
  const seenKey = `retos:seen:${view.code}`;
  const [seen, setSeen] = useState<string[]>(() => { try { const v = JSON.parse(sessionStorage.getItem(seenKey) ?? "[]"); return Array.isArray(v) ? v : []; } catch { return []; } });
  const markKey = useCallback((k: string) => setSeen((prev) => {
    const n = [...prev.filter((x) => x !== k), k].slice(-8);
    try { sessionStorage.setItem(seenKey, JSON.stringify(n)); } catch { /* */ }
    return n;
  }), [seenKey]);
  const names = useMemo(() => new Map(view.players.map((p) => [p.id, p.name])), [view.players]);
  const name = useCallback((id: string | null | undefined) => (id ? names.get(id) ?? "alguien" : "alguien"), [names]);
  const c: Ctx = { view, send, busy, toast, name };
  const turn = view.turn;

  // Dos revelaciones por turno: 1) a quién le toca, 2) qué reto. Solo si son recientes (quien reconecta tarde no las repite).
  const pKey = turn?.revealed ? `${turn.key}:p` : null;
  const cKey = turn?.challengeRevealed ? `${turn.key}:c` : null;
  const freshP = !!turn?.revealedAt && view.serverNow - turn.revealedAt < 8000;
  const freshC = !!turn?.challengeRevealedAt && view.serverNow - turn.challengeRevealedAt < 8000;
  const reveal: { kind: "p" | "c"; key: string } | null =
    pKey && !seen.includes(pKey) && freshP ? { kind: "p", key: pKey }
    : cKey && !seen.includes(cKey) && freshC ? { kind: "c", key: cKey } : null;
  const showReveal = !!turn && !!reveal;
  const markSeen = useCallback(() => { if (reveal) markKey(reveal.key); }, [reveal, markKey]);
  useEffect(() => {
    if (pKey && !freshP && !seen.includes(pKey)) markKey(pKey);
    if (cKey && !freshC && !seen.includes(cKey)) markKey(cKey);
  }, [pKey, cKey, freshP, freshC, seen, markKey]);

  // Avisos propios: comodín nuevo y turno propio
  const prevJokers = useRef<string[] | null>(null);
  useEffect(() => {
    const ids = view.me.jokers.map((j) => j.id);
    if (prevJokers.current && ids.some((i) => !prevJokers.current!.includes(i))) { sfx.joker(); toast("¡Te tocó un comodín nuevo!"); }
    prevJokers.current = ids;
  }, [view.me.jokers, toast]);
  const myTurnKey = turn?.challengeRevealed && turn.holderId === view.me.id ? `${turn.key}:${turn.chain?.length}` : null;
  const prevTurn = useRef<string | null>(null);
  useEffect(() => { if (myTurnKey && myTurnKey !== prevTurn.current && !showReveal) { sfx.turn(); if (navigator.vibrate) navigator.vibrate(60); } prevTurn.current = myTurnKey; }, [myTurnKey, showReveal]);

  // Sonido al entrar alguien nuevo a la sala de espera
  const prevCount = useRef(view.players.length);
  useEffect(() => { if (view.phase === "lobby" && view.players.length > prevCount.current) sfx.pop(); prevCount.current = view.players.length; }, [view.players.length, view.phase]);
  const screenKey = `${view.phase}:${view.round}:${turn?.key ?? ""}:${turn?.stage ?? ""}:${turn?.holderId ?? ""}:${turn?.revealed ? 1 : 0}`;

  // Estado en una frase, siempre visible
  const status = banner(view, name);
  const holderName = turn?.holderId ? name(turn.holderId) : "";

  return (
    <div className="shell">
      <header className="topbar">
        <button className="code-chip" onClick={() => setSheet("menu")} aria-label={`Sala ${view.code.split("").join(" ")}. Abrir menú`}>
          <Icon name="cards" size={18} /> {view.code}
        </button>
        <div className="top-actions">
          <button className={`icon-btn joker-btn${view.me.jokers.length ? " has" : ""}`} onClick={() => setSheet("jokers")} aria-label={`Mis comodines: ${view.me.jokers.length}`}>
            <Icon name="star" /><span key={view.me.jokers.length} className="badge">{view.me.jokers.length}</span>
          </button>
          <button className="icon-btn" onClick={() => setSheet("history")} aria-label="Historial de turnos"><Icon name="history" /></button>
          <button className="icon-btn" onClick={toggleSound} aria-label={sound ? "Silenciar sonidos" : "Activar sonidos"} aria-pressed={sound}><Icon name={sound ? "sound" : "mute"} /></button>
          <button className="icon-btn" onClick={() => setSheet("menu")} aria-label="Menú"><Icon name="menu" /></button>
        </div>
      </header>
      {!online && <div className="offline" role="status"><Icon name="clock" size={16} /> Sin conexión. Reconectando… tu lugar sigue guardado.</div>}

      <main className="page">
        <div key={status.title} className={`banner ${status.tone}`} role="status" aria-live="polite">
          <span className="banner-ic"><Icon name={status.icon} size={22} /></span>
          <div><p className="banner-t">{status.title}</p>{status.sub && <p className="banner-s">{status.sub}</p>}</div>
        </div>
        {view.me.jokers.length > 0 && view.phase !== "ended" && (
          <button className="joker-strip" onClick={() => setSheet("jokers")}>
            <span className="eyebrow" style={{ margin: 0 }}>Tus comodines</span>
            {view.me.jokers.map((j) => <JokerChip key={j.id} type={j.type} />)}
          </button>
        )}
        <div key={screenKey} className="screen">
          {view.phase === "lobby" && <Lobby c={c} />}
          {view.phase === "writing" && <Writing c={c} />}
          {view.phase === "turn" && turn && (turn.revealed ? (showReveal ? <p className="muted center">Revelando…</p> : <Revealed c={c} turn={turn} />) : <Voting c={c} turn={turn} />)}
          {view.phase === "summary" && view.summary && <Summary c={c} />}
          {view.phase === "ended" && view.final && <Final c={c} />}
        </div>
      </main>

      {showReveal && turn && reveal && <Reveal key={reveal.key} kind={reveal.kind} turn={turn} holderName={holderName} onClose={markSeen} />}

      {view.paused && (
        <div className="pause" role="alertdialog" aria-label="Partida en pausa">
          <div className="panel center"><Icon name="pause" size={36} /><h2 className="h1">Partida en pausa</h2>
            <p className="muted">{view.pausedBy ? `${name(view.pausedBy)} pausó la partida.` : ""}</p>
            {view.me.active ? <button className="btn btn-primary btn-xl" onClick={() => send({ type: "resume" })}><Icon name="play" />Reanudar</button> : <p className="muted">Esperando que alguien reanude.</p>}
          </div>
        </div>
      )}

      {sheet && (
        <div className="sheet-backdrop" onClick={() => setSheet(null)}>
          <div className="sheet" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <button className="sheet-close icon-btn" onClick={() => setSheet(null)} aria-label="Cerrar"><Icon name="x" /></button>
            {sheet === "jokers" && (
              <>
                <h2 className="h1">Tus comodines</h2>
                <p className="muted small">Solo vos los ves. Se usan cuando te toca un reto.</p>
                {view.me.jokers.length === 0 ? <p className="panel">No tenés comodines ahora. Al terminar cada ronda se reparte uno nuevo al azar.</p> :
                  view.me.jokers.map((j) => <div className="panel" key={j.id}><JokerChip type={j.type} /><p className="muted small">{JOKER_INFO[j.type]}</p></div>)}
              </>
            )}
            {sheet === "history" && (
              <>
                <h2 className="h1">Historial</h2>
                {view.history.length === 0 ? <p className="muted">Todavía no se resolvió ningún reto.</p> : (
                  <ol className="history">{view.history.map((h) => (
                    <li key={h.id}>
                      <p className="eyebrow">Ronda {h.round} · reto {h.n}{h.tied ? " · salió por sorteo" : ""}</p>
                      <p><strong>{h.subjects.join(" + ")}</strong>: {h.challenge}</p>
                      <p className="muted small">{h.kind === "done" ? "Cumplió el reto" : h.kind === "alt" ? `Cumplió la prenda «${h.text}»` : "Se retiró"}</p>
                      {h.events.map((e, i) => <p key={i} className="muted small">· {e}</p>)}
                    </li>))}</ol>)}
              </>
            )}
            {sheet === "menu" && (
              <>
                <h2 className="h1">Menú</h2>
                <div className="panel">
                  <h3 className="h2">Jugadores</h3>
                  <ul className="pills">{view.players.map((p) => <li key={p.id} className={`pill${p.connected ? "" : " is-off"}`}><span className="pill-dot" aria-hidden="true" /><span className="pill-name">{p.name}{p.id === view.me.id ? " (vos)" : ""}</span>{!p.connected && <span className="pill-badge muted">sin conexión</span>}{!p.active && <span className="pill-badge muted">entra en la próxima ronda</span>}<span className="pill-score">{p.score} pts</span></li>)}</ul>
                </div>
                <div className="panel">
                  <h3 className="h2">Ajustes</h3>
                  <button className="toggle" role="switch" aria-checked={sound} onClick={toggleSound}><span>Sonidos</span><b>{sound ? "Activados" : "Desactivados"}</b></button>
                  <button className="toggle" role="switch" aria-checked={reduced} onClick={toggleMotion}><span>Reducir movimiento</span><b>{reduced ? "Activado" : "Desactivado"}</b></button>
                </div>
                {view.phase !== "ended" && view.phase !== "lobby" && view.me.active && (
                  <div className="panel">
                    <h3 className="h2">La mesa decide</h3>
                    <button className="btn btn-secondary" onClick={() => { void send({ type: view.paused ? "resume" : "pause" }); setSheet(null); }}><Icon name={view.paused ? "play" : "pause"} />{view.paused ? "Reanudar" : "Pausar la partida"}</button>
                    <button className="toggle" role="switch" aria-checked={view.me.endVote} onClick={() => send({ type: "voteEnd", on: !view.me.endVote })}>
                      <span>Votar para terminar la partida</span><b>{view.endVotes}/{Math.floor(view.activeCount / 2) + 1} votos</b>
                    </button>
                    <p className="muted small" style={{ marginBottom: 0 }}>Termina cuando más de la mitad vota que sí.</p>
                  </div>
                )}
                {["lobby", "writing", "summary"].includes(view.phase) && (
                  <button className="btn btn-ghost" onClick={() => { void send({ type: "leave" }).then(() => onLeave()); }}>Irme de la sala</button>
                )}
                <button className="btn btn-ghost" onClick={onLeave}>Salir de esta sala en este celular</button>
              </>
            )}
          </div>
        </div>
      )}

      <div className="toasts" role="status" aria-live="polite">{toasts.map((t) => <div key={t.id} className="toast">{t.m}</div>)}</div>
    </div>
  );
}

function banner(v: RoomView, name: (id?: string | null) => string): { title: string; sub?: string; icon: "clock" | "star" | "check" | "cards" | "eye" | "pause" | "flag"; tone: string } {
  if (v.paused) return { title: "Partida en pausa", sub: "Cualquiera puede reanudarla", icon: "pause", tone: "wait" };
  const t = v.turn;
  switch (v.phase) {
    case "lobby": return v.me.ready
      ? { title: "Listo: esperando a los demás", sub: `${v.readyCount} de ${v.players.length} listos`, icon: "clock", tone: "wait" }
      : { title: "Tocá “listo” para empezar", sub: `${v.players.length}/${LIMITS.maxPlayers} jugadores · arranca cuando todos estén listos`, icon: "cards", tone: "go" };
    case "writing":
      if (!v.me.active) return { title: "Entrás en la próxima ronda", icon: "eye", tone: "wait" };
      return v.me.myChallenge
        ? { title: "Reto enviado: esperando retos", sub: `Listos ${v.writtenCount} de ${v.activeCount}`, icon: "clock", tone: "wait" }
        : { title: "Tu turno: escribí tu reto", sub: `Ronda ${v.round} · en privado, nadie sabe quién lo escribió`, icon: "star", tone: "go" };
    case "turn": {
      if (!t) return { title: "Cargando turno", icon: "clock", tone: "wait" };
      if (!t.revealed) {
        const left = v.players.filter((p) => p.active && !t.voted.includes(p.id)).length;
        return t.myVote !== null || !v.me.active
          ? { title: `Faltan ${left} ${left === 1 ? "voto" : "votos"}`, sub: `Turno ${t.n} de ${v.roundSize} · paso 1 de 2: a quién le toca`, icon: "clock", tone: "wait" }
          : { title: "Tu turno: votá una carta", sub: `Turno ${t.n} de ${v.roundSize} · paso 1 de 2: a quién le toca (nadie sabe quién está detrás)`, icon: "star", tone: "go" };
      }
      if (t.stage === "picking") {
        const voters = t.pickVoters ?? [];
        const left2 = voters.filter((id) => !(t.pickVoted ?? []).includes(id)).length;
        if (t.holderId === v.me.id) return { title: "Los demás eligen tu reto", sub: `Paso 2 de 2 · faltan ${left2} ${left2 === 1 ? "voto" : "votos"}`, icon: "clock", tone: "wait" };
        return voters.includes(v.me.id) && t.myPick === null
          ? { title: `Tu turno: votá el reto de ${name(t.holderId)}`, sub: "Paso 2 de 2 · cada carta esconde un reto", icon: "star", tone: "go" }
          : { title: `Faltan ${left2} ${left2 === 1 ? "voto" : "votos"} del reto`, sub: `Paso 2 de 2 · reto de ${name(t.holderId)}`, icon: "clock", tone: "wait" };
      }
      const me = t.holderId === v.me.id;
      if (t.stage === "choosing") return me ? { title: "¡Te tocó! Tu turno", sub: "Elegí cómo resolverlo", icon: "star", tone: "go" } : { title: `Turno de ${name(t.holderId)}`, sub: "Esperando que decida", icon: "clock", tone: "wait" };
      if (t.stage === "altVoting") return t.alt?.eligible.includes(v.me.id) && t.alt.myVote === null ? { title: "Tu turno: votá la prenda", sub: "Todos tienen que aceptarla", icon: "star", tone: "go" } : { title: "Faltan votos de la prenda", sub: `${t.alt?.voted.length ?? 0} de ${t.alt?.eligible.length ?? 0}`, icon: "clock", tone: "wait" };
      return t.judgeId === v.me.id ? { title: "Sos el árbitro: confirmá la resolución", sub: "Te sorteó el azar para este turno", icon: "flag", tone: "go" } : { title: "Esperando confirmación", sub: `Del árbitro sorteado: ${name(t.judgeId)}`, icon: "clock", tone: "wait" };
    }
    case "summary": return v.me.ready
      ? { title: `Ronda ${v.round} terminada`, sub: `Esperando a los demás (${v.readyCount} de ${v.players.length} listos)`, icon: "clock", tone: "wait" }
      : { title: `Ronda ${v.round} terminada`, sub: "Tocá “seguimos” cuando estés listo", icon: "check", tone: "go" };
    default: return { title: "Partida terminada", icon: "flag", tone: "info" };
  }
}
