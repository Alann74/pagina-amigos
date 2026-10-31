// Construye lo que ve CADA jugador. Nunca incluye autoría de retos, reto en curso antes de revelar,
// cartas->nombre, votos ajenos antes de la revelación ni comodines ajenos.
import { activePlayers, altVoters, canProceed, getPlayer, pickVoters } from "./engine";
import type { Room } from "./engine";
import { PRESENCE_MS } from "./types";
import type { RoomView, ViewTurn } from "./types";

export { PRESENCE_MS };

export function buildView(room: Room, viewerId: string, now: number, presence: Record<string, number>, version: number): RoomView {
  const me = getPlayer(room, viewerId)!;
  const act = activePlayers(room);
  const isConnected = (id: string) => id === viewerId || now - (presence[id] ?? 0) < PRESENCE_MS;
  const t = room.turn;
  let turn: ViewTurn | null = null;
  if (t && room.phase === "turn") {
    turn = {
      key: t.key, n: t.n, stage: t.stage, stageAt: t.stageAt, cardCount: t.cards.length,
      voted: Object.keys(t.votes), myVote: t.votes[viewerId] ?? null, revealed: t.revealed,
    };
    if (t.revealed) {
      const isHolder = t.holderId === viewerId;
      const hasPass = me.jokers.some((j) => j.type === "pass");
      const hasBounce = me.jokers.some((j) => j.type === "bounce");
      const passTargets = act.filter((p) => !t.chain.includes(p.id)).map((p) => p.id);
      Object.assign(turn, {
        revealedAt: t.revealedAt, winnerCard: t.winnerCard, tally: t.tally, tied: t.tied,
        challengeRevealed: t.challengeRevealed,
        pickCount: t.challengeCards.length, pickVoted: Object.keys(t.pickVotes), pickVoters: pickVoters(room, t), myPick: t.pickVotes[viewerId] ?? null,
        ...(t.challengeRevealed ? { challenge: t.challengeText as string, challengeRevealedAt: t.challengeRevealedAt, pickWinner: t.pickWinner, pickTally: t.pickTally, pickTied: t.pickTied } : {}),
        holderId: t.holderId, originalId: t.originalId, chain: t.chain, shared: t.shared, partnerId: t.partnerId, judgeId: t.judgeId,
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
    id: p.id, name: p.name, connected: isConnected(p.id),
    active: p.active, ready: p.ready, written: !!p.challenge,
    done: p.total.done, alt: p.total.alt, withdrawn: p.total.withdrawn, score: p.total.done + p.total.alt,
  }));
  return {
    code: room.code, version, serverNow: now, phase: room.phase, phaseAt: room.phaseAt, paused: room.paused,
    pausedBy: room.pausedBy, smoke: room.smoke, round: room.round, roundSize: room.roundSize, resolved: room.resolved,
    me: { id: me.id, name: me.name, active: me.active, ready: me.ready, endVote: room.endVotes.includes(me.id), jokers: me.jokers, myChallenge: me.challenge },
    players, writtenCount: act.filter((p) => p.challenge).length, activeCount: act.length,
    readyCount: room.players.filter((p) => p.ready).length,
    canStart: me.ready && canProceed(room, isConnected),
    endVotes: room.endVotes.filter((id) => getPlayer(room, id)?.active).length,
    turn, history: room.history.slice(0, 60),
    summary: room.summary,
    final: room.phase === "ended"
      ? { rows: [...room.players].sort((a, b) => (b.total.done + b.total.alt) - (a.total.done + a.total.alt) || a.total.withdrawn - b.total.withdrawn)
          .map((p) => ({ playerId: p.id, name: p.name, ...p.total, score: p.total.done + p.total.alt })) }
      : null,
  };
}
