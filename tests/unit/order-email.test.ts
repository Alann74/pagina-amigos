import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { formSubmitNotice, sendBrowserNotice } from "../../src/lib/browser-notice";
import { buildOrderEmail, emailChannel, orderBrowserNotice, orderFields, sendOrderEmail, type OrderEmailInput } from "../../src/lib/order-email";

const pedido: OrderEmailInput = {
  id: 42,
  label: "#INE-0042",
  message:
    "Hola INEDITA! Quiero hacer este pedido #INE-0042:\n\n• Vestido <Lino> — Talle M — x1 — $45.000\n• Top — Talle S — Blanco — x1 — $18.000\n\nSubtotal: $63.000\nTotal con 10% OFF efectivo/transferencia: $56.700\n\nNombre: Ana Pérez\nTeléfono: 341 555-1234\nEntrega: Envío a coordinar — Fisherton\nPago: Transferencia\nComentario: Timbre 2B",
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

test("por FormSubmit: lo manda el navegador, con cada prenda y cada dato en su fila", async () => {
  const filas = orderFields(pedido, "https://inedita-tienda.vercel.app");
  assert.deepEqual(Object.keys(filas), ["Pedido", "Prenda 1", "Prenda 2", "Subtotal", "Total con 10% OFF efectivo/transferencia", "Nombre", "Teléfono", "Entrega", "Pago", "Comentario", "Ver en el panel", "WhatsApp de la clienta"]);
  assert.equal(filas["Prenda 2"], "Top — Talle S — Blanco — x1 — $18.000");
  assert.equal(filas.Entrega, "Envío a coordinar — Fisherton");

  // Sin clave de Resend: el servidor no manda nada (FormSubmit rechaza los envíos desde Vercel)
  const llamadas: unknown[] = [];
  globalThis.fetch = (async (...args: unknown[]) => {
    llamadas.push(args);
    return new Response("{}");
  }) as typeof fetch;
  const channel = await emailChannel();
  assert.deepEqual(channel, { kind: "browser", to: "ineditarosario@gmail.com" });
  assert.equal(await sendOrderEmail(pedido), "navegador");
  assert.equal(llamadas.length, 0);

  // ...y le pasa al navegador el aviso armado
  const notice = orderBrowserNotice(channel, pedido, "https://inedita-tienda.vercel.app");
  assert.equal(notice?.url, "https://formsubmit.co/ajax/ineditarosario%40gmail.com");
  assert.equal(notice?.subject, "Nuevo pedido web #INE-0042 · Ana Pérez · $40.500");
  assert.equal(notice?.fields["Prenda 1"], "Vestido <Lino> — Talle M — x1 — $45.000");
  process.env.ORDERS_EMAIL = "otra@inedita.test";
  assert.equal(orderBrowserNotice(await emailChannel(), pedido, "x")?.url, "https://formsubmit.co/ajax/otra%40inedita.test");
  // Con Resend no hay aviso para el navegador
  assert.equal(orderBrowserNotice({ kind: "resend", apiKey: "re_x", from: "a", to: "b" }, pedido, "x"), null);
});

test("el navegador manda el aviso como formulario común, con keepalive, y nunca rompe", async () => {
  const llamadas: { url: string; init: RequestInit }[] = [];
  globalThis.fetch = (async (url: string, init: RequestInit) => {
    llamadas.push({ url, init });
    return new Response("{}");
  }) as typeof fetch;
  sendBrowserNotice(formSubmitNotice("ineditarosario@gmail.com", "Asunto", { Nombre: "Ana", _subject: "pisado" }));
  assert.equal(llamadas.length, 1);
  assert.equal(llamadas[0].url, "https://formsubmit.co/ajax/ineditarosario%40gmail.com");
  assert.equal(llamadas[0].init.keepalive, true);
  assert.deepEqual(llamadas[0].init.headers, { Accept: "application/json" }); // sin content-type JSON: no hay consulta previa de CORS
  const body = llamadas[0].init.body as URLSearchParams;
  assert.equal(body.get("Nombre"), "Ana");
  assert.equal(body.get("_subject"), "Asunto");
  assert.equal(body.get("_template"), "table");
  // Otro destino o sin aviso: no manda nada
  sendBrowserNotice({ url: "https://otro.sitio/ajax/x", subject: "x", fields: {} });
  sendBrowserNotice(null);
  assert.equal(llamadas.length, 1);
  // Si fetch falla, no rompe
  globalThis.fetch = (() => {
    throw new TypeError("sin red");
  }) as unknown as typeof fetch;
  sendBrowserNotice(formSubmitNotice("a@b.c", "x", {}));
});
