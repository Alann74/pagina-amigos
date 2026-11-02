"use client";
import type { Action, RoomView } from "./types";

export interface Creds { playerId: string; token: string }
const key = (code: string) => `retos:${code}`;

export function loadCreds(code: string): Creds | null {
  try { const v = JSON.parse(localStorage.getItem(key(code)) ?? "null"); return v?.playerId && v?.token ? v : null; } catch { return null; }
}
export function saveCreds(code: string, c: Creds) { try { localStorage.setItem(key(code), JSON.stringify(c)); } catch { /* modo privado */ } }
export function clearCreds(code: string) { try { localStorage.removeItem(key(code)); } catch { /* */ } }
export function lastName(): string { try { return localStorage.getItem("retos:name") ?? ""; } catch { return ""; } }
export function saveName(n: string) { try { localStorage.setItem("retos:name", n); } catch { /* */ } }

export class ApiError extends Error {
  constructor(public code: string, message: string, public status: number) { super(message); }
}

async function call<T>(url: string, init?: RequestInit & { creds?: Creds | null }): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (init?.creds) { headers["x-player-id"] = init.creds.playerId; headers["x-player-token"] = init.creds.token; }
  let res: Response;
  try { res = await fetch(url, { ...init, headers, cache: "no-store" }); }
  catch { throw new ApiError("network", "Sin conexión. Reintentando…", 0); }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(data?.error?.code ?? "http", data?.error?.message ?? "Algo salió mal.", res.status);
  return data as T;
}

export const api = {
  create: (name: string) => call<{ code: string } & Creds>("/api/rooms", { method: "POST", body: JSON.stringify({ name }) }),
  join: (code: string, name: string, creds?: Creds | null) =>
    call<{ code: string } & Creds>(`/api/rooms/${code}/join`, { method: "POST", body: JSON.stringify({ name, playerId: creds?.playerId, token: creds?.token }) }),
  poll: (code: string, creds: Creds, since: number) =>
    call<{ version: number; unchanged?: boolean; connected: Record<string, boolean>; view?: RoomView }>(`/api/rooms/${code}?since=${since}`, { creds }),
  act: (code: string, creds: Creds, action: Action) =>
    call<{ ok: boolean; view: RoomView | null }>(`/api/rooms/${code}/action`, { method: "POST", body: JSON.stringify(action), creds }),
};
