// Motor del juego: lógica pura y determinista (salvo el RNG inyectable). El servidor es la autoridad.
import { createHash, randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import { LIMITS } from "./types";
import type { Action, JokerType, Phase, ResolutionKind, Stage } from "./types";

export class GameError extends Error {
  constructor(public code: string, message: string, public status = 400) {
    super(message);
  }
}

export interface Rng {
  int(maxExclusive: number): number;
}
export const cryptoRng: Rng = { int: (n) => (n <= 1 ? 0 : randomInt(n)) };

export function shuffle<T>(arr: readonly T[], rng: Rng): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = rng.int(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export interface Joker { id: string; type: JokerType }
export interface Counters { done: number; alt: number; withdrawn: number }
export interface Player {
  id: string;
  name: string;
  tokenHash: string;
  active: boolean;
  joinedAt: number;
  jokers: Joker[];
  total: Counters;
  round: Counters;
  challenge: string | null;
}
export interface PoolChallenge { id: string; text: string; authorId: string }
export interface Turn {
  key: string;
  n: number;
  stage: Stage;
  challengeId: string;
  challengeText: string;
  cards: string[]; // cards[i] = jugador detrás de la carta i+1 (secreto hasta la revelación)
  votes: Record<string, number>;
  revealed: boolean;
  revealedAt?: number;
  winnerCard?: number;
  tally?: number[];
  tied?: number[];
  holderId?: string;
  originalId?: string;
  chain: string[];
  shared: boolean;
  partnerId: string | null;
  alt: { text: string; proposerId: string; votes: Record<string, boolean> } | null;
  altRejected: string[];
  resolution: { kind: ResolutionKind; text?: string } | null;
  events: string[];
}
export interface HistoryItem {
  id: number; round: number; n: number; challenge: string; subjects: string[];
  kind: ResolutionKind; text?: string; events: string[]; tied: boolean;
}
export interface Room {
  code: string;
  createdAt: number;
  hostId: string;
  startJokers: 1 | 2;
  phase: Phase;
  paused: boolean;
  round: number;
  roundSize: number;
  resolved: number;
  pool: PoolChallenge[];
  players: Player[];
  turn: Turn | null;
  history: HistoryItem[];
  summary: { round: number; rows: { playerId: string; name: string; done: number; alt: number; withdrawn: number }[]; turns: number; jokerGranted: boolean } | null;
  seq: number;
}

// ---------- utilidades ----------
export const newId = (bytes = 5) => randomBytes(bytes).toString("hex");
export const hashToken = (t: string) => createHash("sha256").update(t).digest("hex");
export function tokenMatches(player: Player, token: string): boolean {
  const a = Buffer.from(player.tokenHash, "hex");
  const b = Buffer.from(hashToken(token), "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Texto seguro: sin caracteres de control, ni marcas bidi/invisibles; espacios colapsados. */
export function cleanText(input: unknown, max: number): string {
  if (typeof input !== "string") return "";
  const s = input
    .normalize("NFC")
    .replace(/[\u0000-\u001F\u007F-\u009F​-‏‪-‮⁠-⁩﻿]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return Array.from(s).slice(0, max).join("").trim();
}

const CODE_ALPHABET = "BCDFGHJKLMNPQRSTVWXZ";
export function newRoomCode(rng: Rng = cryptoRng): string {
  return Array.from({ length: 4 }, () => CODE_ALPHABET[rng.int(CODE_ALPHABET.length)]).join("");
}
export function normalizeCode(c: string): string {
  return String(c ?? "").toUpperCase().replace(/[^A-Z]/g, "").slice(0, 4);
}

const zero = (): Counters => ({ done: 0, alt: 0, withdrawn: 0 });
export const activePlayers = (r: Room) => r.players.filter((p) => p.active);
export const getPlayer = (r: Room, id: string | undefined | null) => r.players.find((p) => p.id === id);
const nameOf = (r: Room, id: string | undefined | null) => getPlayer(r, id)?.name ?? "alguien";

export function createRoom(hostName: string, now: number, code: string, rng: Rng = cryptoRng) {
  void rng;
  const name = cleanText(hostName, LIMITS.name);
  if (!name) throw new GameError("name", "Elegí un nombre.");
  const token = randomBytes(24).toString("hex");
  const host = newPlayer(name, token, now);
  const room: Room = {
    code, createdAt: now, hostId: host.id, startJokers: 1, phase: "lobby", paused: false,
    round: 0, roundSize: 0, resolved: 0, pool: [], players: [host], turn: null, history: [], summary: null, seq: 0,
  };
  return { room, token, playerId: host.id };
}

function newPlayer(name: string, token: string, now: number): Player {
  return { id: newId(4), name, tokenHash: hashToken(token), active: true, joinedAt: now, jokers: [], total: zero(), round: zero(), challenge: null };
}

export function addPlayer(room: Room, rawName: string, now: number) {
  const name = cleanText(rawName, LIMITS.name);
  if (!name) throw new GameError("name", "Elegí un nombre.");
  if (room.phase === "ended") throw new GameError("ended", "Esta partida ya terminó.");
  if (room.players.length >= LIMITS.maxPlayers) throw new GameError("full", `La sala está llena (máximo ${LIMITS.maxPlayers} jugadores).`);
  if (room.players.some((p) => p.name.toLowerCase() === name.toLowerCase())) throw new GameError("name_taken", "Ese nombre ya está en uso en la sala.", 409);
  const token = randomBytes(24).toString("hex");
  const p = newPlayer(name, token, now);
  // Si la ronda está en juego, entra como espectador hasta la próxima ronda.
  p.active = room.phase === "lobby" || room.phase === "writing" || room.phase === "summary";
  room.players.push(p);
  return { token, playerId: p.id };
}

/** Recupera el lugar de un jugador desconectado (por nombre) rotando su credencial. */
export function reclaimPlayer(room: Room, rawName: string) {
  const name = cleanText(rawName, LIMITS.name).toLowerCase();
  const p = room.players.find((x) => x.name.toLowerCase() === name);
  if (!p) return null;
  const token = randomBytes(24).toString("hex");
  p.tokenHash = hashToken(token);
  return { token, playerId: p.id };
}

// ---------- flujo ----------
function dealJoker(room: Room, rng: Rng): { playerId: string; joker: Joker } | null {
  const act = activePlayers(room);
  if (!act.length) return null;
  const target = act[rng.int(act.length)];
  const joker: Joker = { id: newId(3), type: rng.int(2) === 0 ? "pass" : "bounce" };
  target.jokers.push(joker);
  return { playerId: target.id, joker };
}

function startRound(room: Room, startsFromLobby: boolean, rng: Rng) {
  room.round += 1;
  room.phase = "writing";
  room.pool = [];
  room.turn = null;
  room.summary = null;
  room.resolved = 0;
  for (const p of room.players) {
    p.active = true;
    p.challenge = null;
    p.round = zero();
  }
  if (startsFromLobby) for (let i = 0; i < room.startJokers; i++) dealJoker(room, rng);
}

function maybeBeginTurns(room: Room, rng: Rng, force = false) {
  const act = activePlayers(room);
  const written = act.filter((p) => p.challenge);
  if (!force && written.length < act.length) return;
  if (written.length < 2) return;
  room.pool = shuffle(written.map((p) => ({ id: newId(3), text: p.challenge as string, authorId: p.id })), rng);
  room.roundSize = room.pool.length;
  room.resolved = 0;
  room.phase = "turn";
  startTurn(room, rng);
}

function startTurn(room: Room, rng: Rng) {
  const pick = room.pool.splice(rng.int(room.pool.length), 1)[0];
  const cards = shuffle(activePlayers(room).map((p) => p.id), rng);
  room.turn = {
    key: `${room.round}-${room.resolved + 1}`,
    n: room.resolved + 1,
    stage: "voting",
    challengeId: pick.id,
    challengeText: pick.text,
    cards, votes: {}, revealed: false,
    chain: [], shared: false, partnerId: null, alt: null, altRejected: [], resolution: null, events: [],
  };
}

function closeVoting(room: Room, now: number, rng: Rng) {
  const t = room.turn as Turn;
  const tally = t.cards.map(() => 0);
  for (const [pid, card] of Object.entries(t.votes)) if (t.cards.includes(pid) || getPlayer(room, pid)?.active) tally[card - 1]++;
  const max = Math.max(...tally);
  const tied = max === 0 ? t.cards.map((_, i) => i + 1) : tally.flatMap((v, i) => (v === max ? [i + 1] : []));
  const winner = tied.length === 1 ? tied[0] : tied[rng.int(tied.length)];
  t.tally = tally;
  t.tied = tied;
  t.winnerCard = winner;
  t.holderId = t.cards[winner - 1];
  t.originalId = t.holderId;
  t.chain = [t.holderId];
  t.revealed = true;
  t.revealedAt = now;
  t.stage = "choosing";
}

function resolveTo(t: Turn, kind: ResolutionKind, text?: string) {
  t.resolution = { kind, text };
  t.stage = "confirming";
}

function finishTurn(room: Room, outcome: "ok" | "fail", rng: Rng) {
  const t = room.turn as Turn;
  let res = t.resolution as { kind: ResolutionKind; text?: string };
  if (outcome === "fail" && res.kind !== "withdraw") {
    t.events.push(`El anfitrión registró que ${nameOf(room, t.holderId)} no lo cumplió: se cuenta como retiro.`);
    res = { kind: "withdraw" };
  }
  const subjects = [t.holderId as string, ...(t.shared && t.partnerId ? [t.partnerId] : [])];
  for (const id of subjects) {
    const p = getPlayer(room, id);
    if (!p) continue;
    const field: keyof Counters = res.kind === "done" ? "done" : res.kind === "alt" ? "alt" : "withdrawn";
    p.total[field]++;
    p.round[field]++;
  }
  room.history.unshift({
    id: ++room.seq, round: room.round, n: t.n, challenge: t.challengeText,
    subjects: subjects.map((id) => nameOf(room, id)), kind: res.kind, text: res.text, events: [...t.events], tied: (t.tied?.length ?? 0) > 1,
  });
  if (room.history.length > 200) room.history.length = 200;
  room.resolved += 1;
  if (room.resolved >= room.roundSize || room.pool.length === 0) {
    const granted = dealJoker(room, rng);
    room.summary = {
      round: room.round, turns: room.resolved, jokerGranted: !!granted,
      rows: room.players.filter((p) => p.active || p.round.done + p.round.alt + p.round.withdrawn > 0)
        .map((p) => ({ playerId: p.id, name: p.name, ...p.round })),
    };
    room.phase = "summary";
    room.turn = null;
  } else {
    startTurn(room, rng);
  }
}

// ---------- acciones ----------
export function applyAction(room: Room, actorId: string, a: Action, now: number, rng: Rng = cryptoRng): void {
  const me = getPlayer(room, actorId);
  if (!me) throw new GameError("not_in_room", "No estás en esta sala.", 403);
  const isHost = room.hostId === actorId;
  const needHost = () => { if (!isHost) throw new GameError("host_only", "Solo el anfitrión puede hacer esto.", 403); };
  const turnOf = (key: string, stage?: Stage | Stage[]) => {
    const t = room.turn;
    if (room.phase !== "turn" || !t) throw new GameError("no_turn", "Ahora no hay un turno en juego.", 409);
    if (t.key !== key) throw new GameError("stale", "Esa jugada ya pasó.", 409);
    const stages = stage === undefined ? null : Array.isArray(stage) ? stage : [stage];
    if (stages && !stages.includes(t.stage)) throw new GameError("wrong_stage", "Ahora no corresponde esa acción.", 409);
    return t;
  };

  if (a.type === "resume") { needHost(); room.paused = false; return; }
  if (a.type === "pause") { needHost(); if (room.phase === "ended") return; room.paused = true; return; }
  if (a.type === "end") {
    needHost();
    if (room.phase === "lobby") throw new GameError("wrong_phase", "Todavía no empezó la partida.", 409);
    room.phase = "ended"; room.paused = false; room.turn = null; return;
  }
  if (room.phase === "ended") throw new GameError("ended", "La partida terminó.", 409);
  if (room.paused) throw new GameError("paused", "La partida está en pausa.", 409);

  switch (a.type) {
    case "setSettings": {
      needHost();
      if (room.phase !== "lobby") throw new GameError("wrong_phase", "Los comodines se configuran antes de empezar.", 409);
      if (a.startJokers !== 1 && a.startJokers !== 2) throw new GameError("bad_input", "Valor inválido.");
      room.startJokers = a.startJokers; return;
    }
    case "start": {
      needHost();
      if (room.phase !== "lobby") throw new GameError("wrong_phase", "La partida ya empezó.", 409);
      if (room.players.length < LIMITS.minPlayers) throw new GameError("few_players", `Hacen falta al menos ${LIMITS.minPlayers} jugadores.`, 409);
      startRound(room, true, rng); return;
    }
    case "kick": {
      needHost();
      if (!["lobby", "writing", "summary"].includes(room.phase)) throw new GameError("wrong_phase", "Solo se puede sacar a alguien entre turnos.", 409);
      if (a.playerId === room.hostId) throw new GameError("bad_input", "No podés sacarte a vos mismo.");
      const idx = room.players.findIndex((p) => p.id === a.playerId);
      if (idx < 0) throw new GameError("bad_input", "Ese jugador no está.");
      room.players.splice(idx, 1);
      if (room.phase === "writing") maybeBeginTurns(room, rng);
      return;
    }
    case "submitChallenge": {
      if (room.phase !== "writing") throw new GameError("wrong_phase", "Ahora no se piden retos.", 409);
      if (!me.active) throw new GameError("inactive", "Entrás en la próxima ronda.", 409);
      const text = cleanText(a.text, LIMITS.challenge);
      if (text.length < 3) throw new GameError("bad_input", "Escribí un reto de al menos 3 letras.");
      me.challenge = text;
      maybeBeginTurns(room, rng); return;
    }
    case "forceVoting": {
      needHost();
      if (room.phase !== "writing") throw new GameError("wrong_phase", "Ahora no se piden retos.", 409);
      if (activePlayers(room).filter((p) => p.challenge).length < 2) throw new GameError("few_challenges", "Hacen falta al menos 2 retos escritos.", 409);
      maybeBeginTurns(room, rng, true); return;
    }
    case "vote": {
      const t = turnOf(a.turnKey, "voting");
      if (!me.active || !t.cards.includes(me.id)) throw new GameError("inactive", "Mirás esta ronda desde afuera.", 403);
      if (me.id in t.votes) throw new GameError("already_voted", "Ya votaste.", 409);
      if (!Number.isInteger(a.card) || a.card < 1 || a.card > t.cards.length) throw new GameError("bad_input", "Carta inválida.");
      t.votes[me.id] = a.card;
      if (t.cards.every((id) => id in t.votes)) closeVoting(room, now, rng);
      return;
    }
    case "closeVoting": { needHost(); turnOf(a.turnKey, "voting"); closeVoting(room, now, rng); return; }
    case "hostSkip": {
      needHost();
      const t = turnOf(a.turnKey, ["choosing", "altVoting"]);
      t.events.push(`${nameOf(room, t.holderId)} no respondió: el anfitrión lo registró como retiro.`);
      t.alt = null; resolveTo(t, "withdraw"); return;
    }
    case "fulfill":
    case "withdraw": {
      const t = turnOf(a.turnKey, "choosing");
      if (t.holderId !== me.id) throw new GameError("not_your_turn", "No es tu turno.", 403);
      resolveTo(t, a.type === "fulfill" ? "done" : "withdraw"); return;
    }
    case "propose": {
      const t = turnOf(a.turnKey, "choosing");
      if (t.holderId !== me.id) throw new GameError("not_your_turn", "No es tu turno.", 403);
      const text = cleanText(a.text, LIMITS.alt);
      if (text.length < 3) throw new GameError("bad_input", "Escribí la prenda alternativa.");
      t.alt = { text, proposerId: me.id, votes: {} };
      t.stage = "altVoting";
      if (altVoters(room, t).length === 0) { resolveTo(t, "alt", text); }
      return;
    }
    case "altVote": {
      const t = turnOf(a.turnKey, "altVoting");
      if (!t.alt || !altVoters(room, t).includes(me.id)) throw new GameError("not_voter", "No votás esta prenda.", 403);
      if (me.id in t.alt.votes) throw new GameError("already_voted", "Ya votaste.", 409);
      t.alt.votes[me.id] = !!a.accept;
      settleAlt(room, t, false); return;
    }
    case "altClose": {
      needHost();
      const t = turnOf(a.turnKey, "altVoting");
      settleAlt(room, t, true); return;
    }
    case "useJoker": {
      const t = turnOf(a.turnKey, "choosing");
      if (t.holderId !== me.id) throw new GameError("not_your_turn", "No es tu turno.", 403);
      if (t.shared) throw new GameError("shared", "Un reto compartido no admite comodines.", 409);
      const idx = me.jokers.findIndex((j) => j.type === a.joker);
      if (idx < 0) throw new GameError("no_joker", "No tenés ese comodín.", 409);
      if (a.joker === "pass") {
        const target = getPlayer(room, a.target);
        if (!target || !target.active) throw new GameError("bad_target", "Elegí a otra persona.");
        if (t.chain.includes(target.id)) throw new GameError("already_received", "Esa persona ya tuvo este reto en este turno.", 409);
        me.jokers.splice(idx, 1);
        t.chain.push(target.id);
        t.holderId = target.id;
        t.alt = null;
        t.events.push(`${me.name} usó Pasar el reto y se lo pasó a ${target.name}.`);
      } else {
        if (t.chain.length < 2) throw new GameError("not_passed", "El rebote solo sirve si te pasaron el reto.", 409);
        me.jokers.splice(idx, 1);
        const prev = t.chain[t.chain.length - 2];
        t.shared = true;
        t.partnerId = prev;
        t.alt = null;
        t.events.push(`${me.name} usó Rebote: ahora lo hacen juntos ${me.name} y ${nameOf(room, prev)}.`);
      }
      return;
    }
    case "confirm": {
      needHost();
      const t = turnOf(a.turnKey, "confirming");
      finishTurn(room, a.outcome === "fail" ? "fail" : "ok", rng); void t; return;
    }
    case "nextRound": {
      needHost();
      if (room.phase !== "summary") throw new GameError("wrong_phase", "La ronda no terminó.", 409);
      startRound(room, false, rng); return;
    }
  }
}

export function altVoters(room: Room, t: Turn): string[] {
  const excluded = new Set([t.holderId, ...(t.shared && t.partnerId ? [t.partnerId] : [])]);
  return activePlayers(room).filter((p) => !excluded.has(p.id)).map((p) => p.id);
}

function settleAlt(room: Room, t: Turn, forced: boolean) {
  const alt = t.alt as NonNullable<Turn["alt"]>;
  const voters = altVoters(room, t);
  const votes = voters.filter((id) => id in alt.votes);
  const anyReject = votes.some((id) => !alt.votes[id]);
  if (anyReject) {
    t.altRejected.push(alt.text);
    t.events.push(`Rechazaron la prenda de ${nameOf(room, t.holderId)}: «${alt.text}».`);
    t.alt = null; t.stage = "choosing"; return;
  }
  const allIn = votes.length === voters.length;
  if (allIn || (forced && votes.length > 0)) { resolveTo(t, "alt", alt.text); return; }
  if (forced) { // nadie votó: el anfitrión descarta la propuesta
    t.alt = null; t.stage = "choosing";
  }
}
