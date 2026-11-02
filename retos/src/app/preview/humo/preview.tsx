"use client";
import { useState } from "react";
import { SmokeRoulette } from "@/components/Smoke";
import type { RoomView } from "@/lib/types";

const NAMES = ["Ana", "Beto", "Cami", "Dani", "Eli", "Fede"];

export function Preview() {
  const [now] = useState(() => Date.now());
  const params = typeof window !== "undefined" ? new URLSearchParams(location.search) : new URLSearchParams();
  const count = Number(params.get("n") ?? 3);
  const who = Number(params.get("who") ?? 3);
  const view = {
    code: "TEST", version: 1, serverNow: now, phase: "turn", phaseAt: now, paused: false, pausedBy: null, round: 1, roundSize: 6, resolved: 3,
    smoke: { id: "prev", playerId: "p" + who, count, at: now },
    me: { id: "p0", name: NAMES[0], active: true, ready: false, endVote: false, jokers: [], myChallenge: null },
    players: NAMES.map((n, i) => ({ id: "p" + i, name: n, connected: true, active: true, ready: false, written: false, done: 0, alt: 0, withdrawn: 0, score: 0 })),
    writtenCount: 0, activeCount: 6, readyCount: 0, canStart: false, endVotes: 0, turn: null, history: [], summary: null, final: null,
  } as unknown as RoomView;
  return <SmokeRoulette view={view} onNext={async () => null} />;
}
