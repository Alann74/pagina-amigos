"use client";
import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import { sfx } from "@/lib/sfx";
import { LIMITS } from "@/lib/types";
import type { Action, RoomView, ViewPlayer, ViewTurn } from "@/lib/types";
import { CardBack, JOKER_INFO, JokerChip } from "./Cards";
import { Icon } from "./Icon";

export interface Ctx {
  view: RoomView;
  send: (a: Action) => Promise<string | null>;
  busy: boolean;
  toast: (m: string) => void;
  name: (id: string | null | undefined) => string;
}
const PLACEHOLDERS = ["Imitar a un profesor durante un minuto", "Hablar con acento extranjero hasta el próximo turno", "Dejar que otro escriba un mensaje desde tu celular", "Hacer 10 sentadillas cantando", "Contar tu papelón más grande"];

function Pill({ p, extra }: { p: ViewPlayer; extra?: React.ReactNode }) {
  return (
    <li className={`pill${p.connected ? "" : " is-off"}`}>
      <span className="pill-dot" aria-hidden="true" />
      <span className="pill-name">{p.name}</span>
      {p.isHost && <span className="pill-badge"><Icon name="crown" size={13} />Anfitrión</span>}
      {!p.connected && <span className="pill-badge muted">sin conexión</span>}
      {extra}
    </li>
  );
}

// ---------------- Sala de espera ----------------
export function Lobby({ c }: { c: Ctx }) {
  const { view, send, busy } = c;
  const [qr, setQr] = useState("");
  const url = typeof window !== "undefined" ? `${location.origin}/sala/${view.code}` : "";
  useEffect(() => {
    if (!url) return;
    QRCode.toDataURL(url, { margin: 1, width: 240, color: { dark: "#191329", light: "#FFF4E6" } }).then(setQr).catch(() => {});
  }, [url]);
  const share = async () => {
    try {
      if (navigator.share) await navigator.share({ title: "Boca Abajo", text: `Entrá a mi sala: ${view.code}`, url });
      else { await navigator.clipboard.writeText(url); c.toast("Enlace copiado"); }
    } catch { /* cancelado */ }
  };
  const enough = view.players.length >= LIMITS.minPlayers;
  return (
    <section className="stack">
      <div className="panel center">
        <p className="eyebrow">Código de sala</p>
        <div className="code" role="img" aria-label={`Código ${view.code.split("").join(" ")}`}>{view.code.split("").map((ch, i) => <span key={i}>{ch}</span>)}</div>
        <div className="row wrap gap center">
          <button className="btn btn-secondary" onClick={share}><Icon name="share" />Compartir enlace</button>
          <button className="btn btn-ghost" onClick={() => navigator.clipboard?.writeText(url).then(() => c.toast("Enlace copiado")).catch(() => {})}><Icon name="copy" />Copiar</button>
        </div>
        {qr && <img className="qr" src={qr} width={140} height={140} alt={`Código QR para entrar a la sala ${view.code}`} />}
      </div>

      <div className="panel">
        <h2 className="h2">En la sala <span className="count">{view.players.length}</span></h2>
        <ul className="pills">{view.players.map((p) => <Pill key={p.id} p={p} extra={view.me.isHost && !p.isHost && (
          <button className="pill-x" aria-label={`Sacar a ${p.name}`} onClick={() => send({ type: "kick", playerId: p.id })}><Icon name="x" size={14} /></button>)} />)}</ul>
      </div>

      {view.me.isHost ? (
        <div className="panel">
          <h2 className="h2">Comodines al empezar</h2>
          <p className="muted">Se reparten al azar entre todos, en total. Cada dueño ve los suyos en privado.</p>
          <div className="seg" role="radiogroup" aria-label="Cantidad de comodines">
            {[1, 2].map((n) => (
              <button key={n} role="radio" aria-checked={view.startJokers === n} className={view.startJokers === n ? "on" : ""} disabled={busy}
                onClick={() => send({ type: "setSettings", startJokers: n as 1 | 2 })}>{n === 1 ? "1 comodín" : "2 comodines"}</button>
            ))}
          </div>
        </div>
      ) : (
        <p className="muted center">El anfitrión elige cuántos comodines se reparten.</p>
      )}

      <div className="dock">
        {view.me.isHost ? (
          <>
            {!enough && <p className="hint">Faltan {LIMITS.minPlayers - view.players.length} para poder empezar (mínimo {LIMITS.minPlayers}).</p>}
            <button className="btn btn-primary btn-xl" disabled={!enough || busy} onClick={() => { sfx.ok(); void send({ type: "start" }).then((e) => e && c.toast(e)); }}>Empezar la partida</button>
          </>
        ) : <p className="hint"><Icon name="clock" size={16} /> Esperando que {c.name(view.hostId)} empiece</p>}
      </div>
    </section>
  );
}

