import test from "node:test";
import assert from "node:assert/strict";
import { GameError, addPlayer, applyAction, canProceed, cleanText, createRoom, getPlayer, reclaimPlayer, tokenMatches } from "../../src/lib/engine";
import type { Rng, Room } from "../../src/lib/engine";
import { buildView } from "../../src/lib/view";
import { IDLE_MS } from "../../src/lib/types";
import type { Action } from "../../src/lib/types";

function seeded(seed: number): Rng {
  let s = seed >>> 0;
  return { int: (n) => { if (n <= 1) return 0; s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return Math.floor((((t ^ (t >>> 14)) >>> 0) / 4294967296) * n); } };
}
const rng = seeded(7);
const NOW = 1_000_000;
const LATE = NOW + IDLE_MS + 1000;
const act = (r: Room, who: string, a: Action, now = NOW, conn?: (id: string) => boolean) => applyAction(r, who, a, now, rng, conn);
const throwsCode = (fn: () => void, code: string) => assert.throws(fn, (e: unknown) => e instanceof GameError && e.code === code);

/** Sala sin anfitrión: todos "listos" => arranca sola; todos escriben un reto. */
function setup(names = ["Ana", "Beto", "Cami", "Dani"]) {
  const { room, playerId: first } = createRoom(names[0], NOW, "BCDF");
  const ids = [first, ...names.slice(1).map((n) => addPlayer(room, n, NOW).playerId)];
  ids.forEach((id) => act(room, id, { type: "ready", ready: true }));
  ids.forEach((id, i) => act(room, id, { type: "submitChallenge", text: `Reto numero ${i + 1}` }));
  return { room, ids };
}
const turn = (r: Room) => r.turn!;
const byId = (r: Room, id: string) => getPlayer(r, id)!;
/** Paso 1: todos votan una carta (a quién le toca). */
function votePlayers(r: Room, ids: string[], card: (i: number) => number) {
  ids.forEach((id, i) => act(r, id, { type: "vote", turnKey: turn(r).key, card: card(i) }));
}
/** Paso 1 + paso 2: además, todos menos el elegido votan la carta 1 de reto. Queda en "choosing". */
function everyoneVotes(r: Room, ids: string[], card: (i: number) => number) {
  votePlayers(r, ids, card);
  if (turn(r).stage === "picking") ids.filter((id) => id !== turn(r).holderId).forEach((id) => act(r, id, { type: "pick", turnKey: turn(r).key, card: 1 }));
}
/** Confirma el turno como lo haría el árbitro sorteado. */
const judgeConfirms = (r: Room, outcome: "ok" | "fail" = "ok") => act(r, turn(r).judgeId!, { type: "confirm", turnKey: turn(r).key, outcome });

test("empezar: todos listos (mín. 3), sin anfitrión; reparte 1 o 2 comodines al azar", () => {
  const { room: r0, playerId } = createRoom("Solo", NOW, "BCDG");
  const b = addPlayer(r0, "Otro", NOW).playerId;
  act(r0, playerId, { type: "ready", ready: true }); act(r0, b, { type: "ready", ready: true });
  assert.equal(r0.phase, "lobby", "con 2 listos no arranca");
  throwsCode(() => act(r0, playerId, { type: "start" }), "not_all_ready");
  const seen = new Set<number>();
  for (let s = 0; s < 30; s++) {
    const room = createRoom("A", NOW, "BCDH").room;
    const ids = [room.players[0].id, addPlayer(room, "B", NOW).playerId, addPlayer(room, "C", NOW).playerId];
    ids.forEach((id) => applyAction(room, id, { type: "ready", ready: true }, NOW, seeded(s)));
    assert.equal(room.phase, "writing");
    seen.add(room.players.reduce((n, p) => n + p.jokers.length, 0));
  }
  assert.deepEqual([...seen].sort(), [1, 2], "siempre 1 o 2 comodines, sorteado");
  const { room } = setup(["A", "B", "C", "D", "E"]);
  assert.equal(room.phase, "turn");
  assert.equal(room.roundSize, 5);
  assert.equal(new Set(turn(room).cards).size, 5, "cada carta tiene un nombre distinto");
});

