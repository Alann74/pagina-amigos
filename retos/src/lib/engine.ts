// Motor del juego: lógica pura y determinista (salvo el RNG inyectable). El servidor es la autoridad.
// Sin anfitrión: todos juegan igual. Empezar = todos "listos"; el árbitro de cada turno se sortea;
// si alguien no responde, cualquiera puede destrabar pasados IDLE_MS; terminar = votación por mayoría.
import { createHash, randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import { IDLE_MS, LIMITS, SMOKE_EVERY, SMOKE_MIN_MS } from "./types";
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
  ready: boolean;
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
  stageAt: number;
  cards: string[]; // cards[i] = jugador detrás de la carta i+1 (secreto hasta la revelación)
  votes: Record<string, number>;
  revealed: boolean; // ya se sabe a quién le toca
  revealedAt?: number;
  // Paso 2: votación de la carta de reto (cada carta oculta un reto; nunca el que escribió el elegido)
  challengeCards: string[]; // ids de reto; challengeCards[i] = reto detrás de la carta i+1 (secreto)
  pickVotes: Record<string, number>;
  pickTally?: number[];
  pickTied?: number[];
  pickWinner?: number;
  challengeId: string | null;
  challengeText: string | null;
  challengeRevealed: boolean;
  challengeRevealedAt?: number;
  winnerCard?: number;
  tally?: number[];
  tied?: number[];
  holderId?: string;
  originalId?: string;
  chain: string[];
  shared: boolean;
  partnerId: string | null;
  judgeId: string | null; // árbitro sorteado que confirma cómo se resolvió
  alt: { text: string; proposerId: string; votes: Record<string, boolean> } | null;
  altRejected: string[];
  resolution: { kind: ResolutionKind; text?: string } | null;
  events: string[];
}
export interface HistoryItem {
  smoke?: { name: string; count: number };
  id: number; round: number; n: number; challenge: string; subjects: string[];
  kind: ResolutionKind; text?: string; events: string[]; tied: boolean;
}
export interface Room {
  code: string;
  createdAt: number;
  phase: Phase;
  phaseAt: number;
  clock: number;
  paused: boolean;
  pausedBy: string | null;
  endVotes: string[];
  smokeVotes: string[]; // quiénes quieren la ruleta de humo (+18); se activa si votan más de la mitad
  smokeOn: boolean;
  turnsDone: number;
  smoke: { id: string; playerId: string; count: number; at: number } | null;
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

function newPlayer(name: string, token: string, now: number): Player {
  return { id: newId(4), name, tokenHash: hashToken(token), active: true, ready: false, joinedAt: now, jokers: [], total: zero(), round: zero(), challenge: null };
}

/** Quien crea la sala es un jugador más: no tiene ningún poder especial. */
export function createRoom(creatorName: string, now: number, code: string) {
  const name = cleanText(creatorName, LIMITS.name);
  if (!name) throw new GameError("name", "Elegí un nombre.");
  const token = randomBytes(24).toString("hex");
  const first = newPlayer(name, token, now);
  const room: Room = {
    code, createdAt: now, phase: "lobby", phaseAt: now, clock: now, paused: false, pausedBy: null, endVotes: [], smokeVotes: [], smokeOn: false, turnsDone: 0, smoke: null,
    round: 0, roundSize: 0, resolved: 0, pool: [], players: [first], turn: null, history: [], summary: null, seq: 0,
  };
  return { room, token, playerId: first.id };
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

/** ¿Se puede empezar (o seguir de ronda)? Todos los conectados listos y al menos 3 listos. */
export function canProceed(room: Room, connected: (id: string) => boolean): boolean {
  if (room.phase !== "lobby" && room.phase !== "summary") return false;
  const ready = room.players.filter((p) => p.ready);
  return ready.length >= LIMITS.minPlayers && room.players.every((p) => p.ready || !connected(p.id));
}

function startRound(room: Room, fromLobby: boolean, rng: Rng, exclude: Set<string>) {
  room.round += 1;
  room.phase = "writing";
  room.phaseAt = room.clock;
  room.pool = [];
  room.turn = null;
  room.summary = null;
  room.resolved = 0;
  room.endVotes = [];
  for (const p of room.players) {
    p.active = !exclude.has(p.id); // quien no está listo y sin conexión espera a la próxima ronda
    p.ready = false;
    p.challenge = null;
    p.round = zero();
  }
  if (fromLobby) { room.smokeOn = room.smokeVotes.filter((id) => getPlayer(room, id)).length * 2 > room.players.length; room.turnsDone = 0; room.smoke = null; }
  // Comodines iniciales: 1 o 2 en total, repartidos y de tipo al azar.
  if (fromLobby) { const n = 1 + rng.int(2); for (let i = 0; i < n; i++) dealJoker(room, rng); }
}

function tryProceed(room: Room, rng: Rng, connected: (id: string) => boolean): boolean {
  if (!canProceed(room, connected)) return false;
  const exclude = new Set(room.players.filter((p) => !p.ready).map((p) => p.id));
  startRound(room, room.phase === "lobby", rng, exclude);
  return true;
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
  const cards = shuffle(activePlayers(room).map((p) => p.id), rng);
  room.turn = {
    key: `${room.round}-${room.resolved + 1}`,
    n: room.resolved + 1,
    stage: "voting", stageAt: room.clock,
    cards, votes: {}, revealed: false,
    challengeCards: [], pickVotes: {}, challengeId: null, challengeText: null, challengeRevealed: false,
    chain: [], shared: false, partnerId: null, judgeId: null, alt: null, altRejected: [], resolution: null, events: [],
  };
}

/** Una carta solo puede salir si queda algún reto que no sea del jugador de esa carta. */
const canBeChosen = (room: Room, playerId: string) => room.pool.some((c) => c.authorId !== playerId);

function closeVoting(room: Room, rng: Rng) {
  const t = room.turn as Turn;
  const tally = t.cards.map(() => 0);
  for (const [pid, card] of Object.entries(t.votes)) if (t.cards.includes(pid)) tally[card - 1]++;
  const rawMax = Math.max(...tally);
  const cand = tally.map((v, i) => ({ v, card: i + 1 })).filter((c) => canBeChosen(room, t.cards[c.card - 1]));
  const max = Math.max(...cand.map((c) => c.v));
  const tied = max === 0 ? cand.map((c) => c.card) : cand.filter((c) => c.v === max).map((c) => c.card);
  const winner = tied.length === 1 ? tied[0] : tied[rng.int(tied.length)];
  if (max < rawMax) t.events.push("La carta más votada no podía salir (solo quedaba un reto escrito por esa persona): se eligió otra.");
  t.tally = tally;
  t.tied = tied;
  t.winnerCard = winner;
  t.holderId = t.cards[winner - 1];
  t.originalId = t.holderId;
  t.chain = [t.holderId];
  t.revealed = true;
  t.revealedAt = room.clock;
  startPicking(room, t, rng);
}

/** Paso 2: se arman las cartas de reto (sin el reto que escribió el elegido). Con un solo reto posible, sale directo. */
function startPicking(room: Room, t: Turn, rng: Rng) {
  const eligible = room.pool.filter((c) => c.authorId !== t.holderId);
  t.stageAt = room.clock;
  if (eligible.length === 1) {
    t.challengeCards = [eligible[0].id];
    setChallenge(room, t, eligible[0].id, 1, undefined, undefined);
    return;
  }
  t.challengeCards = shuffle(eligible.map((c) => c.id), rng);
  t.stage = "picking";
}

function setChallenge(room: Room, t: Turn, id: string, winner: number, tally?: number[], tied?: number[]) {
  const idx = room.pool.findIndex((c) => c.id === id);
  const ch = room.pool.splice(idx, 1)[0]; // el reto usado se retira del conjunto
  t.challengeId = ch.id;
  t.challengeText = ch.text;
  t.challengeRevealed = true;
  t.challengeRevealedAt = room.clock;
  t.pickWinner = winner; t.pickTally = tally; t.pickTied = tied;
  t.stage = "choosing";
  t.stageAt = room.clock;
}

function closePicking(room: Room, rng: Rng) {
  const t = room.turn as Turn;
  const tally = t.challengeCards.map(() => 0);
  for (const [pid, card] of Object.entries(t.pickVotes)) if (pickVoters(room, t).includes(pid)) tally[card - 1]++;
  const max = Math.max(...tally);
  const tied = max === 0 ? t.challengeCards.map((_, i) => i + 1) : tally.flatMap((v, i) => (v === max ? [i + 1] : []));
  const winner = tied.length === 1 ? tied[0] : tied[rng.int(tied.length)];
  setChallenge(room, t, t.challengeCards[winner - 1], winner, tally, tied);
}

/** Votan el reto todos los jugadores activos menos la persona a la que le toca. */
export const pickVoters = (room: Room, t: Turn) => activePlayers(room).filter((p) => p.id !== t.holderId).map((p) => p.id);

/** Pasa a "confirmando" y sortea el árbitro entre quienes no son parte del reto. */
function resolveTo(room: Room, t: Turn, kind: ResolutionKind, rng: Rng, text?: string) {
  t.resolution = { kind, text };
  t.stage = "confirming";
  t.stageAt = room.clock;
  const subjects = new Set([t.holderId, ...(t.shared && t.partnerId ? [t.partnerId] : [])]);
  const pool = activePlayers(room).filter((p) => !subjects.has(p.id));
  t.judgeId = pool.length ? pool[rng.int(pool.length)].id : (t.holderId ?? null);
}

function finishTurn(room: Room, outcome: "ok" | "fail", rng: Rng) {
  const t = room.turn as Turn;
  let res = t.resolution as { kind: ResolutionKind; text?: string };
  if (outcome === "fail" && res.kind !== "withdraw") {
    t.events.push(`${nameOf(room, t.judgeId)} (árbitro) registró que ${nameOf(room, t.holderId)} no lo cumplió: se cuenta como retiro.`);
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
    id: ++room.seq, round: room.round, n: t.n, challenge: t.challengeText as string,
    subjects: subjects.map((id) => nameOf(room, id)), kind: res.kind, text: res.text, events: [...t.events], tied: (t.tied?.length ?? 0) > 1,
  });
  if (room.history.length > 200) room.history.length = 200;
  room.resolved += 1;
  room.turnsDone += 1;
  if (room.resolved >= room.roundSize || room.pool.length === 0) {
    const granted = dealJoker(room, rng);
    room.summary = {
      round: room.round, turns: room.resolved, jokerGranted: !!granted,
      rows: room.players.filter((p) => p.active || p.round.done + p.round.alt + p.round.withdrawn > 0)
        .map((p) => ({ playerId: p.id, name: p.name, ...p.round })),
    };
    room.phase = "summary";
    room.phaseAt = room.clock;
    room.turn = null;
    for (const p of room.players) p.ready = false;
  } else {
    startTurn(room, rng);
  }
  // Ruleta de humo: cada SMOKE_EVERY retos, el azar elige a alguien y cuántas "secas" (1 a 5). Todos la ven antes de seguir.
  if (room.smokeOn && room.turnsDone % SMOKE_EVERY === 0) {
    const act = activePlayers(room);
    if (act.length) room.smoke = { id: newId(3), playerId: act[rng.int(act.length)].id, count: 1 + rng.int(5), at: room.clock };
  }
}

// ---------- acciones ----------
export function applyAction(
  room: Room, actorId: string, a: Action, now: number, rng: Rng = cryptoRng, connected: (id: string) => boolean = () => true,
): void {
  room.clock = now;
  const me = getPlayer(room, actorId);
  if (!me) throw new GameError("not_in_room", "No estás en esta sala.", 403);
  const idle = (since: number) => now - since >= IDLE_MS;
  const needActive = () => { if (!me.active) throw new GameError("inactive", "Mirás esta ronda desde afuera. Entrás en la próxima.", 403); };
  const tooEarly = () => new GameError("too_early", "Todavía no: esperá un poco a que respondan.", 409);
  const turnOf = (key: string, stage?: Stage | Stage[]) => {
    const t = room.turn;
    if (room.phase !== "turn" || !t) throw new GameError("no_turn", "Ahora no hay un turno en juego.", 409);
    if (t.key !== key) throw new GameError("stale", "Esa jugada ya pasó.", 409);
    const stages = stage === undefined ? null : Array.isArray(stage) ? stage : [stage];
    if (stages && !stages.includes(t.stage)) throw new GameError("wrong_stage", "Ahora no corresponde esa acción.", 409);
    return t;
  };

  // Acciones que valen también en pausa / al terminar
  if (a.type === "resume") { needActive(); room.paused = false; room.pausedBy = null; return; }
  if (a.type === "pause") {
    needActive();
    if (room.phase === "lobby" || room.phase === "ended") throw new GameError("wrong_phase", "No hay partida para pausar.", 409);
    room.paused = true; room.pausedBy = me.id; return;
  }
  if (a.type === "voteEnd") {
    needActive();
    if (room.phase === "lobby" || room.phase === "ended") throw new GameError("wrong_phase", "No hay partida para terminar.", 409);
    room.endVotes = room.endVotes.filter((id) => getPlayer(room, id)?.active);
    const has = room.endVotes.includes(me.id);
    if (a.on && !has) room.endVotes.push(me.id);
    if (!a.on && has) room.endVotes = room.endVotes.filter((id) => id !== me.id);
    if (room.endVotes.length * 2 > activePlayers(room).length) { room.phase = "ended"; room.paused = false; room.turn = null; }
    return;
  }
  if (a.type === "leave") {
    if (room.phase === "turn") throw new GameError("wrong_phase", "No podés irte en medio de un turno. Esperá al resumen de la ronda.", 409);
    room.players = room.players.filter((p) => p.id !== me.id);
    room.endVotes = room.endVotes.filter((id) => id !== me.id);
    if (room.phase === "lobby" || room.phase === "summary") tryProceed(room, rng, connected);
    else if (room.phase === "writing") { if (activePlayers(room).length < LIMITS.minPlayers) room.phase = "ended"; else maybeBeginTurns(room, rng); }
    if (room.phase !== "lobby" && room.phase !== "ended" && room.players.length < LIMITS.minPlayers) { room.phase = "ended"; room.turn = null; }
    return;
  }
  if (a.type === "rematch") {
    if (room.phase !== "ended") throw new GameError("wrong_phase", "La partida todavía no terminó.", 409);
    // Revancha: misma sala y mismos jugadores, todo en cero; vuelven a tocar "listo".
    Object.assign(room, { phase: "lobby", phaseAt: now, paused: false, pausedBy: null, endVotes: [], smokeVotes: [], smokeOn: false, turnsDone: 0, smoke: null, round: 0, roundSize: 0, resolved: 0, pool: [], turn: null, history: [], summary: null });
    for (const p of room.players) Object.assign(p, { active: true, ready: false, jokers: [], total: zero(), round: zero(), challenge: null });
    return;
  }
  if (room.phase === "ended") throw new GameError("ended", "La partida terminó.", 409);
  if (room.paused) throw new GameError("paused", "La partida está en pausa.", 409);
  if (room.smoke && a.type !== "smokeNext") throw new GameError("smoke", "Hay una ruleta de humo en curso: esperá a que termine.", 409);

  switch (a.type) {
    case "smokeVote": {
      if (room.phase !== "lobby") throw new GameError("wrong_phase", "La ruleta de humo se decide en la sala de espera.", 409);
      room.smokeVotes = room.smokeVotes.filter((id) => getPlayer(room, id));
      const has = room.smokeVotes.includes(me.id);
      if (a.on && !has) room.smokeVotes.push(me.id);
      if (!a.on && has) room.smokeVotes = room.smokeVotes.filter((id) => id !== me.id);
      return;
    }
    case "smokeNext": {
      const sm = room.smoke;
      if (!sm || sm.id !== a.id) throw new GameError("stale", "Esa ruleta ya terminó.", 409);
      needActive();
      if (now - sm.at < SMOKE_MIN_MS) throw new GameError("too_early", "Esperá a que termine la animación.", 409);
      room.history.unshift({
        id: ++room.seq, round: room.round, n: 0, challenge: "Ruleta de humo", subjects: [nameOf(room, sm.playerId)], kind: "done", events: [], tied: false,
        smoke: { name: nameOf(room, sm.playerId), count: sm.count },
      });
      room.smoke = null;
      return;
    }
    case "ready": {
      if (room.phase !== "lobby" && room.phase !== "summary") throw new GameError("wrong_phase", "Ahora no hace falta confirmar.", 409);
      me.ready = !!a.ready;
      tryProceed(room, rng, connected); return;
    }
    case "start": {
      if (room.phase !== "lobby" && room.phase !== "summary") throw new GameError("wrong_phase", "La partida ya empezó.", 409);
      if (!me.ready) throw new GameError("not_ready", "Primero tocá “listo”.", 409);
      if (!tryProceed(room, rng, connected)) throw new GameError("not_all_ready", `Faltan jugadores por estar listos (hacen falta ${LIMITS.minPlayers} como mínimo).`, 409);
      return;
    }
    case "submitChallenge": {
      if (room.phase !== "writing") throw new GameError("wrong_phase", "Ahora no se piden retos.", 409);
      needActive();
      const text = cleanText(a.text, LIMITS.challenge);
      if (text.length < 3) throw new GameError("bad_input", "Escribí un reto de al menos 3 letras.");
      me.challenge = text;
      maybeBeginTurns(room, rng); return;
    }
    case "forceVoting": {
      if (room.phase !== "writing") throw new GameError("wrong_phase", "Ahora no se piden retos.", 409);
      needActive();
      if (!idle(room.phaseAt)) throw tooEarly();
      if (activePlayers(room).filter((p) => p.challenge).length < 2) throw new GameError("few_challenges", "Hacen falta al menos 2 retos escritos.", 409);
      maybeBeginTurns(room, rng, true); return;
    }
    case "vote": {
      const t = turnOf(a.turnKey, "voting");
      if (!me.active || !t.cards.includes(me.id)) throw new GameError("inactive", "Mirás esta ronda desde afuera.", 403);
      if (me.id in t.votes) throw new GameError("already_voted", "Ya votaste.", 409);
      if (!Number.isInteger(a.card) || a.card < 1 || a.card > t.cards.length) throw new GameError("bad_input", "Carta inválida.");
      t.votes[me.id] = a.card;
      if (t.cards.every((id) => id in t.votes)) closeVoting(room, rng);
      return;
    }
    case "closeVoting": {
      const t = turnOf(a.turnKey, ["voting", "picking"]);
      needActive();
      if (t.stage === "picking" && me.id === t.holderId) throw new GameError("not_allowed", "Tu reto lo eligen los demás.", 403);
      if (!idle(t.stageAt)) throw tooEarly();
      if (t.stage === "voting") closeVoting(room, rng); else closePicking(room, rng);
      return;
    }
    case "pick": {
      const t = turnOf(a.turnKey, "picking");
      if (!pickVoters(room, t).includes(me.id)) throw new GameError("not_voter", t.holderId === me.id ? "Tu reto lo eligen los demás." : "Mirás esta ronda desde afuera.", 403);
      if (me.id in t.pickVotes) throw new GameError("already_voted", "Ya votaste.", 409);
      if (!Number.isInteger(a.card) || a.card < 1 || a.card > t.challengeCards.length) throw new GameError("bad_input", "Carta inválida.");
      t.pickVotes[me.id] = a.card;
      if (pickVoters(room, t).every((id) => id in t.pickVotes)) closePicking(room, rng);
      return;
    }
    case "skipHolder": {
      const t = turnOf(a.turnKey, ["choosing", "altVoting"]);
      needActive();
      if (me.id === t.holderId || (t.shared && me.id === t.partnerId)) throw new GameError("not_allowed", "No podés saltearte a vos mismo.", 403);
      if (!idle(t.stageAt)) throw tooEarly();
      t.events.push(`${nameOf(room, t.holderId)} no respondió: se registró como retiro.`);
      t.alt = null; resolveTo(room, t, "withdraw", rng); return;
    }
    case "fulfill":
    case "withdraw": {
      const t = turnOf(a.turnKey, "choosing");
      if (t.holderId !== me.id) throw new GameError("not_your_turn", "No es tu turno.", 403);
      resolveTo(room, t, a.type === "fulfill" ? "done" : "withdraw", rng); return;
    }
    case "propose": {
      const t = turnOf(a.turnKey, "choosing");
      if (t.holderId !== me.id) throw new GameError("not_your_turn", "No es tu turno.", 403);
      const text = cleanText(a.text, LIMITS.alt);
      if (text.length < 3) throw new GameError("bad_input", "Escribí la prenda alternativa.");
      t.alt = { text, proposerId: me.id, votes: {} };
      t.stage = "altVoting"; t.stageAt = now;
      if (altVoters(room, t).length === 0) resolveTo(room, t, "alt", rng, text);
      return;
    }
    case "altVote": {
      const t = turnOf(a.turnKey, "altVoting");
      if (!t.alt || !altVoters(room, t).includes(me.id)) throw new GameError("not_voter", "No votás esta prenda.", 403);
      if (me.id in t.alt.votes) throw new GameError("already_voted", "Ya votaste.", 409);
      t.alt.votes[me.id] = !!a.accept;
      settleAlt(room, t, false, rng); return;
    }
    case "altClose": {
      const t = turnOf(a.turnKey, "altVoting");
      needActive();
      if (me.id === t.holderId) throw new GameError("not_allowed", "No podés cerrar la votación de tu propia prenda.", 403);
      if (!idle(t.stageAt)) throw tooEarly();
      settleAlt(room, t, true, rng); return;
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
        t.stageAt = now;
        t.events.push(`${me.name} usó Pasar el reto y se lo pasó a ${target.name}.`);
      } else {
        if (t.chain.length < 2) throw new GameError("not_passed", "El rebote solo sirve si te pasaron el reto.", 409);
        me.jokers.splice(idx, 1);
        const prev = t.chain[t.chain.length - 2];
        t.shared = true;
        t.partnerId = prev;
        t.alt = null;
        t.stageAt = now;
        t.events.push(`${me.name} usó Rebote: ahora lo hacen juntos ${me.name} y ${nameOf(room, prev)}.`);
      }
      return;
    }
    case "confirm": {
      const t = turnOf(a.turnKey, "confirming");
      const isSubject = me.id === t.holderId || (t.shared && me.id === t.partnerId);
      if (me.id !== t.judgeId) {
        // Si el árbitro sorteado no responde, otro jugador (que no sea parte del reto) puede confirmar.
        if (!me.active || isSubject) throw new GameError("not_judge", "Solo el árbitro sorteado confirma este turno.", 403);
        if (!idle(t.stageAt)) throw new GameError("not_judge", "Confirma el árbitro sorteado. Si no responde, podés hacerlo en unos segundos.", 403);
      }
      finishTurn(room, a.outcome === "fail" ? "fail" : "ok", rng); return;
    }
  }
}

export function altVoters(room: Room, t: Turn): string[] {
  const excluded = new Set([t.holderId, ...(t.shared && t.partnerId ? [t.partnerId] : [])]);
  return activePlayers(room).filter((p) => !excluded.has(p.id)).map((p) => p.id);
}

function settleAlt(room: Room, t: Turn, forced: boolean, rng: Rng) {
  const alt = t.alt as NonNullable<Turn["alt"]>;
  const voters = altVoters(room, t);
  const votes = voters.filter((id) => id in alt.votes);
  const anyReject = votes.some((id) => !alt.votes[id]);
  if (anyReject) {
    t.altRejected.push(alt.text);
    t.events.push(`Rechazaron la prenda de ${nameOf(room, t.holderId)}: «${alt.text}».`);
    t.alt = null; t.stage = "choosing"; t.stageAt = room.clock; return;
  }
  const allIn = votes.length === voters.length;
  if (allIn || (forced && votes.length > 0)) { resolveTo(room, t, "alt", rng, alt.text); return; }
  if (forced) { // nadie votó: se descarta la propuesta
    t.alt = null; t.stage = "choosing"; t.stageAt = room.clock;
  }
}