// ---------------- Escritura de retos ----------------
export function Writing({ c }: { c: Ctx }) {
  const { view, send, busy } = c;
  const [text, setText] = useState("");
  const [editing, setEditing] = useState(false);
  const ph = useMemo(() => PLACEHOLDERS[Math.floor(Math.random() * PLACEHOLDERS.length)], []);
  const mine = view.me.myChallenge;
  const active = view.players.filter((p) => p.active);
  const submit = async () => {
    const e = await send({ type: "submitChallenge", text });
    if (e) c.toast(e); else { sfx.vote(); setEditing(false); }
  };
  return (
    <section className="stack">
      {!view.me.active ? (
        <div className="panel center"><p className="h2">Entrás en la próxima ronda</p><p className="muted">La ronda ya está en juego. Mirá desde acá y sumate después.</p></div>
      ) : mine && !editing ? (
        <div className="panel">
          <p className="eyebrow"><Icon name="check" size={14} /> Tu reto (solo vos lo ves)</p>
          <p className="quote">{mine}</p>
          <button className="btn btn-ghost" onClick={() => { setText(mine); setEditing(true); }}>Cambiarlo</button>
        </div>
      ) : (
        <form className="panel" onSubmit={(e) => { e.preventDefault(); void submit(); }}>
          <label htmlFor="reto" className="h2">Escribí tu reto en privado</label>
          <p className="muted">Nadie sabrá que lo escribiste vos. Pensá algo divertido que cualquiera de la sala pueda cumplir.</p>
          <textarea id="reto" className="input" rows={4} maxLength={LIMITS.challenge} value={text} placeholder={ph} onChange={(e) => setText(e.target.value)} />
          <div className="row between"><span className="muted small">{text.length}/{LIMITS.challenge}</span></div>
          <button className="btn btn-primary btn-xl" type="submit" disabled={busy || text.trim().length < 3}>{mine ? "Guardar cambio" : "Enviar reto"}</button>
        </form>
      )}
      <div className="panel">
        <h2 className="h2">Retos listos <span className="count">{view.writtenCount}/{view.activeCount}</span></h2>
        <ul className="pills">{active.map((p) => <Pill key={p.id} p={p} extra={<span className={`pill-badge ${p.written ? "ok" : "muted"}`}>{p.written ? <><Icon name="check" size={13} />listo</> : <><Icon name="clock" size={13} />escribiendo</>}</span>} />)}</ul>
        {view.me.isHost && view.writtenCount >= 2 && view.writtenCount < view.activeCount && (
          <button className="btn btn-ghost" disabled={busy} onClick={() => send({ type: "forceVoting" }).then((e) => e && c.toast(e))}>Seguir sin esperar a los que faltan</button>
        )}
      </div>
    </section>
  );
}