test("quien crea la sala no tiene privilegios y puede elegir no estar listo", () => {
  const { room, playerId } = createRoom("Creador", NOW, "BCDJ");
  const b = addPlayer(room, "B", NOW).playerId, c = addPlayer(room, "C", NOW).playerId;
  act(room, b, { type: "ready", ready: true }); act(room, c, { type: "ready", ready: true });
  assert.equal(room.phase, "lobby", "el creador también tiene que estar listo");
  act(room, playerId, { type: "ready", ready: true });
  assert.equal(room.phase, "writing");
  assert.ok(!("hostId" in room), "el modelo no tiene anfitrión");
});

test("jugador sin conexión y sin estar listo no frena el inicio: espera a la próxima ronda", () => {
  const { room, playerId } = createRoom("A", NOW, "BCDK");
  const b = addPlayer(room, "B", NOW).playerId, c = addPlayer(room, "C", NOW).playerId, d = addPlayer(room, "D", NOW).playerId;
  const conn = (id: string) => id !== d;
  [playerId, b].forEach((id) => act(room, id, { type: "ready", ready: true }, NOW, conn));
  assert.equal(room.phase, "lobby");
  assert.equal(canProceed(room, conn), false);
  act(room, c, { type: "ready", ready: true }, NOW, conn);
  assert.equal(room.phase, "writing", "arranca con los 3 listos conectados");
  assert.equal(byId(room, d).active, false, "el ausente queda como espectador");
});

test("votos: uno por persona, sin duplicados, clave vieja rechazada", () => {
  const { room, ids } = setup();
  const key = turn(room).key;
  act(room, ids[0], { type: "vote", turnKey: key, card: 2 });
  throwsCode(() => act(room, ids[0], { type: "vote", turnKey: key, card: 3 }), "already_voted");
  throwsCode(() => act(room, ids[1], { type: "vote", turnKey: key, card: 9 }), "bad_input");
  throwsCode(() => act(room, ids[1], { type: "vote", turnKey: "0-0", card: 1 }), "stale");
});

test("mayoría gana; empate se sortea entre las cartas empatadas", () => {
  const a = setup();
  votePlayers(a.room, a.ids, (i) => (i < 3 ? 2 : 4));
  assert.equal(turn(a.room).winnerCard, 2);
  assert.equal(turn(a.room).stage, "picking", "después de elegir a la persona se vota el reto");
  assert.equal(turn(a.room).holderId, turn(a.room).cards[1]);
  const seen = new Set<number>();
  for (let s = 0; s < 40; s++) {
    const g = setup();
    const r = seeded(s);
    const key = turn(g.room).key;
    g.ids.forEach((id, i) => applyAction(g.room, id, { type: "vote", turnKey: key, card: i < 2 ? 1 : 3 }, NOW, r));
    const t = turn(g.room);
    assert.deepEqual(t.tied, [1, 3]);
    assert.ok([1, 3].includes(t.winnerCard!));
    seen.add(t.winnerCard!);
  }
  assert.equal(seen.size, 2, "ambas cartas empatadas pueden ganar");
});

test("si alguien no vota, cualquiera puede cerrar la votación pasado el tiempo (antes no)", () => {
  const { room, ids } = setup();
  act(room, ids[1], { type: "vote", turnKey: turn(room).key, card: 4 });
  throwsCode(() => act(room, ids[2], { type: "closeVoting", turnKey: turn(room).key }), "too_early");
  act(room, ids[2], { type: "closeVoting", turnKey: turn(room).key }, LATE);
  assert.equal(turn(room).winnerCard, 4);
  const b = setup();
  act(b.room, b.ids[3], { type: "closeVoting", turnKey: turn(b.room).key }, LATE);
  assert.equal(turn(b.room).tied!.length, 4, "sin votos: sorteo entre todas");
});

test("cumplir -> confirma SOLO el árbitro sorteado (no el titular); doble toque rechazado", () => {
  const { room, ids } = setup();
  everyoneVotes(room, ids, () => 1);
  const t = turn(room);
  const holder = t.holderId!;
  const other = ids.find((i) => i !== holder)!;
  throwsCode(() => act(room, other, { type: "fulfill", turnKey: t.key }), "not_your_turn");
  act(room, holder, { type: "fulfill", turnKey: t.key });
  assert.equal(turn(room).stage, "confirming");
  assert.ok(turn(room).judgeId && turn(room).judgeId !== holder, "el árbitro es otra persona");
  throwsCode(() => act(room, holder, { type: "confirm", turnKey: t.key, outcome: "ok" }, LATE), "not_judge");
  const notJudge = ids.find((i) => i !== holder && i !== turn(room).judgeId)!;
  throwsCode(() => act(room, notJudge, { type: "confirm", turnKey: t.key, outcome: "ok" }), "not_judge");
  judgeConfirms(room);
  assert.equal(byId(room, holder).total.done, 1);
  assert.equal(turn(room).n, 2);
  throwsCode(() => act(room, ids[0], { type: "confirm", turnKey: t.key, outcome: "ok" }), "stale");
});

