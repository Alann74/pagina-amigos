import { ordersForPos, validPosToken } from "@/lib/pos-link";

// El POS lee los pedidos web para preguntar en la caja si se descuentan del stock.
//   GET /api/pos/pedidos?desde=<último número que ya tiene>&numeros=<pendientes, separados por coma>
export async function GET(request: Request) {
  if (!validPosToken(request.headers.get("authorization"))) return Response.json({ error: "No autorizado" }, { status: 401 });
  const url = new URL(request.url);
  const after = Math.max(0, Number.parseInt(url.searchParams.get("desde") ?? "0", 10) || 0);
  const numbers = (url.searchParams.get("numeros") ?? "")
    .split(",")
    .map((n) => Number.parseInt(n, 10))
    .filter((n) => Number.isInteger(n) && n > 0)
    .slice(0, 200);
  try {
    const pedidos = await ordersForPos(after, numbers);
    return Response.json({ pedidos }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[pos/pedidos]", error);
    return Response.json({ error: "No se pudieron leer los pedidos" }, { status: 500 });
  }
}
