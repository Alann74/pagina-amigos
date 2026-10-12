import { eq } from "drizzle-orm";
import { db } from "@/db";
import { settings } from "@/db/schema";
import { formatPrice } from "@/lib/format";
import { SITE_URL } from "@/lib/site";
import { toWhatsappNumber, whatsappUrl } from "@/lib/whatsapp";

// Cada pedido web llega también por mail a INEDITA (además del WhatsApp que manda la clienta).
// Se manda con Resend (gratis hasta 3.000 por mes). La clave va en RESEND_API_KEY (Vercel) o en
// settings "email-pedidos": { apiKey, to?, from? }. Sin dominio propio verificado en Resend, el
// remitente es onboarding@resend.dev y solo puede mandar a la casilla con la que se creó la cuenta.

const DEFAULT_TO = "ineditarosario@gmail.com";
const DEFAULT_FROM = "INEDITA Pedidos <onboarding@resend.dev>";

export type OrderEmailInput = {
  id: number;
  label: string; // #INE-0005
  message: string; // el mismo texto del WhatsApp: prendas, totales, cliente, entrega, pago y comentario
  customerName: string;
  customerPhone: string;
  total: number; // lo que se cobra (con el descuento si paga en efectivo o transferencia)
  wholesale: boolean;
};

const escapeHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function buildOrderEmail(o: OrderEmailInput, siteUrl: string) {
  const subject = `${o.wholesale ? "Pedido MAYORISTA" : "Nuevo pedido web"} ${o.label} · ${o.customerName} · ${formatPrice(o.total)}`;
  const adminUrl = `${siteUrl}/admin/pedidos/${o.id}`;
  const firstName = o.customerName.trim().split(/\s+/)[0] ?? "";
  const toCustomer = whatsappUrl(toWhatsappNumber(o.customerPhone), `Hola ${firstName}! Te escribimos de INEDITA por tu pedido ${o.label}.`);
  const text = `${o.message}\n\nVer el pedido en el panel: ${adminUrl}\nEscribirle por WhatsApp: ${toCustomer}\n`;
  const html = `<div style="font-family:Helvetica,Arial,sans-serif;font-size:15px;line-height:1.5;color:#111;max-width:560px">
<p style="font-size:12px;letter-spacing:.18em;text-transform:uppercase;margin:0 0 12px">INEDITA · ${o.wholesale ? "Pedido mayorista" : "Pedido web"}</p>
<pre style="white-space:pre-wrap;font-family:inherit;font-size:15px;margin:0 0 20px">${escapeHtml(o.message)}</pre>
<p style="margin:0"><a href="${escapeHtml(adminUrl)}" style="color:#111">Ver el pedido en el panel</a> &nbsp;·&nbsp; <a href="${escapeHtml(toCustomer)}" style="color:#111">Escribirle por WhatsApp</a></p>
</div>`;
  return { subject, text, html };
}

async function savedConfig(): Promise<{ apiKey?: string; to?: string; from?: string }> {
  try {
    const row = await db.query.settings.findFirst({ where: eq(settings.key, "email-pedidos") });
    return (row?.value ?? {}) as { apiKey?: string; to?: string; from?: string };
  } catch {
    return {}; // sin base (tests): alcanza con las variables de entorno
  }
}

async function emailConfig(): Promise<{ apiKey: string; to: string; from: string } | null> {
  const saved = await savedConfig();
  const apiKey = process.env.RESEND_API_KEY?.trim() || saved.apiKey?.trim();
  if (!apiKey) return null;
  return {
    apiKey,
    to: process.env.ORDERS_EMAIL?.trim() || saved.to?.trim() || DEFAULT_TO,
    from: process.env.ORDERS_EMAIL_FROM?.trim() || saved.from?.trim() || DEFAULT_FROM,
  };
}

async function recordStatus(value: Record<string, unknown>) {
  const v = { ...value, fecha: new Date().toISOString() };
  try {
    await db.insert(settings).values({ key: "email-pedidos-estado", value: v }).onConflictDoUpdate({ target: settings.key, set: { value: v } });
  } catch {
    // sin base: no se anota, el pedido sigue igual
  }
}

/** Manda el aviso del pedido. Nunca tira error: si falla queda anotado en settings "email-pedidos-estado". */
export async function sendOrderEmail(o: OrderEmailInput): Promise<"enviado" | "sin-configurar" | "error"> {
  const config = await emailConfig();
  if (!config) return "sin-configurar";
  const { subject, text, html } = buildOrderEmail(o, SITE_URL);
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: `Bearer ${config.apiKey}`, "content-type": "application/json" },
      body: JSON.stringify({ from: config.from, to: [config.to], subject, text, html }),
      signal: AbortSignal.timeout(10_000),
    });
    if (res.ok) {
      await recordStatus({ ultimo: o.label, ok: true });
      return "enviado";
    }
    await recordStatus({ ultimo: o.label, ok: false, error: `${res.status} ${(await res.text()).slice(0, 300)}` });
  } catch (e) {
    await recordStatus({ ultimo: o.label, ok: false, error: e instanceof Error ? e.message : String(e) });
  }
  return "error";
}