test("el árbitro que no responde: otro jugador (no titular) puede confirmar pasado el tiempo", () => {
  const { room, ids } = setup();
  everyoneVotes(room, ids, () => 1);
  const t = turn(room);
  act(room, t.holderId!, { type: "fulfill", turnKey: t.key });
  const backup = ids.find((i) => i !== t.holderId && i !== turn(room).judgeId)!;
  act(room, backup, { type: "confirm", turnKey: t.key, outcome: "ok" }, LATE);
  assert.equal(byId(room, t.holderId!).total.done, 1);
});

test("pase: no se puede volver a pasar a quien ya recibió; rebote deja el reto compartido (árbitro ajeno)", () => {
  const { room, ids } = setup(["A", "B", "C", "D"]);
  everyoneVotes(room, ids, () => 1);
  const t = turn(room);
  const [h, x, y] = [t.holderId!, ...ids.filter((i) => i !== t.holderId)];
  byId(room, h).jokers = [{ id: "j1", type: "pass" }, { id: "j2", type: "pass" }];
  byId(room, x).jokers = [{ id: "j3", type: "bounce" }, { id: "j4", type: "pass" }];
  byId(room, y).jokers = [];
  throwsCode(() => act(room, h, { type: "useJoker", turnKey: t.key, joker: "pass", target: h }), "already_received");
  act(room, h, { type: "useJoker", turnKey: t.key, joker: "pass", target: x });
  assert.equal(turn(room).holderId, x);
  assert.equal(byId(room, h).jokers.length, 1);
  throwsCode(() => act(room, h, { type: "fulfill", turnKey: t.key }), "not_your_turn");
  act(room, x, { type: "useJoker", turnKey: t.key, joker: "pass", target: y });
  throwsCode(() => act(room, y, { type: "useJoker", turnKey: t.key, joker: "pass", target: x }), "no_joker");
  byId(room, y).jokers = [{ id: "j9", type: "pass" }, { id: "j8", type: "bounce" }];
  throwsCode(() => act(room, y, { type: "useJoker", turnKey: t.key, joker: "pass", target: h }), "already_received");
  act(room, y, { type: "useJoker", turnKey: t.key, joker: "bounce" });
  assert.equal(turn(room).shared, true);
  assert.equal(turn(room).partnerId, x);
  throwsCode(() => act(room, y, { type: "useJoker", turnKey: t.key, joker: "pass", target: ids.find((i) => ![h, x, y].includes(i))! }), "shared");
  act(room, y, { type: "fulfill", turnKey: t.key });
  assert.ok(![y, x].includes(turn(room).judgeId!), "el árbitro no es parte del reto compartido");
  judgeConfirms(room);
  assert.equal(byId(room, y).total.done, 1);
  assert.equal(byId(room, x).total.done, 1, "el reto compartido cuenta para ambos");
});

test("rebote sin que te hayan pasado el reto no está permitido", () => {
  const { room, ids } = setup();
  everyoneVotes(room, ids, () => 1);
  const t = turn(room);
  byId(room, t.holderId!).jokers = [{ id: "b", type: "bounce" }];
  throwsCode(() => act(room, t.holderId!, { type: "useJoker", turnKey: t.key, joker: "bounce" }), "not_passed");
});

