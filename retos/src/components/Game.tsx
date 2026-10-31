"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ApiError, api, lastName, saveName } from "@/lib/client";
import { sfx } from "@/lib/sfx";
import { useRoom } from "@/lib/useRoom";
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
  const [seenReveal, setSeenRevealState] = useState<string | null>(() => { try { return sessionStorage.getItem(seenKey); } catch { return null; } });
  const setSeenReveal = useCallback((k: string) => { setSeenRevealState(k); try { sessionStorage.setItem(seenKey, k); } catch { /* */ } }, [seenKey]);
  const names = useMemo(() => new Map(view.players.map((p) => [p.id, p.name])), [view.players]);
  const name = useCallback((id: string | null | undefined) => (id ? names.get(id) ?? "alguien" : "alguien"), [names]);
  const c: Ctx = { view, send, busy, toast, name };
  const turn = view.turn;

  // Revelación: solo si es reciente (quien reconecta tarde no la repite).
  const revealKey = turn?.revealed ? turn.key : null;
  const fresh = !!turn?.revealedAt && view.serverNow - turn.revealedAt < 8000;
  const showReveal = !!turn && !!revealKey && seenReveal !== revealKey && fresh;
  const markSeen = useCallback(() => { if (revealKey) setSeenReveal(revealKey); }, [revealKey, setSeenReveal]);
  useEffect(() => { if (revealKey && !fresh) setSeenReveal(revealKey); }, [revealKey, fresh, setSeenReveal]);

  // Avisos propios: comodín nuevo y turno propio
  const prevJokers = useRef<string[] | null>(null);
  useEffect(() => {
    const ids = view.me.jokers.map((j) => j.id);
    if (prevJokers.current && ids.some((i) => !prevJokers.current!.includes(i))) { sfx.joker(); toast("¡Te tocó un comodín nuevo!"); }
    prevJokers.current = ids;
  }, [view.me.jokers, toast]);
  const myTurnKey = turn?.revealed && turn.holderId === view.me.id ? `${turn.key}:${turn.chain?.length}` : null;
  const prevTurn = useRef<string | null>(null);
  useEffect(() => { if (myTurnKey && myTurnKey !== prevTurn.current && !showReveal) { sfx.turn(); if (navigator.vibrate) navigator.vibrate(60); } prevTurn.current = myTurnKey; }, [myTurnKey, showReveal]);

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
            <Icon name="star" /><span className="badge">{view.me.jokers.length}</span>
          </button>
          <button className="icon-btn" onClick={() => setSheet("history")} aria-label="Historial de turnos"><Icon name="history" /></button>
          <button className="icon-btn" onClick={toggleSound} aria-label={sound ? "Silenciar sonidos" : "Activar sonidos"} aria-pressed={sound}><Icon name={sound ? "sound" : "mute"} /></button>
          <button className="icon-btn" onClick={() => setSheet("menu")} aria-label="Menú"><Icon name="menu" /></button>
        </div>
      </header>
      {!online && <div className="offline" role="status"><Icon name="clock" size={16} /> Sin conexión. Reconectando… tu lugar sigue guardado.</div>}

      <main className="page">
        <div className={`banner ${status.tone}`} role="status" aria-live="polite">
          <span className="banner-ic"><Icon name={status.icon} size={22} /></span>
          <div><p className="banner-t">{status.title}</p>{status.sub && <p className="banner-s">{status.sub}</p>}</div>
        </div>
        {view.me.jokers.length > 0 && view.phase !== "ended" && (
          <button className="joker-strip" onClick={() => setSheet("jokers")}>
            <span className="eyebrow" style={{ margin: 0 }}>Tus comodines</span>
            {view.me.jokers.map((j) => <JokerChip key={j.id} type={j.type} />)}
          </button>
        )}
        {view.phase === "lobby" && <Lobby c={c} />}
        {view.phase === "writing" && <Writing c={c} />}
        {view.phase === "turn" && turn && (turn.revealed ? (showReveal ? <p className="muted center">Revelando…</p> : <Revealed c={c} turn={turn} />) : <Voting c={c} turn={turn} />)}
        {view.phase === "summary" && view.summary && <Summary c={c} />}
        {view.phase === "ended" && view.final && <Final c={c} />}
      </main>

      {showReveal && turn && <Reveal turn={turn} holderName={holderName} onClose={markSeen} />}

      {view.paused && (
        <div className="pause" role="alertdialog" aria-label="Partida en pausa">
          <div className="panel center"><Icon name="pause" size={36} /><h2 className="h1">Partida en pausa</h2>
            {view.me.isHost ? <button className="btn btn-primary btn-xl" onClick={() => send({ type: "resume" })}><Icon name="play" />Reanudar</button> : <p className="muted">Esperando que {name(view.hostId)} reanude.</p>}
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
                  <ul className="pills">{view.players.map((p) => <li key={p.id} className={`pill${p.connected ? "" : " is-off"}`}><span className="pill-dot" aria-hidden="true" /><span className="pill-name">{p.name}{p.id === view.me.id ? " (vos)" : ""}</span>{p.isHost && <span className="pill-badge"><Icon name="crown" size={13} />Anfitrión</span>}{!p.connected && <span className="pill-badge muted">sin conexión</span>}{!p.active && <span className="pill-badge muted">entra en la próxima ronda</span>}<span className="pill-score">{p.score} pts</span></li>)}</ul>
                </div>
                <div className="panel">
                  <h3 className="h2">Ajustes</h3>
                  <button className="toggle" role="switch" aria-checked={sound} onClick={toggleSound}><span>Sonidos</span><b>{sound ? "Activados" : "Desactivados"}</b></button>
                  <button className="toggle" role="switch" aria-checked={reduced} onClick={toggleMotion}><span>Reducir movimiento</span><b>{reduced ? "Activado" : "Desactivado"}</b></button>
                </div>
                {view.me.isHost && view.phase !== "ended" && (
                  <div className="panel">
                    <h3 className="h2">Anfitrión</h3>
                    {view.phase !== "lobby" && <button className="btn btn-secondary" onClick={() => { void send({ type: view.paused ? "resume" : "pause" }); setSheet(null); }}><Icon name={view.paused ? "play" : "pause"} />{view.paused ? "Reanudar" : "Pausar la partida"}</button>}
                    {view.phase !== "lobby" && <EndButton onEnd={() => { void send({ type: "end" }); setSheet(null); }} />}
                    {["writing", "summary"].includes(view.phase) && <p className="muted small">Para sacar a alguien, usá la lista en la sala de espera o esperá al próximo turno.</p>}
                  </div>
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

function EndButton({ onEnd }: { onEnd: () => void }) {
  const [ask, setAsk] = useState(false);
  return ask ? (
    <div className="row gap"><button className="btn btn-ghost" onClick={() => setAsk(false)}>No</button><button className="btn btn-danger" onClick={onEnd}>Sí, terminar la partida</button></div>
  ) : <button className="btn btn-ghost" onClick={() => setAsk(true)}><Icon name="flag" />Finalizar la partida</button>;
}

function banner(v: RoomView, name: (id?: string | null) => string): { title: string; sub?: string; icon: "clock" | "star" | "check" | "cards" | "eye" | "pause" | "flag"; tone: string } {
  const host = name(v.hostId);
  if (v.paused) return { title: "Partida en pausa", sub: v.me.isHost ? "Podés reanudarla desde el menú." : `Esperando que ${host} reanude`, icon: "pause", tone: "wait" };
  const t = v.turn;
  switch (v.phase) {
    case "lobby": return { title: v.me.isHost ? "Armá la mesa" : "Sala de espera", sub: `${v.players.length} ${v.players.length === 1 ? "jugador" : "jugadores"} · compartí el código`, icon: "cards", tone: "info" };
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
          ? { title: `Faltan ${left} ${left === 1 ? "voto" : "votos"}`, sub: `Reto ${t.n} de ${v.roundSize}`, icon: "clock", tone: "wait" }
          : { title: "Tu turno: votá una carta", sub: `Reto ${t.n} de ${v.roundSize} · nadie sabe quién está detrás`, icon: "star", tone: "go" };
      }
      const me = t.holderId === v.me.id;
      if (t.stage === "choosing") return me ? { title: "¡Te tocó! Tu turno", sub: "Elegí cómo resolverlo", icon: "star", tone: "go" } : { title: `Turno de ${name(t.holderId)}`, sub: "Esperando que decida", icon: "clock", tone: "wait" };
      if (t.stage === "altVoting") return t.alt?.eligible.includes(v.me.id) && t.alt.myVote === null ? { title: "Tu turno: votá la prenda", sub: "Todos tienen que aceptarla", icon: "star", tone: "go" } : { title: "Faltan votos de la prenda", sub: `${t.alt?.voted.length ?? 0} de ${t.alt?.eligible.length ?? 0}`, icon: "clock", tone: "wait" };
      return v.me.isHost ? { title: "Tu turno: confirmá la resolución", sub: "El anfitrión confirma antes de avanzar", icon: "flag", tone: "go" } : { title: "Esperando confirmación", sub: `De ${host}`, icon: "clock", tone: "wait" };
    }
    case "summary": return { title: `Ronda ${v.round} terminada`, sub: v.me.isHost ? "Empezá la siguiente cuando quieran" : `Esperando que ${host} siga`, icon: "check", tone: "info" };
    default: return { title: "Partida terminada", icon: "flag", tone: "info" };
  }
}
