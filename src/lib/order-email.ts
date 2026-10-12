import { eq } from "drizzle-orm";
import { db } from "@/db";
import { settings } from "@/db/schema";
import { formatPrice } from "@/lib/format";
import { SITE_URL } from "@/lib/site";
import { formSubmitNotice, type BrowserNotice } from "@/lib/browser-notice";
import { toWhatsappNumber, whatsappUrl } from "@/lib/whatsapp";

// Cada pedido web (y cada registro mayorista) llega también por mail a INEDITA, por dos vías:
// - FormSubmit (formsubmit.co, gratis y sin cuenta) a la casilla de INEDITA (ORDERS_EMAIL o settings
//   "email-pedidos".to). Lo manda el navegador de la clienta: FormSubmit rechaza los envíos desde los
//   servidores de Vercel (ver browser-notice.ts).
// - Resend, desde el servidor, si hay clave (RESEND_API_KEY o settings "email-pedidos".apiKey). Mismas
//   variables que el sistema mayorista: MAIL_PEDIDOS (destinatarios, separados por coma) y MAIL_REMITENTE.
//   Con el remitente de prueba de Resend (onboarding@resend.dev) solo se puede mandar al mail de la
//   cuenta de Resend; para otros destinos hay que verificar un dominio propio en Resend.
// Si Resend ya le manda a la casilla de INEDITA, FormSubmit no repite. Con { activo: false } en
// settings "email-pedidos" no se manda nada.

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

/** El texto del WhatsApp separado en prendas ("• ...") y datos ("Clave: valor"). */
function parseOrderMessage(message: string) {
  const items: string[] = [];
  const rows: [string, string][] = [];
  for (const line of message.split("\n").slice(1)) {
    const t = line.trim();
    if (t.startsWith("• ")) items.push(t.slice(2));
    else {
      const i = t.indexOf(": ");
      if (i > 0) rows.push([t.slice(0, i), t.slice(i + 2)]);
    }
  }
  return { items, rows };
}

/** Mail con el formato del sistema mayorista: INEDITA, una línea, los datos en filas, las prendas y botones. */
export function noticeHtml(n: { intro: string; rows: [string, string][]; items?: string[]; buttons?: { label: string; url: string }[] }): string {
  const row = ([k, v]: [string, string]) =>
    `<tr><td style="padding:9px 16px 9px 0;color:#666;font-size:15px;vertical-align:top;border-bottom:1px solid #eee">${escapeHtml(k)}</td><td style="padding:9px 0;font-size:15px;font-weight:700;text-align:right;border-bottom:1px solid #eee">${escapeHtml(v)}</td></tr>`;
  const items = n.items?.length
    ? `<p style="font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:#777;margin:24px 0 4px">Prendas</p>
<table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse">${n.items.map((i) => `<tr><td style="padding:9px 0;font-size:15px;border-bottom:1px solid #eee">${escapeHtml(i)}</td></tr>`).join("")}</table>`
    : "";
  const buttons = (n.buttons ?? [])
    .map(
      (b) =>
        `<a href="${escapeHtml(b.url)}" style="display:inline-block;margin:0 8px 8px 0;padding:12px 18px;border:1px solid #111;color:#111;text-decoration:none;font-size:12px;letter-spacing:.14em;text-transform:uppercase">${escapeHtml(b.label)}</a>`,
    )
    .join("");
  return `<div style="font-family:Helvetica,Arial,sans-serif;color:#111;max-width:560px;line-height:1.4">
<p style="font-size:30px;font-weight:700;letter-spacing:.2em;margin:0 0 6px">INEDITA</p>
<p style="font-size:17px;color:#555;margin:0 0 20px">${escapeHtml(n.intro)}</p>
<table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse">${n.rows.map(row).join("")}</table>
${items}
${buttons ? `<p style="margin:28px 0 0">${buttons}</p>` : ""}
</div>`;
}

export function buildOrderEmail(o: OrderEmailInput, siteUrl: string) {
  const subject = `${o.wholesale ? "Pedido MAYORISTA" : "Nuevo pedido web"} ${o.label} · ${o.customerName} · ${formatPrice(o.total)}`;
  const adminUrl = `${siteUrl}/admin/pedidos/${o.id}`;
  const firstName = o.customerName.trim().split(/\s+/)[0] ?? "";
  const toCustomer = whatsappUrl(toWhatsappNumber(o.customerPhone), `Hola ${firstName}! Te escribimos de INEDITA por tu pedido ${o.label}.`);
  const text = `${o.message}\n\nVer el pedido en el panel: ${adminUrl}\nEscribirle por WhatsApp: ${toCustomer}\n`;
  const { items, rows } = parseOrderMessage(o.message);
  const html = noticeHtml({
    intro: `${o.wholesale ? "Pedido MAYORISTA" : "Nuevo pedido web"} ${o.label}.`,
    rows,
    items,
    buttons: [
      { label: "Ver en el panel", url: adminUrl },
      { label: "Escribirle por WhatsApp", url: toCustomer },
    ],
  });
  return { subject, text, html, adminUrl, toCustomer };
}

/**
 * El mensaje del pedido como filas de una tabla (así lo arma FormSubmit): cada prenda en su fila y
 * cada "Clave: valor" (totales, nombre, teléfono, entrega, pago, comentario) en la suya.
 */