test("prenda alternativa: unanimidad, rechazo vuelve a elegir, aceptada cuenta como alternativa", () => {
  const { room, ids } = setup(["A", "B", "C", "D"]);
  everyoneVotes(room, ids, () => 2);
  const t = turn(room);
  const h = t.holderId!;
  const voters = ids.filter((i) => i !== h);
  act(room, h, { type: "propose", turnKey: t.key, text: "Cantar un tema" });
  throwsCode(() => act(room, h, { type: "altVote", turnKey: t.key, accept: true }), "not_voter");
  act(room, voters[0], { type: "altVote", turnKey: t.key, accept: true });
  throwsCode(() => act(room, voters[0], { type: "altVote", turnKey: t.key, accept: false }), "already_voted");
  act(room, voters[1], { type: "altVote", turnKey: t.key, accept: false });
  assert.equal(turn(room).stage, "choosing", "un rechazo alcanza");
  assert.equal(turn(room).altRejected.length, 1);
  act(room, h, { type: "propose", turnKey: t.key, text: "Bailar 30 segundos" });
  voters.forEach((v) => act(room, v, { type: "altVote", turnKey: t.key, accept: true }));
  assert.equal(turn(room).stage, "confirming");
  assert.equal(turn(room).resolution?.kind, "alt");
  judgeConfirms(room);
  assert.equal(byId(room, h).total.alt, 1);
  assert.equal(byId(room, h).total.done, 0);
});

test("retiro y 'no lo cumplió' (árbitro) se registran aparte de lo cumplido", () => {
  const { room, ids } = setup();
  everyoneVotes(room, ids, () => 1);
  let t = turn(room);
  act(room, t.holderId!, { type: "withdraw", turnKey: t.key });
  judgeConfirms(room);
  assert.equal(byId(room, t.holderId!).total.withdrawn, 1);
  everyoneVotes(room, ids, () => 1);
  t = turn(room);
  const h2 = t.holderId!;
  act(room, h2, { type: "fulfill", turnKey: t.key });
  judgeConfirms(room, "fail");
  assert.equal(byId(room, h2).total.done, 0);
  assert.ok(byId(room, h2).total.withdrawn >= 1);
});

test("ronda completa: N turnos, comodín nuevo, resumen; todos 'seguimos' => nueva ronda con retos nuevos", () => {
  const { room, ids } = setup(["A", "B", "C"]);
  const before = room.players.reduce((n, p) => n + p.jokers.length, 0);
  for (let i = 0; i < 3; i++) {
    everyoneVotes(room, ids, (k) => ((k + i) % 3) + 1);
    const t = turn(room);
    act(room, t.holderId!, { type: "fulfill", turnKey: t.key });
    judgeConfirms(room);
  }
  assert.equal(room.phase, "summary");
  assert.equal(room.pool.length, 0, "cada reto usado se retira");
  assert.equal(room.summary!.turns, 3);
  assert.equal(room.players.reduce((n, p) => n + p.jokers.length, 0), before + 1);
  assert.equal(room.summary!.rows.reduce((n, r) => n + r.done, 0), 3);
  act(room, ids[0], { type: "ready", ready: true }); act(room, ids[1], { type: "ready", ready: true });
  assert.equal(room.phase, "summary", "falta uno");
  act(room, ids[2], { type: "ready", ready: true });
  assert.equal(room.phase, "writing");
  assert.equal(room.round, 2);
  assert.ok(room.players.every((p) => p.challenge === null && p.round.done === 0 && !p.ready));
  ids.forEach((id, i) => act(room, id, { type: "submitChallenge", text: `Segunda ronda ${i}` }));
  assert.equal(room.phase, "turn");
  assert.equal(turn(room).key, "2-1");
});

test("una misma persona puede salir más de una vez en la ronda (selección por votos, sin tope)", () => {
  const { room, ids } = setup(["A", "B", "C", "D"]);
  const holders: string[] = [];
  for (let i = 0; i < 2; i++) {
    const t = turn(room);
    const target = t.cards.indexOf(ids[0]) + 1; // todos votan la carta donde está A
    votePlayers(room, ids, () => target);
    holders.push(turn(room).holderId!);
    ids.filter((id) => id !== ids[0]).forEach((id) => act(room, id, { type: "pick", turnKey: t.key, card: 1 }));
    act(room, ids[0], { type: "fulfill", turnKey: t.key });
    judgeConfirms(room);
  }
  assert.deepEqual(holders, [ids[0], ids[0]]);
});

