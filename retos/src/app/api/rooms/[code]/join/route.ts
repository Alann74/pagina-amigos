import { GameError, addPlayer, getPlayer, normalizeCode, reclaimPlayer, tokenMatches } from "@/lib/engine";
import { fail, json, readBody } from "@/lib/api";
import { getStore } from "@/lib/store";
import { PRESENCE_MS } from "@/lib/view";

export const dynamic = "force-dynamic";

export async function POST(req: Request, ctx: { params: Promise<{ code: string }> }) {
  try {
    const code = normalizeCode((await ctx.params).code);
    const body = await readBody(req);
    const store = await getStore();
    const now = Date.now();
    const out = await store.mutate(code, (room, presence) => {
      // Reconexión con credencial guardada
      const pid = String(body.playerId ?? ""), tok = String(body.token ?? "");
      const existing = getPlayer(room, pid);
      if (existing && tok && tokenMatches(existing, tok)) return { playerId: existing.id, token: tok, reconnected: true };
      try {
        return { ...addPlayer(room, String(body.name ?? ""), now), reconnected: false };
      } catch (e) {
        // Mismo nombre: solo se recupera el lugar si esa persona parece desconectada (cambio de celular, etc.)
        if (e instanceof GameError && e.code === "name_taken") {
          const dup = room.players.find((p) => p.name.toLowerCase() === String(body.name ?? "").trim().toLowerCase());
          if (dup && now - (presence[dup.id] ?? 0) > PRESENCE_MS) {
            const r = reclaimPlayer(room, dup.name);
            if (r) return { ...r, reconnected: true };
          }
          throw new GameError("name_taken", "Ese nombre ya está en uso y esa persona está conectada. Elegí otro.", 409);
        }
        throw e;
      }
    });
    if (!out) throw new GameError("not_found", "No encontramos esa sala. Revisá el código.", 404);
    return json({ code, ...out.result });
  } catch (e) { return fail(e); }
}
