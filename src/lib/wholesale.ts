import { createHash, randomInt } from "node:crypto";
import { and, eq, isNotNull } from "drizzle-orm";
import { db } from "@/db";
import { products, settings, wholesaleCustomers } from "@/db/schema";
import { safeEqual, signValue } from "@/lib/admin-auth";
import { DEFAULT_WHOLESALE, type WholesaleSession, type WholesaleSettings } from "@/lib/wholesale-config";

export const WHOLESALE_MAX_AGE = 60 * 24 * 60 * 60; // 60 días

/** Sin caché: la configuración mayorista no se guarda en páginas ni en datos compartidos. */
export async function getWholesaleSettings(): Promise<WholesaleSettings> {
  const row = await db.query.settings.findFirst({ where: eq(settings.key, "wholesale") });
  const { enabled, minAmount, minUnits, cashDiscountPercent, note } = { ...DEFAULT_WHOLESALE, ...((row?.value as Partial<WholesaleSettings>) ?? {}) };
  return { enabled, minAmount, minUnits, cashDiscountPercent, note };
}

export function normalizeCode(code: string): string {
  return code.trim().toUpperCase().replace(/[\s-]+/g, "");
}

/** Huella del código personal: en la base se guarda solo esto, nunca el código. */
export function hashCode(code: string): string {
  return createHash("sha256").update(`inedita-mayorista:${normalizeCode(code)}`).digest("hex");
}

// Sin letras ni números que se confunden (0/O, 1/I/L)
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

/** Código personal nuevo, ej. "K7PM-Q3XD". */
export function newPersonalCode(): string {
  const chars = Array.from({ length: 8 }, () => ALPHABET[randomInt(ALPHABET.length)]);
  return `${chars.slice(0, 4).join("")}-${chars.slice(4).join("")}`;
}

// El token lleva el cliente y la huella de su código: si se le quita el acceso o se le genera otro
// código, los accesos anteriores dejan de valer.
export function createWholesaleToken(customerId: number, codeHash: string): string {
  const exp = Math.floor(Date.now() / 1000) + WHOLESALE_MAX_AGE;
  const payload = `${exp}.${customerId}.${codeHash.slice(0, 16)}`;
  return `${payload}.${signValue("mayorista", payload)}`;
}

export type WholesaleAccess = { config: WholesaleSettings; customer: { id: number; name: string; business: string | null } };

/** Acceso válido: token firmado y vigente, de un cliente aprobado con el mismo código, y el canal mayorista activo. */
export async function wholesaleFromCookie(token: string | undefined | null): Promise<WholesaleAccess | null> {
  if (!token) return null;
  const [exp, id, fp, sig] = token.split(".");
  if (!exp || !id || !fp || !sig || !/^\d+$/.test(exp) || !/^\d+$/.test(id)) return null;
  if (Number(exp) < Math.floor(Date.now() / 1000)) return null;
  try {
    if (!safeEqual(sig, signValue("mayorista", `${exp}.${id}.${fp}`))) return null;
  } catch {
    return null;
  }
  const config = await getWholesaleSettings();
  if (!config.enabled) return null;
  const customer = await db.query.wholesaleCustomers.findFirst({
    where: and(eq(wholesaleCustomers.id, Number(id)), eq(wholesaleCustomers.status, "aprobado")),
    columns: { id: true, name: true, business: true, codeHash: true },
  });
  if (!customer?.codeHash || !customer.codeHash.startsWith(fp)) return null;
  return { config, customer: { id: customer.id, name: customer.name, business: customer.business } };
}

/** Cliente aprobado con ese código personal (o null). */
export async function customerByCode(code: string) {
  if (normalizeCode(code).length < 6) return null;
  return (
    (await db.query.wholesaleCustomers.findFirst({
      where: and(eq(wholesaleCustomers.codeHash, hashCode(code)), eq(wholesaleCustomers.status, "aprobado")),
      columns: { id: true, name: true, codeHash: true },
    })) ?? null
  );
}

export async function getWholesaleSession(access: WholesaleAccess): Promise<WholesaleSession> {
  const rows = await db.select({ id: products.id, price: products.wholesalePrice }).from(products).where(isNotNull(products.wholesalePrice));
  return {
    customer: { name: access.customer.name, business: access.customer.business },
    prices: Object.fromEntries(rows.filter((r) => r.price && r.price > 0).map((r) => [r.id, r.price!])),
    minAmount: access.config.minAmount,
    minUnits: access.config.minUnits,
    cashDiscountPercent: access.config.cashDiscountPercent,
    note: access.config.note,
  };
}