test("dos votaciones: primero a quién le toca, después qué reto; nunca sale un reto del elegido", () => {
  for (let seed = 0; seed < 40; seed++) {
    const { room, ids } = setup(["A", "B", "C", "D", "E"]);
    const r = seeded(seed);
    const key = turn(room).key;
    ids.forEach((id, i) => applyAction(room, id, { type: "vote", turnKey: key, card: (i % 5) + 1 }, NOW, r));
    const t = turn(room);
    assert.equal(t.stage, "picking");
    assert.ok(t.revealed && !t.challengeRevealed, "se sabe a quién le toca pero todavía no el reto");
    assert.equal(t.challengeText, null);
    const authors = new Map(room.pool.map((c) => [c.id, c.authorId]));
    assert.ok(t.challengeCards.length === 4 && t.challengeCards.every((id) => authors.get(id) !== t.holderId), "las cartas de reto excluyen el reto del elegido");
    const voters = ids.filter((id) => id !== t.holderId);
    throwsCode(() => act(room, t.holderId!, { type: "pick", turnKey: t.key, card: 1 }), "not_voter");
    throwsCode(() => act(room, voters[0], { type: "pick", turnKey: t.key, card: 9 }), "bad_input");
    voters.forEach((id, i) => applyAction(room, id, { type: "pick", turnKey: t.key, card: (i % 4) + 1 }, NOW, r));
    assert.equal(t.stage, "choosing");
    assert.ok(t.challengeRevealed && t.challengeText);
    assert.notEqual(room.history.length > 99, true);
    const chosenAuthor = [...authors.entries()].find(([id]) => id === t.challengeId)![1];
    assert.notEqual(chosenAuthor, t.holderId, "nadie hace el reto que escribió");
    assert.equal(room.pool.length, 4, "el reto usado se retira del conjunto");
  }
});

test("votar el reto: un voto por persona, empate se sortea, y si nadie vota cualquiera cierra pasado el tiempo", () => {
  const { room, ids } = setup(["A", "B", "C", "D"]);
  votePlayers(room, ids, () => 1);
  const t = turn(room);
  const [v1, v2, v3] = ids.filter((id) => id !== t.holderId);
  act(room, v1, { type: "pick", turnKey: t.key, card: 2 });
  throwsCode(() => act(room, v1, { type: "pick", turnKey: t.key, card: 1 }), "already_voted");
  throwsCode(() => act(room, v2, { type: "closeVoting", turnKey: t.key }), "too_early");
  throwsCode(() => act(room, t.holderId!, { type: "closeVoting", turnKey: t.key }, LATE), "not_allowed");
  act(room, v2, { type: "closeVoting", turnKey: t.key }, LATE);
  assert.equal(t.pickWinner, 2, "gana la única carta votada");
  assert.equal(t.stage, "choosing");
  void v3;
  const seen = new Set<number>();
  for (let s = 0; s < 40; s++) {
    const g = setup(["A", "B", "C", "D"]);
    votePlayers(g.room, g.ids, () => 1);
    const tt = turn(g.room);
    const vs = g.ids.filter((id) => id !== tt.holderId);
    const r = seeded(s);
    applyAction(g.room, vs[0], { type: "pick", turnKey: tt.key, card: 1 }, NOW, r);
    applyAction(g.room, vs[1], { type: "pick", turnKey: tt.key, card: 2 }, NOW, r);
    applyAction(g.room, vs[2], { type: "pick", turnKey: tt.key, card: 3 }, NOW, r);
    assert.deepEqual(tt.pickTied, [1, 2, 3]);
    seen.add(tt.pickWinner!);
  }
  assert.equal(seen.size, 3, "las cartas empatadas pueden ganar");
});

test("último reto: si solo queda el reto de la persona más votada, sale otra carta y el reto se asigna solo", () => {
  const { room, ids } = setup(["A", "B", "C"]);
  const authorOf = room.pool[0].authorId;
  room.pool = [room.pool[0]];                      // queda un único reto, escrito por "authorOf"
  const t = turn(room);
  const target = t.cards.indexOf(authorOf) + 1;
  votePlayers(room, ids, () => target);            // todos votan la carta del autor
  assert.notEqual(t.holderId, authorOf, "al autor no le puede tocar su propio reto");
  assert.equal(t.stage, "choosing", "con un solo reto posible no hay segunda votación");
  assert.ok(t.challengeRevealed && t.challengeText);
  assert.ok(t.events.some((e) => e.includes("no podía salir")));
  assert.equal(room.pool.length, 0);
});

