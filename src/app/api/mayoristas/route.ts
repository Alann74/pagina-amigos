import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { db } from "@/db";
import { wholesaleCustomers } from "@/db/schema";
import { clientIp, isBlocked, recordFailure } from "@/lib/rate-limit";
import {
  createGuestToken,
  createWholesaleToken,
  customerByCode,
  getWholesaleSession,
  getWholesaleSettings,
  isSharedCode,
  clearWholesaleCookies,
  setWholesaleCookies,
  wholesaleFromCookie,
} from "@/lib/wholesale";
import { WHOLESALE_COOKIE } from "@/lib/wholesale-config";

const PRIVATE = { "Cache-Control": "private, no-store" };
const clearCookies = clearWholesaleCookies;

// POST /api/mayoristas { code } → entra al modo mayorista con su código personal (lo manda INEDITA al
// aprobarlo) o con el código general (ve los precios; para pedir se registra)
export async function POST(request: Request) {
  const key = `mayorista:${clientIp(request.headers)}`;
  if (isBlocked(key, 10, 15 * 60 * 1000)) return Response.json({ error: "Demasiados intentos. Esperá 15 minutos o escribinos por WhatsApp." }, { status: 429 });
  const body = (await request.json().catch(() => null)) as { code?: unknown } | null;
  const code = typeof body?.code === "string" ? body.code.slice(0, 60) : "";
  const config = await getWholesaleSettings();
  if (!config.enabled) return Response.json({ error: "El acceso mayorista no está habilitado en este momento." }, { status: 403 });
  const customer = code ? await customerByCode(code) : null;
  if (customer?.codeHash) {
    await db.update(wholesaleCustomers).set({ lastLoginAt: new Date() }).where(eq(wholesaleCustomers.id, customer.id));
    await setWholesaleCookies(createWholesaleToken(customer.id, customer.codeHash));
    return Response.json({ ok: true, name: customer.name }, { headers: PRIVATE });
  }
  if (isSharedCode(code, config.sharedCode)) {
    await setWholesaleCookies(createGuestToken(0, config.sharedCode));
    return Response.json({ ok: true, guest: true }, { headers: PRIVATE });
  }
  recordFailure(key);
  return Response.json({ error: "Código incorrecto" }, { status: 401 });
}

// GET /api/mayoristas → precios por mayor (solo con acceso válido)
export async function GET() {
  const store = await cookies();
  const access = await wholesaleFromCookie(store.get(WHOLESALE_COOKIE)?.value);
  if (!access) {
    await clearCookies();
    return Response.json({ error: "Sin acceso mayorista" }, { status: 401, headers: PRIVATE });
  }
  return Response.json(await getWholesaleSession(access), { headers: PRIVATE });
}

// DELETE /api/mayoristas → sale del modo mayorista
export async function DELETE() {
  await clearCookies();
  return Response.json({ ok: true }, { headers: PRIVATE });
}
