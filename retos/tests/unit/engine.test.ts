import test from "node:test";
import assert from "node:assert/strict";
import { GameError, addPlayer, applyAction, cleanText, createRoom, getPlayer, reclaimPlayer, tokenMatches } from "../../src/lib/engine";
import type { Rng, Room } from "../../src/lib/engine";
import { buildView } from "../../src/lib/view";
import type { Action } from "../../src/lib/types";

function seeded(seed: number): Rng {
  let s = seed >>> 0;
  return { int: (n) => { if (n <= 1) return 0; s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return Math.floor((((t ^ (t >>> 14)) >>> 0) / 4294967296) * n); } };
}
const rng = seeded(7);
const NOW = 1_000_000;
const act = (r: Room, who: string, a: Action) => applyAction(r, who, a, NOW, rng);
const throwsCode = (fn: () => void, code: string) => assert.throws(fn, (e: unknown) => e instanceof GameError && e.code === code);

function setup(names = ["Ana", "Beto", "Cami", "Dani"], startJokers: 1 | 2 = 2) {
  const { room, playerId: host } = createRoom(names[0], NOW, "BCDF", rng);
  const ids = [host, ...names.slice(1).map((n) => addPlayer(room, n, NOW).playerId)];
  act(room, host, { type: "setSettings", startJokers });
  act(room, host, { type: "start" });
  ids.forEach((id, i) => act(room, id, { type: "submitChallenge", text: `Reto numero ${i + 1}` }));
  return { room, ids, host };
}
const turn = (r: Room) => r.turn!;
function everyoneVotes(r: Room, ids: string[], card: (i: number) => number) {
  ids.forEach((id, i) => act(r, id, { type: "vote", turnKey: turn(r).key, card: card(i) }));
}
const byId = (r: Room, id: string) => getPlayer(r, id)!;

test("inicio: reparte comodines según la configuración y exige 3 jugadores", () => {
  const { room: r0, playerId } = createRoom("Solo", NOW, "BCDG", rng);
  addPlayer(r0, "Otro", NOW);
  throwsCode(() => act(r0, playerId, { type: "start" }), "few_players");
  const { room } = setup(["A", "B", "C", "D", "E"], 2);
  assert.equal(room.players.reduce((n, p) => n + p.jokers.length, 0), 2);
  assert.equal(room.phase, "turn");
  assert.equal(room.roundSize, 5);
  assert.equal(turn(room).cards.length, 5);
  assert.equal(new Set(turn(room).cards).size, 5, "cada carta tiene un nombre distinto");
});

test("votos: uno por persona, sin duplicados, clave vieja rechazada", () => {
  const { room, ids } = setup();
  const key = turn(room).key;
  act(room, ids[0], { type: "vote", turnKey: key, card: 2 });
  throwsCode(() => act(room, ids[0], { type: "vote", turnKey: key, card: 3 }), "already_voted");
  throwsCode(() => act(room, ids[1], { type: "vote", turnKey: key, card: 9 }), "bad_input");
  throwsCode(() => act(room, ids[1], { type: "vote", turnKey: "0-0", card: 1 }), "stale");
  throwsCode(() => act(room, ids[1], { type: "closeVoting", turnKey: key }), "host_only");
});