test("cualquiera pausa y reanuda; terminar se vota por mayoría; irse de la sala", () => {
  const { room, ids } = setup(["A", "B", "C", "D"]);
  act(room, ids[2], { type: "pause" });
  assert.equal(room.paused, true);
  throwsCode(() => act(room, ids[1], { type: "vote", turnKey: turn(room).key, card: 1 }), "paused");
  act(room, ids[1], { type: "resume" });
  act(room, ids[1], { type: "vote", turnKey: turn(room).key, card: 1 });
  act(room, ids[0], { type: "voteEnd", on: true });
  act(room, ids[1], { type: "voteEnd", on: true });
  assert.equal(room.phase, "turn", "2 de 4 no es mayoría");
  act(room, ids[2], { type: "voteEnd", on: true });
  assert.equal(room.phase, "ended");
  assert.ok(buildView(room, ids[0], NOW, {}, 1).final);
  throwsCode(() => act(room, ids[1], { type: "vote", turnKey: "1-1", card: 1 }), "ended");
  // irse en el lobby
  const { room: r2, playerId } = createRoom("X", NOW, "BCDL");
  const y = addPlayer(r2, "Y", NOW).playerId;
  act(r2, y, { type: "leave" });
  assert.equal(r2.players.length, 1);
  assert.equal(playerId, r2.players[0].id);
  // no se puede irse en medio de un turno
  const s = setup(["A", "B", "C"]);
  throwsCode(() => act(s.room, s.ids[0], { type: "leave" }), "wrong_phase");
});

test("secretos: la vista no filtra autoría, retos antes de revelar, cartas->nombre/reto, votos ni comodines ajenos; no hay anfitrión", () => {
  const { room, ids } = setup(["A", "B", "C", "D"]);
  act(room, ids[0], { type: "vote", turnKey: turn(room).key, card: 3 });
  room.players[1].jokers = [{ id: "secretoj", type: "pass" }];
  const spy = buildView(room, ids[2], NOW, {}, 1);
  const s = JSON.stringify(spy);
  assert.ok(!/Reto numero [124]/.test(s), "ningún reto ajeno viaja antes de revelar (el propio sí: lo escribió quien mira)");
  assert.ok(!s.includes("authorId") && !s.includes("tokenHash") && !s.includes("secretoj"));
  assert.ok(!s.includes('"cards"') && !s.includes("challengeCards") && !s.includes("hostId") && !s.includes("isHost"));
  assert.equal(spy.turn!.myVote, null);
  assert.deepEqual(spy.turn!.voted, [ids[0]]);
  assert.equal(buildView(room, ids[0], NOW, {}, 1).turn!.myVote, 3, "cada uno ve su propio voto");
  ids.slice(1).forEach((id) => act(room, id, { type: "vote", turnKey: turn(room).key, card: 3 }));
  // a quién le toca ya se sabe; el reto todavía no, y las cartas de reto no muestran su contenido
  const mid = JSON.stringify(buildView(room, ids[2], NOW, {}, 2));
  assert.ok(!/Reto numero [124]/.test(mid) && !mid.includes("challengeCards"));
  const holder = turn(room).holderId!;
  const voters = ids.filter((id) => id !== holder);
  act(room, voters[0], { type: "pick", turnKey: turn(room).key, card: 2 });
  assert.equal(buildView(room, voters[1], NOW, {}, 2).turn!.myPick, null, "el voto del reto de otro no se ve");
  voters.slice(1).forEach((id) => act(room, id, { type: "pick", turnKey: turn(room).key, card: 2 }));
  const after = JSON.stringify(buildView(room, ids[2], NOW, {}, 3));
  assert.ok(after.includes(turn(room).challengeText as string));
  assert.ok(!after.includes("authorId"));
});

test("textos: se limpian caracteres de control, bidi e invisibles; React escapa el resto", () => {
  assert.equal(cleanText("  hola‮  \n\t mundo\u0000 ", 50), "hola mundo");
  assert.equal(cleanText("x".repeat(500), 140).length, 140);
  assert.equal(cleanText(42, 10), "");
  const { room } = createRoom("<img src=x onerror=alert(1)>", NOW, "BCDH");
  assert.equal(room.players[0].name, "<img src=x onerror=alert(1)>".slice(0, 20), "se guarda como texto; la UI nunca usa innerHTML");
});

