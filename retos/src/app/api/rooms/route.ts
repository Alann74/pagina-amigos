import { GameError, cryptoRng, createRoom, newRoomCode } from "@/lib/engine";
import { fail, json, readBody } from "@/lib/api";
import { getStore } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = await readBody(req);
    const store = await getStore();
    const now = Date.now();
    for (let i = 0; i < 8; i++) {
      const code = newRoomCode(cryptoRng);
      const { room, token, playerId } = createRoom(String(body.name ?? ""), now, code);
      if (await store.create(room)) return json({ code, token, playerId });
    }
    throw new GameError("busy", "No pudimos generar una sala. Probá de nuevo.", 503);
  } catch (e) { return fail(e); }
}
