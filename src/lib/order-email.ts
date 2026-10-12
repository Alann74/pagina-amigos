import { eq } from "drizzle-orm";
import { db } from "@/db";
import { settings } from "@/db/schema";
import { formatPrice } from "@/lib/format";
import { SITE_URL } from "@/lib/site";
import { formSubmitNotice, type BrowserNotice } from "@/lib/browser-notice";
import { toWhatsappNumber, whatsappUrl } from "@/lib/whatsapp";

// Cada pedido web (y cada registro mayorista) llega también por mail a INEDITA.
// Por defecto va por FormSubmit (formsubmit.co, gratis y sin cuenta) y lo manda el navegador de la
// clienta: FormSubmit rechaza los envíos desde los servidores de Vercel (ver browser-notice.ts). La
// primera vez llega a la casilla un mail "Activate Form" que hay que tocar una sola vez. Si se carga una
// clave de Resend (RESEND_API_KEY o settings "email-pedidos": { apiKey }), lo manda el servidor por
// Resend. Con { activo: false } en settings "email-pedidos" no se manda nada.

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

export type EmailChannel = { kind: "off" } | { kind: "resend"; apiKey: string; from: string; to: string } | { kind: "browser"; to: string };

/** Por dónde salen los avisos: apagados, Resend (desde el servidor) o FormSubmit (desde el navegador). */
export async function emailChannel(): Promise<EmailChannel> {
  const saved = await savedConfig();
  if (saved.activo === false) return { kind: "off" };
  const to = process.env.ORDERS_EMAIL?.trim() || saved.to?.trim() || DEFAULT_TO;
  const apiKey = process.env.RESEND_API_KEY?.trim() || saved.apiKey?.trim();
  if (!apiKey) return { kind: "browser", to };
  return { kind: "resend", apiKey, to, from: process.env.ORDERS_EMAIL_FROM?.trim() || saved.from?.trim() || DEFAULT_FROM };
}

/** El aviso del pedido para que lo mande el navegador (solo si el canal es FormSubmit). */
export function orderBrowserNotice(channel: EmailChannel, o: OrderEmailInput, siteUrl: string): BrowserNotice | null {
  return channel.kind === "browser" ? formSubmitNotice(channel.to, buildOrderEmail(o, siteUrl).subject, orderFields(o, siteUrl)) : null;
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

/** Otros avisos a INEDITA (ej. solicitud mayorista) por Resend, desde el servidor. Nunca tira error. */
export async function sendNotice(subject: string, fields: Record<string, string>): Promise<"enviado" | "desactivado" | "navegador" | "error"> {
  const channel = await emailChannel();
  if (channel.kind === "off") return "desactivado";
  if (channel.kind === "browser") return "navegador";
  let error: string | null;
  try {
    const text = Object.entries(fields)
      .map(([k, v]) => `${k}: ${v}`)
      .join("\n");
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: `Bearer ${channel.apiKey}`, "content-type": "application/json" },
      body: JSON.stringify({ from: channel.from, to: [channel.to], subject, text }),
      signal: AbortSignal.timeout(10_000),
    });
    error = res.ok ? null : `Resend ${res.status} ${(await res.text()).slice(0, 300)}`;
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
  }
  if (error) console.error("[aviso por mail]", subject, error);
  return error ? "error" : "enviado";
}

/** Manda el aviso del pedido por Resend (con FormSubmit lo manda el navegador). Nunca tira error: si falla queda anotado en settings "email-pedidos-estado". */
export async function sendOrderEmail(o: OrderEmailInput): Promise<"enviado" | "desactivado" | "navegador" | "error"> {
  const channel = await emailChannel();
  if (channel.kind === "off") return "desactivado";
  if (channel.kind === "browser") return "navegador";
  let error: string | null;
  try {
    error = await sendWithResend(channel.apiKey, channel.from, channel.to, o);
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
  }
  await recordStatus(error ? { ultimo: o.label, ok: false, error } : { ultimo: o.label, ok: true });
  return error ? "error" : "enviado";
}