// ---------------- Votación ----------------
export function Voting({ c, turn }: { c: Ctx; turn: ViewTurn }) {
  const { view, send, busy } = c;
  const [sel, setSel] = useState<number | null>(null);
  const voted = turn.myVote !== null;
  const canVote = view.me.active && !voted;
  const pending = view.players.filter((p) => p.active && !turn.voted.includes(p.id));
  return (
    <section className="stack">
      <div className="mystery panel center">
        <div className="mystery-card" aria-hidden="true">?</div>
        <div>
          <p className="eyebrow">Reto {turn.n} de {view.roundSize}</p>
          <p className="h2" style={{ margin: 0 }}>Reto misterioso</p>
          <p className="muted small">Se muestra al revelar la carta elegida.</p>
        </div>
      </div>
      <div className="cards" role="group" aria-label="Cartas boca abajo">
        {Array.from({ length: turn.cardCount }, (_, i) => i + 1).map((n) => (
          <CardBack key={n} n={n} dealt={n} selected={canVote && sel === n} voted={turn.myVote === n}
            onClick={canVote ? () => { setSel(n); sfx.tap(); } : undefined} disabled={busy} />
        ))}
      </div>
      {!view.me.active && <p className="hint">Mirás esta ronda desde afuera. Entrás en la próxima.</p>}
      <div className="dock">
        {voted ? (
          <p className="hint"><Icon name="check" size={16} /> Votaste la carta {turn.myVote}. {pending.length ? `Faltan ${pending.length} ${pending.length === 1 ? "voto" : "votos"}: ${pending.map((p) => p.name).join(", ")}` : ""}</p>
        ) : canVote ? (
          <button className="btn btn-primary btn-xl" disabled={sel === null || busy} onClick={async () => { const e = await send({ type: "vote", turnKey: turn.key, card: sel! }); if (e) c.toast(e); else sfx.vote(); }}>
            {sel === null ? "Tocá una carta para votar" : `Votar la carta ${sel}`}
          </button>
        ) : null}
        {view.me.isHost && pending.length > 0 && (
          <button className="btn btn-ghost" disabled={busy} onClick={() => send({ type: "closeVoting", turnKey: turn.key }).then((e) => e && c.toast(e))}>Cerrar la votación ya ({turn.voted.length} {turn.voted.length === 1 ? "voto" : "votos"})</button>
        )}
      </div>
    </section>
  );
}

