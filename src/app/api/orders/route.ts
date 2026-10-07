import { cookies } from "next/headers";
import { revalidateTag } from "next/cache";
import { getSettings, TAGS } from "@/lib/catalog";
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
    const [settings, wholesale] = await Promise.all([getSettings(), wholesaleFromCookie((await cookies()).get(WHOLESALE_COOKIE)?.value)]);
    const order = await createOrder(parsed.data, settings, request.headers.get("user-agent"), wholesale);
    revalidateTag(TAGS.bestsellers, "max");
    return Response.json(order, { status: 201 });
  } catch (error) {
    if (error instanceof OrderError) {
      return Response.json({ error: error.message, details: error.details }, { status: error.status });
    }
    console.error("[orders] error creando pedido", error);
    return Response.json({ error: "No pudimos registrar el pedido. Probá de nuevo o escribinos por WhatsApp." }, { status: 500 });
  }
}
