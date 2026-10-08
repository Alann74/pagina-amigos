import assert from "node:assert/strict";
import { test } from "node:test";
import { buildOrderMessage, MAX_MESSAGE_LENGTH, whatsappUrl } from "../../src/lib/whatsapp";
import { cashPrice, formatPrice } from "../../src/lib/format";

const base = {
  orderLabel: "#INE-0001",
  subtotal: 81000,
  cashTotal: 72900,
  discountPercent: 10,
  installments: 3,
  customerName: "Ana",
  customerPhone: "341 555 1234",
  delivery: { method: "retiro" as const, storeAddressShort: "Mitre 830" },
  payment: "transferencia" as const,
  comment: "Gracias",
};

test("formato de precios argentino", () => {
  assert.equal(formatPrice(45000), "$45.000");
  assert.equal(formatPrice(1234567), "$1.234.567");
  assert.equal(cashPrice(81000, 10), 72900);
});

test("mensaje igual al formato pedido", () => {
  const msg = buildOrderMessage({
    ...base,
    items: [
      { name: "Vestido Lino Negro", articleCode: "39603", size: "M", color: "NEGRO", quantity: 1, unitPrice: 45000 },
      { name: "Top Básico", articleCode: "39888", size: "S", color: "BLANCO", quantity: 2, unitPrice: 18000 },
    ],
  });
  assert.equal(
    msg,
    [
      "Hola INEDITA! Quiero hacer este pedido #INE-0001:",
      "",
      "• Vestido Lino Negro (art. 39603) — Talle M — Negro — x1 — $45.000",
      "• Top Básico (art. 39888) — Talle S — Blanco — x2 — $36.000",
      "",
      "Subtotal: $81.000",
      "Total con 10% OFF efectivo/transferencia: $72.900",
      "",
      "Nombre: Ana",
      "Teléfono: 341 555 1234",
      "Entrega: Retiro en Mitre 830",
      "Pago: Transferencia",
      "Comentario: Gracias",
    ].join("\n"),
  );
});

test("carritos grandes: el mensaje no supera el máximo y avisa el resto", () => {
  const items = Array.from({ length: 60 }, (_, i) => ({
    name: `Remera con nombre bastante largo número ${i}`,
    articleCode: String(39000 + i),
    size: "M",
    color: "VERDE MILITAR",
    quantity: 1,
    unitPrice: 30000,
  }));
  const msg = buildOrderMessage({ ...base, items, subtotal: 1_800_000, cashTotal: 1_620_000 });
  assert.ok(msg.length <= MAX_MESSAGE_LENGTH, `largo ${msg.length}`);
  assert.match(msg, /prendas más \(el detalle completo quedó registrado en el pedido #INE-0001\)/);
  assert.match(msg, /Subtotal: \$1\.800\.000/);
  assert.ok(whatsappUrl("+54 9 341 255-0777", msg).startsWith("https://wa.me/5493412550777?text="));
});

test("envío a coordinar con barrio y pago con tarjeta", () => {
  const msg = buildOrderMessage({
    ...base,
    items: [{ name: "Jean", articleCode: null, size: "28", color: null, quantity: 1, unitPrice: 96000 }],
    delivery: { method: "envio", area: "Fisherton", storeAddressShort: "Mitre 830" },
    payment: "tarjeta",
    comment: null,
  });
  assert.match(msg, /• Jean — Talle 28 — x1 — \$96\.000/);
  assert.match(msg, /Entrega: Envío a coordinar — Fisherton/);
  assert.match(msg, /Pago: Tarjeta \(3 cuotas sin interés\)/);
  assert.doesNotMatch(msg, /Comentario/);
});

test("sin número de pedido (la web no lo pudo registrar): el mensaje sale igual", () => {
  const msg = buildOrderMessage({
    ...base,
    orderLabel: "",
    items: [{ name: "Vestido Lino Negro", articleCode: "39603", size: "M", color: "NEGRO", quantity: 1, unitPrice: 45000 }],
  });
  assert.match(msg, /^Hola INEDITA! Quiero hacer este pedido:\n/);
  assert.match(msg, /• Vestido Lino Negro \(art\. 39603\) — Talle M/);
  const many = Array.from({ length: 60 }, (_, i) => ({ name: `Prenda con nombre largo número ${i}`, articleCode: `39${i}`, size: "M", color: "NEGRO", quantity: 1, unitPrice: 30000 }));
  const long = buildOrderMessage({ ...base, orderLabel: "", items: many });
  assert.ok(long.length <= MAX_MESSAGE_LENGTH);
  assert.match(long, /prendas más$/m);
  assert.doesNotMatch(long, /registrado en el pedido/);
});