// ---------------- Turno revelado ----------------
export function Revealed({ c, turn }: { c: Ctx; turn: ViewTurn }) {
  const { view, send, busy } = c;
  const [mode, setMode] = useState<"menu" | "alt" | "joker" | "retire">("menu");
  const [alt, setAlt] = useState("");
  const [target, setTarget] = useState<string | null>(null);
  const holder = turn.holderId!;
  const isHolder = holder === view.me.id;
  const isHost = view.me.isHost;
  const opts = turn.options!;
  const run = async (a: Action, ok?: () => void) => { const e = await send(a); if (e) c.toast(e); else { ok?.(); setMode("menu"); } };
  useEffect(() => { setMode("menu"); setAlt(""); setTarget(null); }, [turn.key, turn.stage, holder]);
  const res = turn.resolution;
  const resText = res ? (res.kind === "done" ? `${c.name(holder)} va a cumplir el reto.` : res.kind === "alt" ? `${c.name(holder)} hará la prenda: «${res.text}»` : `${c.name(holder)} se retira de este reto.`) : "";

  return (
    <section className="stack">
      <div className="face panel">
        <div className="face-head">
          <span className="face-num" aria-label={`Carta ${turn.winnerCard}`}>#{turn.winnerCard}</span>
          <div>
            <p className="eyebrow">Reto {turn.n} de {view.roundSize}{turn.shared ? " · compartido" : ""}</p>
            <p className="face-name">{c.name(holder)}{turn.shared && turn.partnerId ? ` + ${c.name(turn.partnerId)}` : ""}</p>
          </div>
        </div>
        <p className="face-challenge">{turn.challenge}</p>
        {turn.events && turn.events.length > 0 && (
          <ul className="events">{turn.events.map((e, i) => <li key={i}>{e}</li>)}</ul>
        )}
      </div>

      {turn.stage === "choosing" && (
        isHolder ? (
          <div className="stack">
            {mode === "menu" && (
              <div className="dock stack-tight">
                <button className="btn btn-primary btn-xl" disabled={busy} onClick={() => run({ type: "fulfill", turnKey: turn.key }, () => sfx.ok())}><Icon name="check" />Cumplir el reto</button>
                <button className="btn btn-secondary" disabled={busy} onClick={() => setMode("alt")}><Icon name="gift" />Proponer otra prenda</button>
                {(opts.canPass || opts.canBounce) && <button className="btn btn-joker" disabled={busy} onClick={() => setMode("joker")}><Icon name="star" />Usar un comodín</button>}
                <button className="btn btn-ghost" disabled={busy} onClick={() => setMode("retire")}><Icon name="flag" />Retirarme del reto</button>
              </div>
            )}
            {mode === "alt" && (
              <form className="panel" onSubmit={(e) => { e.preventDefault(); void run({ type: "propose", turnKey: turn.key, text: alt }); }}>
                <label htmlFor="alt" className="h2">Tu prenda alternativa</label>
                <p className="muted">Todos los demás tienen que aceptarla. Si alguien la rechaza, podés proponer otra o elegir otra salida.</p>
                <textarea id="alt" className="input" rows={3} maxLength={LIMITS.alt} value={alt} onChange={(e) => setAlt(e.target.value)} placeholder="Ej: invitar la próxima ronda" />
                <div className="row gap"><button type="button" className="btn btn-ghost" onClick={() => setMode("menu")}>Volver</button>
                  <button type="submit" className="btn btn-primary" disabled={busy || alt.trim().length < 3}>Proponer</button></div>
              </form>
            )}
            {mode === "joker" && (
              <div className="panel">
                <h2 className="h2">Elegí un comodín</h2>
                {opts.canBounce && (
                  <div className="joker-opt">
                    <JokerChip type="bounce" /><p className="muted small">{JOKER_INFO.bounce}</p>
                    <button className="btn btn-joker" disabled={busy} onClick={() => run({ type: "useJoker", turnKey: turn.key, joker: "bounce" }, () => sfx.joker())}>Usar Rebote</button>
                  </div>
                )}
                {opts.canPass && (
                  <div className="joker-opt">
                    <JokerChip type="pass" /><p className="muted small">{JOKER_INFO.pass}</p>
                    <div className="targets" role="radiogroup" aria-label="Pasar el reto a">
                      {opts.passTargets.map((id) => <button key={id} role="radio" aria-checked={target === id} className={`target${target === id ? " on" : ""}`} onClick={() => setTarget(id)}>{target === id && <Icon name="check" size={14} />}{c.name(id)}</button>)}
                    </div>
                    <button className="btn btn-joker" disabled={busy || !target} onClick={() => run({ type: "useJoker", turnKey: turn.key, joker: "pass", target: target! }, () => sfx.joker())}>{target ? `Pasárselo a ${c.name(target)}` : "Elegí a quién"}</button>
                  </div>
                )}
                <button className="btn btn-ghost" onClick={() => setMode("menu")}>Volver</button>
              </div>
            )}
            {mode === "retire" && (
              <div className="panel center">
                <p className="h2">¿Seguro que te retirás?</p>
                <p className="muted">Se anota como retiro. No suma puntos.</p>
                <div className="row gap center"><button className="btn btn-ghost" onClick={() => setMode("menu")}>No, volver</button>
                  <button className="btn btn-danger" disabled={busy} onClick={() => run({ type: "withdraw", turnKey: turn.key })}>Sí, me retiro</button></div>
              </div>
            )}
            {turn.altRejected && turn.altRejected.length > 0 && <p className="hint"><Icon name="x" size={16} /> Rechazadas: {turn.altRejected.map((t) => `«${t}»`).join(", ")}</p>}
          </div>
        ) : (
          <div className="dock">
            <p className="hint"><Icon name="clock" size={16} /> Esperando que {c.name(holder)} decida{turn.altRejected && turn.altRejected.length > 0 ? " (rechazaron su última prenda)" : ""}</p>
            {isHost && <button className="btn btn-ghost" disabled={busy} onClick={() => send({ type: "hostSkip", turnKey: turn.key })}>No responde: registrar retiro</button>}
          </div>
        )
      )}

      {turn.stage === "altVoting" && turn.alt && (
        <div className="stack">
          <div className="panel alt">
            <p className="eyebrow"><Icon name="gift" size={14} /> Prenda alternativa de {c.name(turn.alt.proposerId)}</p>
            <p className="quote">{turn.alt.text}</p>
            <p className="muted small">Votaron {turn.alt.voted.length} de {turn.alt.eligible.length}. Hace falta que todos acepten.</p>
          </div>
          <div className="dock stack-tight">
            {turn.alt.eligible.includes(view.me.id) ? (
              turn.alt.myVote === null ? (
                <div className="row gap">
                  <button className="btn btn-primary btn-xl grow" disabled={busy} onClick={() => run({ type: "altVote", turnKey: turn.key, accept: true }, () => sfx.ok())}><Icon name="check" />Acepto</button>
                  <button className="btn btn-secondary btn-xl grow" disabled={busy} onClick={() => run({ type: "altVote", turnKey: turn.key, accept: false }, () => sfx.no())}><Icon name="x" />Rechazo</button>
                </div>
              ) : <p className="hint"><Icon name="check" size={16} /> Tu voto: {turn.alt.myVote ? "aceptaste" : "rechazaste"}. Esperando al resto.</p>
            ) : <p className="hint"><Icon name="clock" size={16} /> {isHolder ? "Esperando que voten tu prenda" : "No votás esta prenda"}</p>}
            {isHost && <button className="btn btn-ghost" disabled={busy} onClick={() => send({ type: "altClose", turnKey: turn.key }).then((e) => e && c.toast(e))}>Cerrar votación con los votos emitidos</button>}
            {isHost && <button className="btn btn-ghost" disabled={busy} onClick={() => send({ type: "hostSkip", turnKey: turn.key })}>No responde: registrar retiro</button>}
          </div>
        </div>
      )}

      {turn.stage === "confirming" && (
        <div className="dock stack-tight">
          <p className="status-line"><Icon name="flag" size={16} /> {resText}</p>
          {isHost ? (
            <>
              <button className="btn btn-primary btn-xl" disabled={busy} onClick={() => run({ type: "confirm", turnKey: turn.key, outcome: "ok" }, () => sfx.ok())}>Confirmar y seguir</button>
              {res?.kind !== "withdraw" && <button className="btn btn-ghost" disabled={busy} onClick={() => run({ type: "confirm", turnKey: turn.key, outcome: "fail" })}>No lo cumplió: registrar retiro</button>}
            </>
          ) : <p className="hint"><Icon name="clock" size={16} /> Esperando que {c.name(view.hostId)} confirme cómo se resolvió</p>}
        </div>
      )}
    </section>
  );
}

