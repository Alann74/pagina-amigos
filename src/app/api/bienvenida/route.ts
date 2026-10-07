import { eq, or } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { subscribers } from "@/db/schema";
import { getSettings } from "@/lib/catalog";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { findUnusedWelcome, newWelcomeCode, phoneKey } from "@/lib/welcome";

const PRIVATE = { "Cache-Control": "private, no-store" };

const schema = z.object({
  email: z.string().trim().toLowerCase().max(160).email("Revisá tu mail"),
  phone: z
    .string()
    .trim()
    .max(30)
    .refine((v) => v.replace(/\D/g, "").length >= 8, "Ingresá tu WhatsApp con característica"),
  landingPath: z.string().max(300).optional().nullable(),
  utmSource: z.string().max(120).optional().nullable(),
  utmCampaign: z.string().max(160).optional().nullable(),
  website: z.string().max(0).optional(), // honeypot
});

// POST /api/bienvenida → guarda la suscripción y devuelve el código de descuento
export async function POST(request: Request) {
  if (!rateLimit(`welcome:${clientIp(request.headers)}`, 6, 10 * 60 * 1000)) {
    return Response.json({ error: "Demasiados intentos. Probá de nuevo en unos minutos." }, { status: 429 });
  }
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message ?? "Revisá los datos" }, { status: 400 });
  const { email, phone } = parsed.data;
  const settings = await getSettings();
  const percent = settings.welcome.percent;
  if (!settings.welcome.enabled || percent <= 0) return Response.json({ error: "La promo de bienvenida no está disponible en este momento." }, { status: 403 });

  const key = phoneKey(phone);
  // Una sola bienvenida por persona: mismo mail o mismo teléfono → mismo código
  const existing = await db
    .select()
    .from(subscribers)
    .where(or(eq(subscribers.email, email), eq(subscribers.phoneKey, key)))
    .limit(1);
  if (existing[0]) {
    const s = existing[0];
    if (s.usedAt) return Response.json({ error: "Ya usaste tu descuento de bienvenida. ¡Gracias por volver!", used: true }, { status: 409, headers: PRIVATE });
    return Response.json({ code: s.code, percent: s.discountPercent, existing: true }, { headers: PRIVATE });
  }

  for (let attempt = 0; attempt < 5; attempt++) {
    const code = newWelcomeCode();
    const rows = await db
      .insert(subscribers)
      .values({
        email,
        phone,
        phoneKey: key,
        code,
        discountPercent: percent,
        landingPath: parsed.data.landingPath?.slice(0, 300) ?? null,
        utmSource: parsed.data.utmSource ?? null,
        utmCampaign: parsed.data.utmCampaign ?? null,
      })
      .onConflictDoNothing()
      .returning({ code: subscribers.code });
    if (rows[0]) return Response.json({ code: rows[0].code, percent }, { status: 201, headers: PRIVATE });
    // Conflicto: o se repitió el código (se reintenta) o se anotó en paralelo con el mismo mail
    const again = await db.select().from(subscribers).where(eq(subscribers.email, email)).limit(1);
    if (again[0]) return Response.json({ code: again[0].code, percent: again[0].discountPercent, existing: true }, { headers: PRIVATE });
  }
  return Response.json({ error: "No pudimos generar tu código. Probá de nuevo." }, { status: 500 });
}

// GET /api/bienvenida?codigo=HOLA-XXXXX → si el código sigue vigente (para mostrarlo en la bolsa).
// Solo por código: el teléfono se cruza recién al crear el pedido, así no se puede averiguar el código de otra persona.
export async function GET(request: Request) {
  if (!rateLimit(`welcome-check:${clientIp(request.headers)}`, 30, 10 * 60 * 1000)) return Response.json({ valid: false }, { status: 429 });
  const url = new URL(request.url);
  const code = url.searchParams.get("codigo");
  const found = code ? await findUnusedWelcome(code, "") : null;
  const settings = await getSettings();
  if (!found || !settings.welcome.enabled) return Response.json({ valid: false }, { headers: PRIVATE });
  return Response.json({ valid: true, code: found.code, percent: found.discountPercent }, { headers: PRIVATE });
}
