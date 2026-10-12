import { eq } from "drizzle-orm";
import { db } from "@/db";
import { settings } from "@/db/schema";
import { formatPrice } from "@/lib/format";
import { SITE_URL } from "@/lib/site";
import { toWhatsappNumber, whatsappUrl } from "@/lib/whatsapp";

// Cada pedido web llega también por mail a INEDITA (además del WhatsApp que manda la clienta).
// Por defecto se manda con FormSubmit (formsubmit.co, gratis y sin cuenta): la primera vez llega a la
// casilla un mail "Activate Form" que hay que tocar una sola vez. Si se carga una clave de Resend
// (RESEND_API_KEY o settings "email-pedidos": { apiKey }), se usa Resend. Con { activo: false } en
// settings "email-pedidos" no se manda nada.

const DEFAULT_TO = "ineditarosario@gmail.com";
const DEFAULT_FROM = "INEDITA Pedidos <onboarding@resend.dev>";
// FormSubmit identifica el formulario por la página de origen: siempre la misma, aunque cambie el dominio
export const FORMSUBMIT_ORIGIN = "https://inedita-tienda.vercel.app";

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
  return { subject, text, html, adminUrl, toCustomer };
}

/**
 * El mensaje del pedido como filas de una tabla (así lo arma FormSubmit): cada prenda en su fila y
 * cada "Clave: valor" (totales, nombre, teléfono, entrega, pago, comentario) en la suya.
 */
export function orderFields(o: OrderEmailInput, siteUrl: string): Record<string, string> {
  const { adminUrl, toCustomer } = buildOrderEmail(o, siteUrl);
  const fields: Record<string, string> = { Pedido: `${o.label}${o.wholesale ? " (MAYORISTA)" : ""}` };
  let prenda = 0;
  for (const line of o.message.split("\n").slice(1)) {
    const t = line.trim();
    if (t.startsWith("• ")) fields[`Prenda ${++prenda}`] = t.slice(2);
    else {
      const i = t.indexOf(": ");
      if (i > 0) fields[t.slice(0, i)] = t.slice(i + 2);
    }
  }
  fields["Ver en el panel"] = adminUrl;
  fields["WhatsApp de la clienta"] = toCustomer;
  return fields;
}

type SavedConfig = { apiKey?: string; to?: string; from?: string; activo?: boolean };

async function savedConfig(): Promise<SavedConfig> {
  try {
    const row = await db.query.settings.findFirst({ where: eq(settings.key, "email-pedidos") });
    return (row?.value ?? {}) as SavedConfig;
  } catch {
    return {}; // sin base (tests): alcanza con las variables de entorno
  }
}

async function recordStatus(value: Record<string, unknown>) {
  const v = { ...value, fecha: new Date().toISOString() };
  try {
    await db.insert(settings).values({ key: "email-pedidos-estado", value: v }).onConflictDoUpdate({ target: settings.key, set: { value: v } });
  } catch {
    // sin base: no se anota, el pedido sigue igual
  }
}

async function sendWithResend(apiKey: string, from: string, to: string, o: OrderEmailInput): Promise<string | null> {
  const { subject, text, html } = buildOrderEmail(o, SITE_URL);
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
    body: JSON.stringify({ from, to: [to], subject, text, html }),
    signal: AbortSignal.timeout(10_000),
  });
  return res.ok ? null : `Resend ${res.status} ${(await res.text()).slice(0, 300)}`;
}

/** Envío por FormSubmit (sin cuenta). Devuelve null si salió, o el motivo (ej. falta activar). */
export async function sendWithFormSubmit(to: string, subject: string, fields: Record<string, string>): Promise<string | null> {
  const res = await fetch(`https://formsubmit.co/ajax/${encodeURIComponent(to)}`, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json", origin: FORMSUBMIT_ORIGIN, referer: `${FORMSUBMIT_ORIGIN}/` },
    body: JSON.stringify({ _subject: subject, _template: "table", _captcha: "false", ...fields }),
    signal: AbortSignal.timeout(10_000),
  });
  const data = (await res.json().catch(() => null)) as { success?: string | boolean; message?: string } | null;
  if (res.ok && (data?.success === true || data?.success === "true")) return null;
  return `FormSubmit ${res.status}: ${data?.message ?? "sin respuesta"}`;
}

/** Manda el aviso del pedido. Nunca tira error: si falla queda anotado en settings "email-pedidos-estado". */
export async function sendOrderEmail(o: OrderEmailInput): Promise<"enviado" | "desactivado" | "error"> {
  const saved = await savedConfig();
  if (saved.activo === false) return "desactivado";
  const to = process.env.ORDERS_EMAIL?.trim() || saved.to?.trim() || DEFAULT_TO;
  const apiKey = process.env.RESEND_API_KEY?.trim() || saved.apiKey?.trim();
  let error: string | null;
  try {
    error = apiKey
      ? await sendWithResend(apiKey, process.env.ORDERS_EMAIL_FROM?.trim() || saved.from?.trim() || DEFAULT_FROM, to, o)
      : await sendWithFormSubmit(to, buildOrderEmail(o, SITE_URL).subject, orderFields(o, SITE_URL));
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
  }
  await recordStatus(error ? { ultimo: o.label, ok: false, error } : { ultimo: o.label, ok: true });
  return error ? "error" : "enviado";
}
