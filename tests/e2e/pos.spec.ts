import { expect, test } from "@playwright/test";

// Conexión con el POS: corre solo si el servidor de prueba tiene POS_API_SECRET (el mismo valor en el entorno del test)
const secret = process.env.POS_API_SECRET;
const auth = { authorization: `Bearer ${secret}` };

test.describe("conexión con el POS", () => {
  test.skip(!secret, "Sin POS_API_SECRET");

  test("sin el secreto no responde", async ({ request }) => {
    expect((await request.get("/api/pos/pedidos")).status()).toBe(401);
    expect((await request.get("/api/pos/pedidos", { headers: { authorization: "Bearer otra-clave-que-no-es-la-correcta" } })).status()).toBe(401);
    expect((await request.post("/api/pos/stock", { data: { items: [] } })).status()).toBe(401);
  });

  test("el POS lee los pedidos y su stock manda en la web", async ({ request }, testInfo) => {
    // Cambia el stock de toda la tienda de prueba: una sola vez, no en paralelo en cada dispositivo
    test.skip(testInfo.project.name !== "desktop", "Solo en desktop");

    const pedidos = (await (await request.get("/api/pos/pedidos?desde=0", { headers: auth })).json()).pedidos as {
      numero: number;
      etiqueta: string;
      subtotalCentavos: number;
      lineas: { sku: string | null; varianteWeb: number | null; cantidad: number; precioUnitarioCentavos: number }[];
    }[];
    const conLinea = pedidos.find((p) => p.lineas.some((l) => l.sku));
    test.skip(!conLinea, "No hay pedidos de prueba (correr antes checkout.spec)");
    expect(conLinea!.etiqueta).toMatch(/^#INE-\d{4,}$/);
    expect(conLinea!.subtotalCentavos).toBe(conLinea!.lineas.reduce((acc, l) => acc + l.precioUnitarioCentavos * l.cantidad, 0));
    // Solo los posteriores al número indicado, más los pedidos que se piden aparte
    const despues = (await (await request.get(`/api/pos/pedidos?desde=${conLinea!.numero}&numeros=${conLinea!.numero}`, { headers: auth })).json()).pedidos;
    expect(despues[0].numero).toBe(conLinea!.numero);
    expect(despues.every((p: { numero: number }) => p.numero >= conLinea!.numero)).toBe(true);

    // Stock 0 en el POS: la web ya no deja pedir esa variante
    const linea = conLinea!.lineas.find((l) => l.sku && l.varianteWeb)!;
    const r = await (await request.post("/api/pos/stock", { headers: auth, data: { items: [{ sku: linea.sku!.toLowerCase(), stock: -2 }, { sku: "NO-EXISTE-XL", stock: 3 }] } })).json();
    expect(r).toMatchObject({ recibidos: 2, actualizados: 1, sinVariante: ["NO-EXISTE-XL"], cantidadSinVariante: 1 });
    try {
      const pedido = await request.post("/api/orders", {
        data: { items: [{ variantId: linea.varianteWeb, quantity: 1 }], customerName: "Prueba POS", customerPhone: "341 555-0000", deliveryMethod: "retiro", paymentMethod: "transferencia", website: "" },
      });
      expect(pedido.status()).toBe(409);
    } finally {
      // La web vuelve a vender sin controlar stock
      const off = await (await request.post("/api/pos/stock", { headers: auth, data: { desactivar: true } })).json();
      expect(off.actualizados).toBeGreaterThanOrEqual(1);
    }
  });
});

