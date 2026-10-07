import { cookies } from "next/headers";
import { clientIp, isBlocked, recordFailure } from "@/lib/rate-limit";
import { codeMatches, createWholesaleToken, getWholesaleSession, getWholesaleSettings, verifyWholesaleToken, WHOLESALE_MAX_AGE } from "@/lib/wholesale";
import { WHOLESALE_COOKIE, WHOLESALE_FLAG } from "@/lib/wholesale-config";

const PRIVATE = { "Cache-Control": "private, no-store" };
const secure = process.env.NODE_ENV === "production";

async function clearCookies() {
  const store = await cookies();
  store.delete(WHOLESALE_COOKIE);
  store.delete(WHOLESALE_FLAG);
}

// POST /api/mayoristas { code } → entra al modo mayorista
export async function POST(request: Request) {
  const key = `mayorista:${clientIp(request.headers)}`;
  if (isBlocked(key, 10, 15 * 60 * 1000)) return Response.json({ error: "Demasiados intentos. Esperá 15 minutos o escribinos por WhatsApp." }, { status: 429 });
  const body = (await request.json().catch(() => null)) as { code?: unknown } | null;
  const code = typeof body?.code === "string" ? body.code.slice(0, 60) : "";
  const config = await getWholesaleSettings();
  if (!config.enabled || !config.code) return Response.json({ error: "El acceso mayorista no está habilitado en este momento." }, { status: 403 });
  if (!code || !codeMatches(code, config)) {
    recordFailure(key);
    return Response.json({ error: "Código incorrecto" }, { status: 401 });
  }
  const store = await cookies();
  const options = { secure, sameSite: "lax" as const, path: "/", maxAge: WHOLESALE_MAX_AGE };
  store.set(WHOLESALE_COOKIE, createWholesaleToken(config.code), { ...options, httpOnly: true });
  store.set(WHOLESALE_FLAG, "1", { ...options, httpOnly: false });
  return Response.json({ ok: true }, { headers: PRIVATE });
}

// GET /api/mayoristas → precios por mayor (solo con acceso válido)
export async function GET() {
  const store = await cookies();
  const config = await getWholesaleSettings();
  if (!verifyWholesaleToken(store.get(WHOLESALE_COOKIE)?.value, config)) {
    await clearCookies();
    return Response.json({ error: "Sin acceso mayorista" }, { status: 401, headers: PRIVATE });
  }
  return Response.json(await getWholesaleSession(config), { headers: PRIVATE });
}

// DELETE /api/mayoristas → sale del modo mayorista
export async function DELETE() {
  await clearCookies();
  return Response.json({ ok: true }, { headers: PRIVATE });
}
