import { GameError, getPlayer, tokenMatches } from "./engine";
import type { Room } from "./engine";

export const json = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

export function fail(e: unknown) {
  if (e instanceof GameError) return json({ error: { code: e.code, message: e.message } }, e.status);
  console.error(e);
  return json({ error: { code: "server", message: "Algo falló en el servidor. Probá de nuevo." } }, 500);
}

export function authPlayer(room: Room, req: Request) {
  const token = req.headers.get("x-player-token") ?? "";
  const id = req.headers.get("x-player-id") ?? "";
  const p = getPlayer(room, id);
  if (!p || !token || !tokenMatches(p, token)) throw new GameError("auth", "Tu sesión en la sala no es válida. Volvé a entrar.", 401);
  return p;
}

export async function readBody(req: Request): Promise<Record<string, unknown>> {
  const raw = await req.text();
  if (raw.length > 4000) throw new GameError("too_big", "Mensaje demasiado largo.", 413);
  try { const v = JSON.parse(raw || "{}"); return v && typeof v === "object" ? v : {}; } catch { throw new GameError("bad_json", "Pedido inválido."); }
}
