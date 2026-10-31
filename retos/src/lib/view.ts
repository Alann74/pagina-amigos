// Construye lo que ve CADA jugador. Nunca incluye autoría de retos, reto en curso antes de revelar,
// cartas->nombre, votos ajenos antes de la revelación ni comodines ajenos.
import { activePlayers, altVoters, getPlayer } from "./engine";
import type { Room } from "./engine";
import type { RoomView, ViewTurn } from "./types";

export const PRESENCE_MS = 15000;

export function buildView(room: Room, viewerId: string, now: number, presence: Record<string, number>, version: number): RoomView {
  const me = getPlayer(room, viewerId)!;
  const act = activePlayers(room);
  const t = room.turn;
  let turn: ViewTurn | null = null;
  if (t && room.phase === "turn") {
    turn = {
      key: t.key, n: t.n, stage: t.stage, cardCount: t.cards.length,
      voted: Object.keys(t.votes), myVote: t.votes[viewerId] ?? null, revealed: t.revealed,
    };
    if (t.revealed) {
      const isHolder = t.holderId === viewerId;
      const hasPass = me.jokers.some((j) => j.type === "pass");
      const hasBounce = me.jokers.some((j) => j.type === "bounce");
      const passTargets = act.filter((p) => !t.chain.includes(p.id)).map((p) => p.id);
      Object.assign(turn, {
        revealedAt: t.revealedAt, winnerCard: t.winnerCard, tally: t.tally, tied: t.tied, challenge: t.challengeText,
        holderId: t.holderId, originalId: t.originalId, chain: t.chain, shared: t.shared, partnerId: t.partnerId,
        alt: t.alt ? {
          text: t.alt.text, proposerId: t.alt.proposerId, voted: Object.keys(t.alt.votes),
          eligible: altVoters(room, t), myVote: viewerId in t.alt.votes ? t.alt.votes[viewerId] : null,
        } : null,
        altRejected: t.altRejected, resolution: t.resolution, events: t.events,
        options: {
          hasJokers: me.jokers.length > 0,
          canPass: isHolder && !t.shared && hasPass && passTargets.length > 0,
          passTargets: isHolder ? passTargets : [],
          canBounce: isHolder && !t.shared && hasBounce && t.chain.length >= 2,
        },
      } satisfies Partial<ViewTurn>);
    }
  }
  const players = room.players.map((p) => ({
    id: p.id, name: p.name, isHost: p.id === room.hostId,
    connected: p.id === viewerId || now - (presence[p.id] ?? 0) < PRESENCE_MS,
    active: p.active, written: !!p.challenge,
    done: p.total.done, alt: p.total.alt, withdrawn: p.total.withdrawn, score: p.total.done + p.total.alt,
  }));
  return {
    code: room.code, version, serverNow: now, phase: room.phase, paused: room.paused,
    round: room.round, roundSize: room.roundSize, resolved: room.resolved, startJokers: room.startJokers, hostId: room.hostId,
    me: { id: me.id, name: me.name, isHost: me.id === room.hostId, active: me.active, jokers: me.jokers, myChallenge: me.challenge },
    players, writtenCount: act.filter((p) => p.challenge).length, activeCount: act.length,
    turn, history: room.history.slice(0, 60),
    summary: room.summary,
    final: room.phase === "ended"
      ? { rows: [...room.players].sort((a, b) => (b.total.done + b.total.alt) - (a.total.done + a.total.alt) || a.total.withdrawn - b.total.withdrawn)
          .map((p) => ({ playerId: p.id, name: p.name, ...p.total, score: p.total.done + p.total.alt })) }
      : null,
  };
}
