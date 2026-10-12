import { createHash, randomInt } from "node:crypto";
import { and, count, eq, isNotNull, ne } from "drizzle-orm";
import { db } from "@/db";
import { orders, products, settings, wholesaleCustomers } from "@/db/schema";
import { safeEqual, signValue } from "@/lib/admin-auth";
import { cookies } from "next/headers";
import { DEFAULT_WHOLESALE, WHOLESALE_COOKIE, WHOLESALE_FLAG, type WholesaleSession, type WholesaleSettings } from "@/lib/wholesale-config";

export const WHOLESALE_MAX_AGE = 60 * 24 * 60 * 60; // 60 días

/** Deja entrar al modo mayorista: la cookie firmada (solo la lee el servidor) y el aviso para el navegador. */
export async function setWholesaleCookies(token: string) {
  const store = await cookies();
  const options = { secure: process.env.NODE_ENV === "production", sameSite: "lax" as const, path: "/", maxAge: WHOLESALE_MAX_AGE };
  store.set(WHOLESALE_COOKIE, token, { ...options, httpOnly: true });
  store.set(WHOLESALE_FLAG, "1", { ...options, httpOnly: false });
}

export async function clearWholesaleCookies() {
  const store = await cookies();
  store.delete(WHOLESALE_COOKIE);
  store.delete(WHOLESALE_FLAG);
}

/** Sin caché: la configuración mayorista no se guarda en páginas ni en datos compartidos. */
export async function getWholesaleSettings(): Promise<WholesaleSettings> {
  const row = await db.query.settings.findFirst({ where: eq(settings.key, "wholesale") });
  const saved = (row?.value ?? {}) as Partial<WholesaleSettings> & { code?: string };
  const { enabled, minAmount, minUnits, firstOrderMinUnits, cashDiscountPercent, note } = { ...DEFAULT_WHOLESALE, ...saved };
  // "code" es el nombre viejo del código general
  const sharedCode = (saved.sharedCode ?? saved.code ?? "").trim();
  return { enabled, minAmount, minUnits, firstOrderMinUnits, sharedCode, cashDiscountPercent, note };
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

/** Huella del código general en el token: si se cambia el código, los accesos anteriores dejan de valer. */
export function sharedCodeFingerprint(sharedCode: string): string {
  return hashCode(`general:${sharedCode}`).slice(0, 16);
}

/** El código escrito es el general (sin importar mayúsculas, espacios ni guiones). */
export function isSharedCode(code: string, sharedCode: string): boolean {
  return Boolean(sharedCode) && normalizeCode(code).length > 0 && normalizeCode(code) === normalizeCode(sharedCode);
}

/** Acceso con el código general; `customerId` 0 hasta que se registra (con el registro ya puede pedir). */
export function createGuestToken(customerId: number, sharedCode: string): string {
  const exp = Math.floor(Date.now() / 1000) + WHOLESALE_MAX_AGE;
  const payload = `${exp}.g${customerId}.${sharedCodeFingerprint(sharedCode)}`;
  return `${payload}.${signValue("mayorista", payload)}`;
}

export type WholesaleCustomerAccess = { id: number; name: string; business: string | null; existingCustomer: boolean };
/** `guest`: entró con el código general. `customer` null: todavía no se registró (ve precios, no puede pedir). */
export type WholesaleAccess = { config: WholesaleSettings; customer: WholesaleCustomerAccess | null; guest: boolean };

/** Acceso válido: token firmado y vigente, de un cliente aprobado con el mismo código, y el canal mayorista activo. */
export async function wholesaleFromCookie(token: string | undefined | null): Promise<WholesaleAccess | null> {
  if (!token) return null;
  const [exp, id, fp, sig] = token.split(".");
  if (!exp || !id || !fp || !sig || !/^\d+$/.test(exp) || !/^g?\d+$/.test(id)) return null;
  if (Number(exp) < Math.floor(Date.now() / 1000)) return null;
  try {
    if (!safeEqual(sig, signValue("mayorista", `${exp}.${id}.${fp}`))) return null;
  } catch {
    return null;
  }
  const config = await getWholesaleSettings();
  if (!config.enabled) return null;
  const columns = { id: true, name: true, business: true, existingCustomer: true, codeHash: true } as const;
  const pick = (c: WholesaleCustomerAccess) => ({ id: c.id, name: c.name, business: c.business, existingCustomer: c.existingCustomer });

  // Código general: vale mientras no se cambie; si ya se registró, el pedido queda a su nombre
  if (id.startsWith("g")) {
    if (!config.sharedCode || fp !== sharedCodeFingerprint(config.sharedCode)) return null;
    const customerId = Number(id.slice(1));
    if (!customerId) return { config, customer: null, guest: true };
    const customer = await db.query.wholesaleCustomers.findFirst({ where: eq(wholesaleCustomers.id, customerId), columns: { ...columns, status: true } });
    if (!customer || customer.status === "rechazado" || customer.status === "baja") return null;
    return { config, customer: pick(customer), guest: true };
  }

  const customer = await db.query.wholesaleCustomers.findFirst({
    where: and(eq(wholesaleCustomers.id, Number(id)), eq(wholesaleCustomers.status, "aprobado")),
    columns,
  });
  if (!customer?.codeHash || !customer.codeHash.startsWith(fp)) return null;
  return { config, customer: pick(customer), guest: false };
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

export type WholesaleOrderRules = WholesaleSettings & { firstOrder: boolean };

/**
 * Las reglas para el próximo pedido de este cliente: en su primera compra (sin pedidos que no estén
 * cancelados) rige el mínimo de prendas de primera compra, salvo que ya fuera clienta de INEDITA.
 */
export async function orderRules(access: { config: WholesaleSettings; customer: WholesaleCustomerAccess | null }): Promise<WholesaleOrderRules> {
  const { config, customer } = access;
  const firstMin = customer?.existingCustomer ? 0 : config.firstOrderMinUnits;
  if (firstMin <= config.minUnits) return { ...config, firstOrder: false };
  // Sin registrarse todavía (código general): es clienta nueva
  if (!customer) return { ...config, minUnits: firstMin, firstOrder: true };
  const [row] = await db
    .select({ n: count() })
    .from(orders)
    .where(and(eq(orders.wholesaleCustomerId, customer.id), ne(orders.status, "cancelado")));
  const firstOrder = (row?.n ?? 0) === 0;
  return { ...config, minUnits: firstOrder ? firstMin : config.minUnits, firstOrder };
}

export async function getWholesaleSession(access: WholesaleAccess): Promise<WholesaleSession> {
  const [rows, rules] = await Promise.all([
    db.select({ id: products.id, price: products.wholesalePrice }).from(products).where(isNotNull(products.wholesalePrice)),
    orderRules(access),
  ]);
  return {
    customer: access.customer ? { name: access.customer.name, business: access.customer.business } : null,
    guest: access.guest,
    prices: Object.fromEntries(rows.filter((r) => r.price && r.price > 0).map((r) => [r.id, r.price!])),
    minAmount: rules.minAmount,
    minUnits: rules.minUnits,
    firstOrder: rules.firstOrder,
    cashDiscountPercent: access.config.cashDiscountPercent,
    note: access.config.note,
  };
}
