import { z } from "zod";
import { db } from "@/db";
import { withdrawalRequests } from "@/db/schema";
import { getSettings } from "@/lib/catalog";
import { formatWithdrawalNumber } from "@/lib/format";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { whatsappUrl } from "@/lib/whatsapp";

const schema = z.object({
  name: z.string().trim().min(2, "Ingresá tu nombre").max(80),
  phone: z.string().trim().max(30).refine((v) => v.replace(/\D/g, "").length >= 8, "Ingresá un teléfono válido"),
  email: z.union([z.string().trim().email("Email inválido").max(120), z.literal("")]).optional(),
  orderReference: z.string().trim().max(60).optional(),
  detail: z.string().trim().max(800).optional(),
  website: z.string().max(0).optional(),
});

export async function POST(request: Request) {
  if (!rateLimit(`arr:${clientIp(request.headers)}`, 5, 10 * 60 * 1000)) {
    return Response.json({ error: "Demasiadas solicitudes. Probá en unos minutos." }, { status: 429 });
  }
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message ?? "Datos inválidos" }, { status: 400 });
  const d = parsed.data;
  const [row] = await db
    .insert(withdrawalRequests)
    .values({ name: d.name, phone: d.phone, email: d.email || null, orderReference: d.orderReference || null, detail: d.detail || null })
    .returning({ number: withdrawalRequests.number });
  const code = formatWithdrawalNumber(row.number);
  const settings = await getSettings();
  const text = `Hola INEDITA! Quiero ejercer mi derecho de arrepentimiento. Código ${code}.\nNombre: ${d.name}\nTeléfono: ${d.phone}${d.orderReference ? `\nPedido / compra: ${d.orderReference}` : ""}${d.detail ? `\nDetalle: ${d.detail}` : ""}`;
  return Response.json({ code, whatsappUrl: whatsappUrl(settings.whatsappNumber, text) }, { status: 201 });
}
