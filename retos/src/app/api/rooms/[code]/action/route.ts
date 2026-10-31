import { GameError, applyAction, normalizeCode } from "@/lib/engine";
import { authPlayer, fail, json, readBody } from "@/lib/api";
import { getStore } from "@/lib/store";
import { PRESENCE_MS, buildView } from "@/lib/view";
import type { Action } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function POST(req: Request, ctx: { params: Promise<{ code: string }> }) {
  try {
    const code = normalizeCode((await ctx.params).code);
    const body = (await readBody(req)) as unknown as Action;
    if (typeof body.type !== "string") throw new GameError("bad_input", "Acción inválida.");
    const store = await getStore();
    const now = Date.now();
    const pre = await store.load(code);
    if (!pre) throw new GameError("not_found", "No encontramos esa sala.", 404);
    const me = authPlayer(pre.room, req);
    const out = await store.mutate(code, (room, presence) =>
      applyAction(room, me.id, body, now, undefined, (id) => id === me.id || now - (presence[id] ?? 0) < PRESENCE_MS));
    if (!out) throw new GameError("not_found", "No encontramos esa sala.", 404);
    const fresh = await store.load(code);
    return json({ ok: true, version: out.version, view: fresh ? buildView(fresh.room, me.id, now, { ...fresh.presence, [me.id]: now }, fresh.version) : null });
  } catch (e) { return fail(e); }
}