test("mayoría gana; empate se sortea entre las cartas empatadas", () => {
  const a = setup();
  everyoneVotes(a.room, a.ids, (i) => (i < 3 ? 2 : 4)); // 2 votos a la carta 2... 3 a la 2 y 1 a la 4
  assert.equal(turn(a.room).winnerCard, 2);
  assert.equal(turn(a.room).stage, "choosing");
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

test("el anfitrión puede cerrar la votación con votos parciales o sin votos", () => {
  const { room, ids, host } = setup();
  act(room, ids[1], { type: "vote", turnKey: turn(room).key, card: 4 });
  act(room, host, { type: "closeVoting", turnKey: turn(room).key });
  assert.equal(turn(room).winnerCard, 4);
  const b = setup();
  act(b.room, b.host, { type: "closeVoting", turnKey: turn(b.room).key });
  assert.equal(turn(b.room).tied!.length, 4);
});

test("cumplir -> confirma el anfitrión -> siguiente turno; solo el titular elige", () => {
  const { room, ids, host } = setup();
  everyoneVotes(room, ids, () => 1);
  const t = turn(room);
  const holder = t.holderId!;
  const other = ids.find((i) => i !== holder)!;
  throwsCode(() => act(room, other, { type: "fulfill", turnKey: t.key }), "not_your_turn");
  act(room, holder, { type: "fulfill", turnKey: t.key });
  assert.equal(turn(room).stage, "confirming");
  throwsCode(() => act(room, holder === host ? other : holder, { type: "confirm", turnKey: t.key, outcome: "ok" }), "host_only");
  act(room, host, { type: "confirm", turnKey: t.key, outcome: "ok" });
  assert.equal(byId(room, holder).total.done, 1);
  assert.equal(turn(room).n, 2);
  throwsCode(() => act(room, host, { type: "confirm", turnKey: t.key, outcome: "ok" }), "stale"); // doble toque
});

test("pase: no se puede volver a pasar a quien ya recibió; el receptor puede rebotar y queda compartido", () => {
  const { room, ids, host } = setup(["A", "B", "C", "D"], 1);
  everyoneVotes(room, ids, () => 1);
  const t = turn(room);
  const [h, x, y] = [t.holderId!, ...ids.filter((i) => i !== t.holderId)];
  byId(room, h).jokers = [{ id: "j1", type: "pass" }, { id: "j2", type: "pass" }];
  byId(room, x).jokers = [{ id: "j3", type: "bounce" }, { id: "j4", type: "pass" }];
  throwsCode(() => act(room, h, { type: "useJoker", turnKey: t.key, joker: "pass", target: h }), "already_received");
  act(room, h, { type: "useJoker", turnKey: t.key, joker: "pass", target: x });
  assert.equal(turn(room).holderId, x);
  assert.equal(byId(room, h).jokers.length, 1, "se consumió un comodín");
  throwsCode(() => act(room, h, { type: "fulfill", turnKey: t.key }), "not_your_turn");
  // x pasa a y; y no puede volver a pasárselo a x ni a h
  act(room, x, { type: "useJoker", turnKey: t.key, joker: "pass", target: y });
  throwsCode(() => act(room, y, { type: "useJoker", turnKey: t.key, joker: "pass", target: x }), "no_joker");
  byId(room, y).jokers = [{ id: "j9", type: "pass" }, { id: "j8", type: "bounce" }];
  throwsCode(() => act(room, y, { type: "useJoker", turnKey: t.key, joker: "pass", target: h }), "already_received");
  // y rebota -> compartido con x, sin más comodines
  act(room, y, { type: "useJoker", turnKey: t.key, joker: "bounce" });
  assert.equal(turn(room).shared, true);
  assert.equal(turn(room).partnerId, x);
  throwsCode(() => act(room, y, { type: "useJoker", turnKey: t.key, joker: "pass", target: ids.find((i) => ![h, x, y].includes(i))! }), "shared");
  act(room, y, { type: "fulfill", turnKey: t.key });
  act(room, host, { type: "confirm", turnKey: t.key, outcome: "ok" });
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
  const { room, ids, host } = setup(["A", "B", "C", "D"]);
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
  act(room, host, { type: "confirm", turnKey: t.key, outcome: "ok" });
  assert.equal(byId(room, h).total.alt, 1);
  assert.equal(byId(room, h).total.done, 0);
});

test("retiro y 'no lo cumplió' se registran aparte de lo cumplido", () => {
  const { room, ids, host } = setup();
  everyoneVotes(room, ids, () => 1);
  let t = turn(room);
  act(room, t.holderId!, { type: "withdraw", turnKey: t.key });
  act(room, host, { type: "confirm", turnKey: t.key, outcome: "ok" });
  assert.equal(byId(room, t.holderId!).total.withdrawn, 1);
  everyoneVotes(room, ids, () => 1);
  t = turn(room);
  const h2 = t.holderId!;
  act(room, h2, { type: "fulfill", turnKey: t.key });
  act(room, host, { type: "confirm", turnKey: t.key, outcome: "fail" });
  assert.equal(byId(room, h2).total.done, 0);
  assert.ok(byId(room, h2).total.withdrawn >= 1);
});

test("ronda completa: N turnos, comodín nuevo privado, resumen, nueva ronda con nuevos retos", () => {
  const { room, ids, host } = setup(["A", "B", "C"], 1);
  const before = room.players.reduce((n, p) => n + p.jokers.length, 0);
  for (let i = 0; i < 3; i++) {
    everyoneVotes(room, ids, (k) => ((k + i) % 3) + 1);
    const t = turn(room);
    act(room, t.holderId!, { type: "fulfill", turnKey: t.key });
    act(room, host, { type: "confirm", turnKey: t.key, outcome: "ok" });
  }
  assert.equal(room.phase, "summary");
  assert.equal(room.pool.length, 0, "cada reto usado se retira");
  assert.equal(room.summary!.turns, 3);
  assert.equal(room.players.reduce((n, p) => n + p.jokers.length, 0), before + 1);
  assert.equal(room.summary!.rows.reduce((n, r) => n + r.done, 0), 3);
  throwsCode(() => act(room, ids[1], { type: "nextRound" }), "host_only");
  act(room, host, { type: "nextRound" });
  assert.equal(room.phase, "writing");
  assert.equal(room.round, 2);
  assert.ok(room.players.every((p) => p.challenge === null && p.round.done === 0));
  ids.forEach((id, i) => act(room, id, { type: "submitChallenge", text: `Segunda ronda ${i}` }));
  assert.equal(room.phase, "turn");
  assert.equal(turn(room).key, "2-1");
});

test("una misma persona puede salir más de una vez en la ronda (selección aleatoria)", () => {
  const { room, ids, host } = setup(["A", "B", "C"], 1);
  const holders: string[] = [];
  for (let i = 0; i < 3; i++) {
    const t = turn(room);
    const target = t.cards.indexOf(ids[0]) + 1; // todos votan la carta donde está A
    ids.forEach((id) => act(room, id, { type: "vote", turnKey: t.key, card: target }));
    holders.push(turn(room).holderId!);
    act(room, ids[0], { type: "fulfill", turnKey: t.key });
    act(room, host, { type: "confirm", turnKey: t.key, outcome: "ok" });
  }
  assert.deepEqual(holders, [ids[0], ids[0], ids[0]]);
});

test("pausa bloquea acciones; finalizar muestra el ranking", () => {
  const { room, ids, host } = setup();
  act(room, host, { type: "pause" });
  throwsCode(() => act(room, ids[1], { type: "vote", turnKey: turn(room).key, card: 1 }), "paused");
  throwsCode(() => act(room, ids[1], { type: "resume" }), "host_only");
  act(room, host, { type: "resume" });
  act(room, ids[1], { type: "vote", turnKey: turn(room).key, card: 1 });
  act(room, host, { type: "end" });
  assert.equal(room.phase, "ended");
  assert.ok(buildView(room, host, NOW, {}, 1).final);
  throwsCode(() => act(room, ids[1], { type: "vote", turnKey: "1-1", card: 1 }), "ended");
});

test("secretos: la vista no filtra autoría, reto en curso, cartas->nombre, votos ni comodines ajenos", () => {
  const { room, ids } = setup(["A", "B", "C", "D"]);
  act(room, ids[0], { type: "vote", turnKey: turn(room).key, card: 3 });
  room.players[1].jokers = [{ id: "secretoj", type: "pass" }];
  const spy = buildView(room, ids[2], NOW, {}, 1);
  const s = JSON.stringify(spy);
  assert.ok(!s.includes(turn(room).challengeText), "el reto no se envía antes de revelar");
  assert.ok(!s.includes("authorId") && !s.includes("tokenHash") && !s.includes("secretoj"));
  assert.ok(!s.includes('"cards"'), "no hay mapa carta->jugador");
  assert.equal(spy.turn!.myVote, null);
  assert.deepEqual(spy.turn!.voted, [ids[0]]);
  assert.equal(JSON.stringify(spy.players).includes('"card"'), false);
  assert.equal(buildView(room, ids[0], NOW, {}, 1).turn!.myVote, 3, "cada uno ve su propio voto");
  // tras revelar, el reto sí; pero nunca quién lo escribió
  ids.slice(1).forEach((id) => act(room, id, { type: "vote", turnKey: turn(room).key, card: 3 }));
  const after = JSON.stringify(buildView(room, ids[2], NOW, {}, 2));
  assert.ok(after.includes(turn(room).challengeText));
  assert.ok(!after.includes("authorId"));
  assert.equal(buildView(room, ids[2], NOW, {}, 2).turn!.options!.passTargets.length >= 0, true);
});

test("textos: se limpian caracteres de control, bidi e invisibles; React escapa el resto", () => {
  assert.equal(cleanText("  hola‮  \n\t mundo\u0000 ", 50), "hola mundo");
  assert.equal(cleanText("x".repeat(500), 140).length, 140);
  assert.equal(cleanText(42, 10), "");
  const { room } = createRoom("<img src=x onerror=alert(1)>", NOW, "BCDH", rng);
  assert.equal(room.players[0].name, "<img src=x onerror=alert(1)>".slice(0, 20), "se guarda como texto; la UI nunca usa innerHTML");
});

test("nombres únicos y reconexión: el token correcto identifica, el viejo deja de servir al reclamar", () => {
  const { room, token, playerId } = createRoom("Ana", NOW, "BCDJ", rng);
  throwsCode(() => addPlayer(room, "ana", NOW), "name_taken");
  assert.ok(tokenMatches(getPlayer(room, playerId)!, token));
  const r = reclaimPlayer(room, "Ana")!;
  assert.equal(r.playerId, playerId);
  assert.equal(tokenMatches(getPlayer(room, playerId)!, token), false);
  assert.ok(tokenMatches(getPlayer(room, playerId)!, r.token));
});

test("saltear al titular ausente y cerrar votación de prenda por el anfitrión", () => {
  const { room, ids, host } = setup();
  everyoneVotes(room, ids, () => 1);
  let t = turn(room);
  act(room, host, { type: "hostSkip", turnKey: t.key });
  assert.equal(turn(room).resolution?.kind, "withdraw");
  act(room, host, { type: "confirm", turnKey: t.key, outcome: "ok" });
  everyoneVotes(room, ids, () => 1);
  t = turn(room);
  act(room, t.holderId!, { type: "propose", turnKey: t.key, text: "Hacer un brindis" });
  const v = ids.find((i) => i !== t.holderId)!;
  act(room, v, { type: "altVote", turnKey: t.key, accept: true });
  act(room, host, { type: "altClose", turnKey: t.key });
  assert.equal(turn(room).stage, "confirming");
});

test("límite de 15 jugadores por sala", () => {
  const { room } = createRoom("J1", NOW, "BCDK", rng);
  for (let i = 2; i <= 15; i++) addPlayer(room, `J${i}`, NOW);
  assert.equal(room.players.length, 15);
  throwsCode(() => addPlayer(room, "J16", NOW), "full");
  assert.equal(room.players.length, 15);
});

test("con 15 jugadores la ronda reparte 15 cartas y 15 retos", () => {
  const names = Array.from({ length: 15 }, (_, i) => `P${i + 1}`);
  const { room, ids } = setup(names, 2);
  assert.equal(room.roundSize, 15);
  assert.equal(turn(room).cards.length, 15);
  assert.equal(new Set(turn(room).cards).size, 15);
  assert.equal(ids.length, 15);
});
