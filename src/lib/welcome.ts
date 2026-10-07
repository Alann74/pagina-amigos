import { randomInt } from "node:crypto";
import { and, eq, isNull, or } from "drizzle-orm";
import { db } from "@/db";
import { subscribers, type Subscriber } from "@/db/schema";

// Pop-up de bienvenida: la clienta deja mail y WhatsApp y recibe un código con descuento
// para la primera compra pagando en efectivo o transferencia.

/** Últimos 8 dígitos: reconoce el mismo número escrito con 0, 15, +54 9, espacios o guiones. */
export function phoneKey(phone: string): string {
  return phone.replace(/\D/g, "").slice(-8);
}

const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // sin 0/O ni 1/I/L, para dictarlo sin errores

export function newWelcomeCode(): string {
  let code = "HOLA-";
  for (let i = 0; i < 5; i++) code += ALPHABET[randomInt(ALPHABET.length)];
  return code;
}

export function normalizeWelcomeCode(code: string | null | undefined): string | null {
  const c = (code ?? "").trim().toUpperCase().replace(/\s+/g, "");
  return /^[A-Z0-9-]{4,20}$/.test(c) ? c : null;
}

/** Suscripta con el beneficio sin usar: por el código que trae el navegador o por el teléfono del pedido. */
export async function findUnusedWelcome(code: string | null | undefined, phone: string): Promise<Subscriber | null> {
  const normalized = normalizeWelcomeCode(code);
  const key = phoneKey(phone);
  const conditions = [normalized ? eq(subscribers.code, normalized) : undefined, key.length === 8 ? eq(subscribers.phoneKey, key) : undefined].filter(
    (c): c is NonNullable<typeof c> => Boolean(c),
  );
  if (conditions.length === 0) return null;
  const rows = await db
    .select()
    .from(subscribers)
    .where(and(isNull(subscribers.usedAt), or(...conditions)))
    .limit(2);
  // Si hay coincidencia por código, esa manda
  return rows.find((r) => r.code === normalized) ?? rows[0] ?? null;
}
