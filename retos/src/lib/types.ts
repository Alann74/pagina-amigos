// Tipos compartidos entre servidor y cliente (la vista pública nunca incluye secretos).

export type JokerType = "pass" | "bounce";
export type Phase = "lobby" | "writing" | "turn" | "summary" | "ended";
export type Stage = "voting" | "choosing" | "altVoting" | "confirming";
export type ResolutionKind = "done" | "alt" | "withdraw";

export const IDLE_MS = 45000; // tras este tiempo sin respuesta, cualquiera puede destrabar
export const PRESENCE_MS = 15000;

export interface ViewPlayer {
  id: string;
  name: string;
  connected: boolean;
  active: boolean;
  ready: boolean;
  written: boolean;
  done: number;
  alt: number;
  withdrawn: number;
  score: number;
}

export interface ViewTurn {
  key: string;
  n: number;
  stage: Stage;
  stageAt: number;
  cardCount: number;
  voted: string[];
  myVote: number | null;
  // Solo desde la revelación:
  revealed: boolean;
  revealedAt?: number;
  winnerCard?: number;
  tally?: number[];
  tied?: number[];
  challenge?: string;
  holderId?: string;
  originalId?: string;
  chain?: string[];
  shared?: boolean;
  partnerId?: string | null;
  judgeId?: string | null;
  alt?: { text: string; proposerId: string; voted: string[]; eligible: string[]; myVote: boolean | null } | null;
  altRejected?: string[];
  resolution?: { kind: ResolutionKind; text?: string } | null;
  events?: string[];
  options?: { canPass: boolean; passTargets: string[]; canBounce: boolean; hasJokers: boolean };
}

export interface HistoryEntry {
  id: number;
  round: number;
  n: number;
  challenge: string;
  subjects: string[];
  kind: ResolutionKind;
  text?: string;
  events: string[];
  tied: boolean;
}

export interface SummaryRow {
  playerId: string;
  name: string;
  done: number;
  alt: number;
  withdrawn: number;
}

export interface RoomView {
  code: string;
  version: number;
  serverNow: number;
  phase: Phase;
  phaseAt: number;
  paused: boolean;
  pausedBy: string | null;
  round: number;
  roundSize: number;
  resolved: number;
  me: {
    id: string;
    name: string;
    active: boolean;
    ready: boolean;
    endVote: boolean;
    jokers: { id: string; type: JokerType }[];
    myChallenge: string | null;
  };
  players: ViewPlayer[];
  writtenCount: number;
  activeCount: number;
  readyCount: number;
  canStart: boolean;
  endVotes: number;
  turn: ViewTurn | null;
  history: HistoryEntry[];
  summary: { round: number; rows: SummaryRow[]; turns: number; jokerGranted: boolean } | null;
  final: { rows: (SummaryRow & { score: number })[] } | null;
}

export type Action =
  | { type: "ready"; ready: boolean }
  | { type: "start" }
  | { type: "submitChallenge"; text: string }
  | { type: "forceVoting" }
  | { type: "vote"; turnKey: string; card: number }
  | { type: "closeVoting"; turnKey: string }
  | { type: "fulfill"; turnKey: string }
  | { type: "withdraw"; turnKey: string }
  | { type: "propose"; turnKey: string; text: string }
  | { type: "altVote"; turnKey: string; accept: boolean }
  | { type: "altClose"; turnKey: string }
  | { type: "useJoker"; turnKey: string; joker: JokerType; target?: string }
  | { type: "confirm"; turnKey: string; outcome: "ok" | "fail" }
  | { type: "skipHolder"; turnKey: string }
  | { type: "pause" }
  | { type: "resume" }
  | { type: "voteEnd"; on: boolean }
  | { type: "leave" };

export const LIMITS = { name: 20, challenge: 140, alt: 140, maxPlayers: 15, minPlayers: 3 } as const;