// ---------------- Resumen y final ----------------
export function Summary({ c }: { c: Ctx }) {
  const { view, send, busy } = c;
  const s = view.summary!;
  return (
    <section className="stack">
      <div className="panel">
        <p className="eyebrow">Ronda {s.round} terminada</p>
        <h2 className="h1">{s.turns} retos resueltos</h2>
        <table className="table">
          <thead><tr><th scope="col">Jugador</th><th scope="col">Retos</th><th scope="col">Prendas</th><th scope="col">Retiros</th></tr></thead>
          <tbody>{s.rows.map((r) => <tr key={r.playerId}><th scope="row">{r.name}</th><td>{r.done}</td><td>{r.alt}</td><td>{r.withdrawn}</td></tr>)}</tbody>
        </table>
        <p className="muted small">Cuentan los retos cumplidos y las prendas alternativas cumplidas. Los retiros se anotan aparte.</p>
      </div>
      {s.jokerGranted && <div className="panel joker-note"><Icon name="star" /> Se repartió un comodín nuevo al azar. Si te tocó, lo ves en tu inventario.</div>}
      <div className="dock">
        {view.me.isHost ? <button className="btn btn-primary btn-xl" disabled={busy} onClick={() => send({ type: "nextRound" }).then((e) => e && c.toast(e))}>Empezar la ronda {s.round + 1}</button>
          : <p className="hint"><Icon name="clock" size={16} /> Esperando que {c.name(view.hostId)} empiece la ronda {s.round + 1}</p>}
      </div>
    </section>
  );
}

export function Final({ c }: { c: Ctx }) {
  const rows = c.view.final!.rows;
  return (
    <section className="stack">
      <div className="panel center"><p className="eyebrow">Fin de la partida</p><h2 className="h1">Así quedó la mesa</h2></div>
      <ol className="podium">
        {rows.map((r, i) => (
          <li key={r.playerId} className={i === 0 ? "first" : ""}>
            <span className="pos">{i + 1}º</span><span className="pname">{r.name}{r.playerId === c.view.me.id ? " (vos)" : ""}</span>
            <span className="pscore">{r.score} <small>pts</small></span>
            <span className="pdetail">{r.done} retos · {r.alt} prendas · {r.withdrawn} retiros</span>
          </li>
        ))}
      </ol>
      <a className="btn btn-primary btn-xl" href="/">Jugar otra partida</a>
    </section>
  );
}