test("nombres únicos y reconexión: el token correcto identifica, el viejo deja de servir al reclamar", () => {
  const { room, token, playerId } = createRoom("Ana", NOW, "BCDJ");
  throwsCode(() => addPlayer(room, "ana", NOW), "name_taken");
  assert.ok(tokenMatches(getPlayer(room, playerId)!, token));
  const r = reclaimPlayer(room, "Ana")!;
  assert.equal(r.playerId, playerId);
  assert.equal(tokenMatches(getPlayer(room, playerId)!, token), false);
  assert.ok(tokenMatches(getPlayer(room, playerId)!, r.token));
});

test("titular que no responde: otro jugador lo registra como retiro pasado el tiempo; el titular no puede saltearse", () => {
  const { room, ids } = setup();
  everyoneVotes(room, ids, () => 1);
  const t = turn(room);
  const other = ids.find((i) => i !== t.holderId)!;
  throwsCode(() => act(room, other, { type: "skipHolder", turnKey: t.key }), "too_early");
  throwsCode(() => act(room, t.holderId!, { type: "skipHolder", turnKey: t.key }, LATE), "not_allowed");
  act(room, other, { type: "skipHolder", turnKey: t.key }, LATE);
  assert.equal(turn(room).resolution?.kind, "withdraw");
  judgeConfirms(room);
  everyoneVotes(room, ids, () => 1);
  const t2 = turn(room);
  act(room, t2.holderId!, { type: "propose", turnKey: t2.key, text: "Hacer un brindis" });
  const v = ids.find((i) => i !== t2.holderId)!;
  act(room, v, { type: "altVote", turnKey: t2.key, accept: true });
  throwsCode(() => act(room, v, { type: "altClose", turnKey: t2.key }), "too_early");
  act(room, v, { type: "altClose", turnKey: t2.key }, LATE);
  assert.equal(turn(room).stage, "confirming");
});

test("sin retos de alguien: cualquiera sigue pasado el tiempo (mínimo 2 retos)", () => {
  const { room, playerId } = createRoom("A", NOW, "BCDM");
  const b = addPlayer(room, "B", NOW).playerId, c = addPlayer(room, "C", NOW).playerId;
  [playerId, b, c].forEach((id) => act(room, id, { type: "ready", ready: true }));
  act(room, playerId, { type: "submitChallenge", text: "Primer reto" });
  throwsCode(() => act(room, c, { type: "forceVoting" }, LATE), "few_challenges");
  act(room, b, { type: "submitChallenge", text: "Segundo reto" });
  throwsCode(() => act(room, c, { type: "forceVoting" }), "too_early");
  act(room, c, { type: "forceVoting" }, LATE);
  assert.equal(room.phase, "turn");
  assert.equal(room.roundSize, 2);
});

test("límite de 15 jugadores por sala", () => {
  const { room } = createRoom("J1", NOW, "BCDK");
  for (let i = 2; i <= 15; i++) addPlayer(room, `J${i}`, NOW);
  assert.equal(room.players.length, 15);
  throwsCode(() => addPlayer(room, "J16", NOW), "full");
});

test("con 15 jugadores la ronda reparte 15 cartas y 15 retos", () => {
  const { room, ids } = setup(Array.from({ length: 15 }, (_, i) => `P${i + 1}`));
  assert.equal(room.roundSize, 15);
  assert.equal(turn(room).cards.length, 15);
  assert.equal(new Set(turn(room).cards).size, 15);
  assert.equal(ids.length, 15);
});

test("revancha: misma sala y jugadores, todo en cero, vuelven a estar 'listos'; solo al terminar", () => {
  const { room, ids } = setup(["A", "B", "C"]);
  throwsCode(() => act(room, ids[0], { type: "rematch" }), "wrong_phase");
  everyoneVotes(room, ids, () => 1);
  const t = turn(room);
  act(room, t.holderId!, { type: "fulfill", turnKey: t.key });
  judgeConfirms(room);
  ids.slice(0, 2).forEach((id) => act(room, id, { type: "voteEnd", on: true }));
  assert.equal(room.phase, "ended");
  act(room, ids[2], { type: "rematch" });
  assert.equal(room.phase, "lobby");
  assert.equal(room.players.length, 3);
  assert.ok(room.players.every((p) => !p.ready && p.active && p.jokers.length === 0 && p.total.done === 0 && p.challenge === null));
  assert.equal(room.history.length, 0);
  assert.equal(room.round, 0);
  ids.forEach((id) => act(room, id, { type: "ready", ready: true }));
  assert.equal(room.phase, "writing", "se puede volver a jugar");
  assert.equal(room.round, 1);
});