export function orderFields(o: OrderEmailInput, siteUrl: string): Record<string, string> {
  const { adminUrl, toCustomer } = buildOrderEmail(o, siteUrl);
  const { items, rows } = parseOrderMessage(o.message);
  const fields: Record<string, string> = { Pedido: `${o.label}${o.wholesale ? " (MAYORISTA)" : ""}` };
  items.forEach((item, i) => (fields[`Prenda ${i + 1}`] = item));
  for (const [k, v] of rows) fields[k] = v;
  fields["Ver en el panel"] = adminUrl;
  fields["WhatsApp de la clienta"] = toCustomer;
  return fields;
}

type SavedConfig = { apiKey?: string; to?: string; from?: string; resendTo?: string; activo?: boolean };

async function savedConfig(): Promise<SavedConfig> {
  try {
    const row = await db.query.settings.findFirst({ where: eq(settings.key, "email-pedidos") });
    return (row?.value ?? {}) as SavedConfig;
  } catch {
    return {}; // sin base (tests): alcanza con las variables de entorno
  }
}

export type EmailChannels = {
  resend: { apiKey: string; from: string; to: string[] } | null; // desde el servidor
  browser: { to: string } | null; // FormSubmit, desde el navegador
};

const emailList = (v: string | undefined) =>
  (v ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

/** Por dónde salen los avisos (ver arriba). */
export async function emailChannels(): Promise<EmailChannels> {
  const saved = await savedConfig();
  if (saved.activo === false) return { resend: null, browser: null };
  const inbox = process.env.ORDERS_EMAIL?.trim() || saved.to?.trim() || DEFAULT_TO;
  const apiKey = process.env.RESEND_API_KEY?.trim() || saved.apiKey?.trim();
  const resendTo = emailList(process.env.MAIL_PEDIDOS || saved.resendTo);
  const resend = apiKey
    ? {
        apiKey,
        from: process.env.MAIL_REMITENTE?.trim() || process.env.ORDERS_EMAIL_FROM?.trim() || saved.from?.trim() || DEFAULT_FROM,
        to: resendTo.length ? resendTo : [inbox],
      }
    : null;
  return { resend, browser: resend?.to.includes(inbox) ? null : { to: inbox } };
}

/** El aviso del pedido para que lo mande el navegador (si va por FormSubmit). */
export function orderBrowserNotice(channels: EmailChannels, o: OrderEmailInput, siteUrl: string): BrowserNotice | null {
  return channels.browser ? formSubmitNotice(channels.browser.to, buildOrderEmail(o, siteUrl).subject, orderFields(o, siteUrl)) : null;
}

async function recordStatus(value: Record<string, unknown>) {
  const v = { ...value, fecha: new Date().toISOString() };
  try {
    await db.insert(settings).values({ key: "email-pedidos-estado", value: v }).onConflictDoUpdate({ target: settings.key, set: { value: v } });
  } catch {
    // sin base: no se anota, el pedido sigue igual
  }
}

type ResendChannel = NonNullable<EmailChannels["resend"]>;

async function sendWithResend(r: ResendChannel, email: { subject: string; text: string; html?: string }): Promise<string | null> {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { authorization: `Bearer ${r.apiKey}`, "content-type": "application/json" },
    body: JSON.stringify({ from: r.from, to: r.to, ...email }),
    signal: AbortSignal.timeout(10_000),
  });
  return res.ok ? null : `Resend ${res.status} ${(await res.text()).slice(0, 300)}`;
}

/** Otros avisos a INEDITA (ej. solicitud mayorista) por Resend, desde el servidor. Nunca tira error. */
export async function sendNotice(subject: string, fields: Record<string, string>): Promise<"enviado" | "sin-resend" | "error"> {
  const { resend } = await emailChannels();
  if (!resend) return "sin-resend";
  const text = Object.entries(fields)
    .map(([k, v]) => `${k}: ${v}`)
    .join("\n");
  // Los links van como botones; el resto, en filas
  const entries = Object.entries(fields);
  const html = noticeHtml({
    intro: subject,
    rows: entries.filter(([, v]) => !/^https?:\/\//.test(v)),
    buttons: entries.filter(([, v]) => /^https?:\/\//.test(v)).map(([label, url]) => ({ label, url })),
  });
  let error: string | null;
  try {
    error = await sendWithResend(resend, { subject, text, html });
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
  }
  if (error) console.error("[aviso por mail]", subject, error);
  return error ? "error" : "enviado";
}

/** Manda el aviso del pedido por Resend (lo de FormSubmit lo manda el navegador). Nunca tira error: queda anotado en settings "email-pedidos-estado". */
export async function sendOrderEmail(o: OrderEmailInput): Promise<"enviado" | "sin-resend" | "error"> {
  const { resend } = await emailChannels();
  if (!resend) return "sin-resend";
  let error: string | null;
  try {
    const { subject, text, html } = buildOrderEmail(o, SITE_URL);
    error = await sendWithResend(resend, { subject, text, html });
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
  }
  if (error) console.error("[mail del pedido]", o.label, error);
  await recordStatus(error ? { ultimo: o.label, ok: false, error } : { ultimo: o.label, ok: true });
  return error ? "error" : "enviado";
}
