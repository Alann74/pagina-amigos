// Solo para pruebas automáticas: reparte comodines concretos. Con RETOS_TEST_MODE distinto de "1" no existe.
import { getPlayer, newId, normalizeCode } from "@/lib/engine";
import { fail, json, readBody } from "@/lib/api";
import { getStore } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function POST(req: Request, ctx: { params: Promise<{ code: string }> }) {
  if (process.env.RETOS_TEST_MODE !== "1") return new Response("Not found", { status: 404 });
  try {
    const code = normalizeCode((await ctx.params).code);
    const body = await readBody(req);
    const store = await getStore();
    const out = await store.mutate(code, (room) => {
      for (const p of room.players) p.jokers = [];
      for (const [name, types] of Object.entries((body.jokers ?? {}) as Record<string, ("pass" | "bounce")[]>)) {
        const p = room.players.find((x) => x.name === name) ?? getPlayer(room, name);
        if (p) p.jokers = types.map((type) => ({ id: newId(3), type }));
      }
    });
    return json({ ok: !!out });
  } catch (e) { return fail(e); }
}
