import { cookies } from "next/headers";
import { revalidateTag } from "next/cache";
import { after } from "next/server";
import { getSettings, TAGS } from "@/lib/catalog";
import { sendOrderEmail } from "@/lib/order-email";
import { createOrder, OrderError, orderInputSchema } from "@/lib/orders";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { wholesaleFromCookie } from "@/lib/wholesale";
import { WHOLESALE_COOKIE } from "@/lib/wholesale-config";

export async function POST(request: Request) {
  const ip = clientIp(request.headers);
  if (!rateLimit(`order:${ip}`, 12, 10 * 60 * 1000)) {
    return Response.json({ error: "Demasiados pedidos seguidos. Esperá unos minutos o escribinos por WhatsApp." }, { status: 429 });
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Pedido inválido" }, { status: 400 });
  }
  const parsed = orderInputSchema.safeParse(body);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return Response.json({ error: first?.message ?? "Revisá los datos del pedido", field: first?.path.join(".") }, { status: 400 });
  }
  try {
    const [settings, access] = await Promise.all([getSettings(), wholesaleFromCookie((await cookies()).get(WHOLESALE_COOKIE)?.value)]);
    const order = await createOrder(parsed.data, settings, request.headers.get("user-agent"), access?.config ?? null, access?.customer.id ?? null);
    revalidateTag(TAGS.bestsellers, "max");
    // Aviso por mail a INEDITA, después de responder (no demora el WhatsApp de la clienta)
    after(() =>
      sendOrderEmail({
        id: order.id,
        label: order.label,
        message: order.message,
        customerName: parsed.data.customerName,
        customerPhone: parsed.data.customerPhone,
        total: parsed.data.paymentMethod === "tarjeta" ? order.subtotal : order.cashTotal,
        wholesale: Boolean(access),
      }),
    );
    return Response.json(order, { status: 201 });
  } catch (error) {
    if (error instanceof OrderError) {
      return Response.json({ error: error.message, details: error.details }, { status: error.status });
    }
    console.error("[orders] error creando pedido", error);
    return Response.json({ error: "No pudimos registrar el pedido. Probá de nuevo o escribinos por WhatsApp." }, { status: 500 });
  }
}
