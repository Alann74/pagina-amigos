import { GameError, normalizeCode } from "@/lib/engine";
import { authPlayer, fail, json } from "@/lib/api";
import { getStore } from "@/lib/store";
import { PRESENCE_MS, buildView } from "@/lib/view";

export const dynamic = "force-dynamic";

export async function GET(req: Request, ctx: { params: Promise<{ code: string }> }) {
  try {
    const code = normalizeCode((await ctx.params).code);
    const since = Number(new URL(req.url).searchParams.get("since") ?? -1);
    const store = await getStore();
    const loaded = await store.load(code);
    if (!loaded) throw new GameError("not_found", "No encontramos esa sala. Revisá el código.", 404);
    const me = authPlayer(loaded.room, req);
    const now = Date.now();
    await store.touch(code, me.id, now);
    const presence = { ...loaded.presence, [me.id]: now };
    const connected = Object.fromEntries(loaded.room.players.map((p) => [p.id, p.id === me.id || now - (presence[p.id] ?? 0) < PRESENCE_MS]));
    if (since === loaded.version) return json({ version: loaded.version, unchanged: true, connected, serverNow: now });
    return json({ version: loaded.version, connected, view: buildView(loaded.room, me.id, now, presence, loaded.version) });
  } catch (e) { return fail(e); }
}
