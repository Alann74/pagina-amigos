import { cookies } from "next/headers";
import { connection } from "next/server";
import { ADMIN_COOKIE, verifySessionToken } from "@/lib/admin-auth";

export class UnauthorizedError extends Error {}

async function hasValidSession(): Promise<boolean> {
  const store = await cookies();
  // La sesión vence por fecha: se evalúa siempre en el momento del pedido, nunca en un prerender
  await connection();
  return verifySessionToken(store.get(ADMIN_COOKIE)?.value);
}

/** Verificación en el servidor (además del proxy) para acciones y rutas del admin. */
export async function requireAdmin(): Promise<void> {
  if (!(await hasValidSession())) throw new UnauthorizedError("No autorizado");
}

export async function isAdmin(): Promise<boolean> {
  return hasValidSession();
}
