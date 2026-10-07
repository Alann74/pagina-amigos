import { createHash } from "node:crypto";
import { eq, isNotNull } from "drizzle-orm";
import { db } from "@/db";
import { products, settings } from "@/db/schema";
import { safeEqual, signValue } from "@/lib/admin-auth";
import { DEFAULT_WHOLESALE, type WholesaleSession, type WholesaleSettings } from "@/lib/wholesale-config";

export const WHOLESALE_MAX_AGE = 60 * 24 * 60 * 60; // 60 días

/** Sin caché: el código no se guarda nunca en páginas ni en datos compartidos. */
export async function getWholesaleSettings(): Promise<WholesaleSettings> {
  const row = await db.query.settings.findFirst({ where: eq(settings.key, "wholesale") });
  return { ...DEFAULT_WHOLESALE, ...((row?.value as Partial<WholesaleSettings>) ?? {}) };
}

export function normalizeCode(code: string): string {
  return code.trim().toUpperCase().replace(/\s+/g, "");
}

// El token depende del código vigente: si el admin cambia el código, los accesos anteriores dejan de valer.
const codeFingerprint = (code: string) => createHash("sha256").update(normalizeCode(code)).digest("base64url").slice(0, 12);

export function createWholesaleToken(code: string): string {
  const exp = Math.floor(Date.now() / 1000) + WHOLESALE_MAX_AGE;
  const payload = `${exp}.${codeFingerprint(code)}`;
  return `${payload}.${signValue("mayorista", payload)}`;
}

export function verifyWholesaleToken(token: string | undefined | null, config: WholesaleSettings): boolean {
  if (!token || !config.enabled || !config.code) return false;
  const [exp, fp, sig] = token.split(".");
  if (!exp || !fp || !sig || !/^\d+$/.test(exp)) return false;
  if (Number(exp) < Math.floor(Date.now() / 1000)) return false;
  if (fp !== codeFingerprint(config.code)) return false;
  try {
    return safeEqual(sig, signValue("mayorista", `${exp}.${fp}`));
  } catch {
    return false;
  }
}

export function codeMatches(input: string, config: WholesaleSettings): boolean {
  if (!config.enabled || !config.code) return false;
  return safeEqual(createHash("sha256").update(normalizeCode(input)).digest("hex"), createHash("sha256").update(normalizeCode(config.code)).digest("hex"));
}

/** Configuración mayorista si el pedido viene de alguien con acceso válido; si no, null. */
export async function wholesaleFromCookie(token: string | undefined | null): Promise<WholesaleSettings | null> {
  if (!token) return null;
  const config = await getWholesaleSettings();
  return verifyWholesaleToken(token, config) ? config : null;
}

export async function getWholesaleSession(config: WholesaleSettings): Promise<WholesaleSession> {
  const rows = await db.select({ id: products.id, price: products.wholesalePrice }).from(products).where(isNotNull(products.wholesalePrice));
  return {
    prices: Object.fromEntries(rows.filter((r) => r.price && r.price > 0).map((r) => [r.id, r.price!])),
    minAmount: config.minAmount,
    minUnits: config.minUnits,
    cashDiscountPercent: config.cashDiscountPercent,
    note: config.note,
  };
}
