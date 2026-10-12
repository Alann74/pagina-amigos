import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { buildOrderEmail, sendOrderEmail, type OrderEmailInput } from "../../src/lib/order-email";

const pedido: OrderEmailInput = {
  id: 42,
  label: "#INE-0042",
  message: "Hola INEDITA! Quiero hacer este pedido #INE-0042:\n\n• Vestido <Lino> — Talle M — x1 — $45.000\n\nNombre: Ana Pérez",
  customerName: "Ana Pérez",
  customerPhone: "341 555-1234",
  total: 40500,
  wholesale: false,
};

const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
  delete process.env.RESEND_API_KEY;
  delete process.env.ORDERS_EMAIL;
});

test("el mail del pedido: asunto, texto del pedido y links al panel y al WhatsApp de la clienta", () => {
  const m = buildOrderEmail(pedido, "https://inedita-tienda.vercel.app");
  assert.equal(m.subject, "Nuevo pedido web #INE-0042 · Ana Pérez · $40.500");
  assert.match(m.text, /^Hola INEDITA! Quiero hacer este pedido #INE-0042:/);
  assert.match(m.text, /Ver el pedido en el panel: https:\/\/inedita-tienda\.vercel\.app\/admin\/pedidos\/42/);
  assert.match(m.text, /https:\/\/wa\.me\/5493415551234\?text=Hola%20Ana!/);
  assert.match(m.html, /Vestido &lt;Lino&gt;/);
  assert.doesNotMatch(m.html, /<Lino>/);
  assert.match(buildOrderEmail({ ...pedido, wholesale: true }, "x").subject, /^Pedido MAYORISTA #INE-0042/);
});

test("se manda por Resend a la casilla de INEDITA", async () => {
  process.env.RESEND_API_KEY = "re_prueba";
  const llamadas: { url: string; init: RequestInit }[] = [];
  globalThis.fetch = (async (url: string, init: RequestInit) => {
    llamadas.push({ url, init });
    return new Response(JSON.stringify({ id: "x" }), { status: 200 });
  }) as typeof fetch;
  assert.equal(await sendOrderEmail(pedido), "enviado");
  assert.equal(llamadas[0].url, "https://api.resend.com/emails");
  assert.equal((llamadas[0].init.headers as Record<string, string>).authorization, "Bearer re_prueba");
  const body = JSON.parse(String(llamadas[0].init.body));
  assert.deepEqual(body.to, ["ineditarosario@gmail.com"]);
  assert.equal(body.from, "INEDITA Pedidos <onboarding@resend.dev>");
  assert.equal(body.subject, "Nuevo pedido web #INE-0042 · Ana Pérez · $40.500");
});

test("si Resend falla no rompe el pedido", async () => {
  process.env.RESEND_API_KEY = "re_prueba";
  globalThis.fetch = (async () => new Response("no", { status: 403 })) as unknown as typeof fetch;
  assert.equal(await sendOrderEmail(pedido), "error");
  globalThis.fetch = (async () => Promise.reject(new TypeError("fetch failed"))) as unknown as typeof fetch;
  assert.equal(await sendOrderEmail(pedido), "error");
});
