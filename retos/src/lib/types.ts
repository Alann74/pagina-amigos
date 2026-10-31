// Tipos compartidos entre servidor y cliente (la vista pública nunca incluye secretos).

export type JokerType = "pass" | "bounce";
export type Phase = "lobby" | "writing" | "turn" | "summary" | "ended";
export type Stage = "voting" | "choosing" | "altVoting" | "confirming";
export type ResolutionKind = "done" | "alt" | "withdraw";

export interface ViewPlayer {
  id: string;
  name: string;
  isHost: boolean;
  connected: boolean;
  active: boolean;
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
  paused: boolean;
  round: number;
  roundSize: number;
  resolved: number;
  startJokers: 1 | 2;
  hostId: string;
  me: {
    id: string;
    name: string;
    isHost: boolean;
    active: boolean;
    jokers: { id: string; type: JokerType }[];
    myChallenge: string | null;
  };
  players: ViewPlayer[];
  writtenCount: number;
  activeCount: number;
  turn: ViewTurn | null;
  history: HistoryEntry[];
  summary: { round: number; rows: SummaryRow[]; turns: number; jokerGranted: boolean } | null;
  final: { rows: (SummaryRow & { score: number })[] } | null;
}

export type Action =
  | { type: "setSettings"; startJokers: 1 | 2 }
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
  | { type: "hostSkip"; turnKey: string }
  | { type: "nextRound" }
  | { type: "pause" }
  | { type: "resume" }
  | { type: "end" }
  | { type: "kick"; playerId: string };

export const LIMITS = { name: 20, challenge: 140, alt: 140, maxPlayers: 16, minPlayers: 3 } as const;
