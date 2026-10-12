import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { wholesaleCustomers } from "@/db/schema";
import { formSubmitNotice, type BrowserNotice } from "@/lib/browser-notice";
import { emailChannel, sendNotice } from "@/lib/order-email";
import { SITE_URL } from "@/lib/site";
import { SALES_CHANNELS } from "@/lib/wholesale-config";
import { toWhatsappNumber, whatsappUrl } from "@/lib/whatsapp";

// Registro de mayoristas: dejan sus datos en /mayoristas, quedan "pendiente" y el admin los aprueba
// desde el panel (ahí se genera el código personal que se les manda por WhatsApp).

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Máximo ${max} caracteres`)
    .optional()
    .nullable()
    .transform((v) => (v ? v : null));

/** "@tu.negocio", "instagram.com/tu.negocio/" o "tu.negocio" → "tu.negocio" */
export function normalizeInstagram(v: string | null): string | null {
  if (!v) return null;
  const handle = v
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/^(www\.)?instagram\.com\//i, "")
    .replace(/^@+/, "")
    .split(/[/?#\s]/)[0];
  return handle ? handle.slice(0, 60) : null;
}

export const wholesaleSignupSchema = z.object({
  name: z.string().trim().min(2, "Ingresá tu nombre y apellido").max(80, "Máximo 80 caracteres"),
  business: optionalText(80),
  taxId: optionalText(20),
  phone: z
    .string()
    .trim()
    .max(30, "Revisá el número")
    .refine((v) => v.replace(/\D/g, "").length >= 8, "Ingresá un WhatsApp válido"),
  email: z.string().trim().toLowerCase().max(120, "Revisá el mail").pipe(z.email("Ingresá un mail válido")),
  city: z.string().trim().min(2, "Ingresá tu localidad").max(80, "Máximo 80 caracteres"),
  instagram: optionalText(80).transform(normalizeInstagram),
  salesChannel: z
    .enum(SALES_CHANNELS.map((c) => c.id) as [string, ...string[]])
    .optional()
    .nullable()
    .transform((v) => v ?? null),
  comment: optionalText(500),
});

export type WholesaleSignup = z.infer<typeof wholesaleSignupSchema>;

export type SignupResult = { status: "recibido" | "ya-pendiente" | "ya-aprobado"; id: number };

export async function registerWholesaleCustomer(input: WholesaleSignup): Promise<SignupResult> {
  const existing = await db.query.wholesaleCustomers.findFirst({
    where: sql`lower(${wholesaleCustomers.email}) = ${input.email}`,
    columns: { id: true, status: true },
  });
  if (existing?.status === "aprobado") return { status: "ya-aprobado", id: existing.id };
  if (existing) {
    // Si vuelve a mandar los datos se actualizan; si estaba rechazado o dado de baja, vuelve a quedar para revisar
    await db
      .update(wholesaleCustomers)
      .set({ ...input, status: "pendiente", codeHash: null })
      .where(eq(wholesaleCustomers.id, existing.id));
    return { status: existing.status === "pendiente" ? "ya-pendiente" : "recibido", id: existing.id };
  }
  const [row] = await db.insert(wholesaleCustomers).values(input).returning({ id: wholesaleCustomers.id });
  return { status: "recibido", id: row.id };
}

const channelLabel = (id: string | null) => SALES_CHANNELS.find((c) => c.id === id)?.label ?? null;

/** Las filas del mail de aviso (también sirven para la planilla). */
export function signupFields(c: WholesaleSignup, siteUrl: string): Record<string, string> {
  const fields: Record<string, string> = { Nombre: c.name };
  if (c.business) fields.Negocio = c.business;
  if (c.taxId) fields["CUIT / DNI"] = c.taxId;
  fields.WhatsApp = c.phone;
  fields.Mail = c.email;
  fields.Localidad = c.city;
  if (c.instagram) fields.Instagram = `https://instagram.com/${c.instagram}`;
  const channel = channelLabel(c.salesChannel);
  if (channel) fields["Cómo vende"] = channel;
  if (c.comment) fields.Comentario = c.comment;
  fields["Aprobar en el panel"] = `${siteUrl}/admin/mayoristas`;
  fields["Escribirle por WhatsApp"] = whatsappUrl(toWhatsappNumber(c.phone), `Hola ${c.name.split(/\s+/)[0]}! Te escribimos de INEDITA por tu registro como mayorista.`);
  return fields;
}

/** WhatsApp que se le manda al aprobarlo: el link ya trae el código y entra directo. */
export function approvalMessage(name: string, code: string, siteUrl: string, firstOrderMinUnits = 0): string {
  const firstName = name.trim().split(/\s+/)[0] ?? "";
  return [
    `Hola ${firstName}! Ya tenés acceso a la tienda de INEDITA con precios por mayor.`,
    `Entrá desde este link: ${siteUrl}/mayoristas?codigo=${code}`,
    firstOrderMinUnits > 0 ? `Tu primera compra tiene un mínimo de ${firstOrderMinUnits} prendas.` : null,
    `Tu código personal es ${code} (es solo para vos, no lo compartas). Cualquier consulta escribinos por acá.`,
  ]
    .filter(Boolean)
    .join("\n\n");
}

const signupSubject = (c: WholesaleSignup) => `Nueva solicitud mayorista · ${c.business ? `${c.name} (${c.business})` : c.name} · ${c.city}`;

/**
 * Aviso a INEDITA de una solicitud nueva. Con Resend lo manda el servidor (después de responder); con
 * FormSubmit devuelve el aviso para que lo mande el navegador. Nunca tira error.
 */
export async function wholesaleSignupNotice(c: WholesaleSignup, later: (task: () => Promise<unknown>) => void): Promise<BrowserNotice | null> {
  const channel = await emailChannel();
  if (channel.kind === "resend") later(() => sendNotice(signupSubject(c), signupFields(c, SITE_URL)));
  return channel.kind === "browser" ? formSubmitNotice(channel.to, signupSubject(c), signupFields(c, SITE_URL)) : null;
}
