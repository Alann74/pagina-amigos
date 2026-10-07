import { randomBytes } from "node:crypto";
import { db } from "@/db";
import { settings } from "@/db/schema";
import { checkAllProductPhotos } from "@/lib/photo-check";
import { clientIp, rateLimit } from "@/lib/rate-limit";

export const maxDuration = 120;
const PRIVATE = { "Cache-Control": "private, no-store" };

// GET /api/diagnostico → revisa desde el servidor que existan todas las fotos del catálogo (todos los tamaños)
export async function GET(request: Request) {
  if (!rateLimit(`diag-srv:${clientIp(request.headers)}`, 4, 10 * 60 * 1000)) return Response.json({ error: "Probá de nuevo en unos minutos" }, { status: 429 });
  return Response.json(await checkAllProductPhotos(), { headers: PRIVATE });
}

// POST /api/diagnostico → guarda lo que vio el navegador de la persona (para revisarlo desde el admin)
export async function POST(request: Request) {
  if (!rateLimit(`diag:${clientIp(request.headers)}`, 10, 10 * 60 * 1000)) return Response.json({ ok: false }, { status: 429 });
  const text = await request.text();
  if (text.length > 30_000) return Response.json({ ok: false }, { status: 413 });
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return Response.json({ ok: false }, { status: 400 });
  }
  const key = `diagnostico-equipo:${new Date().toISOString()}:${randomBytes(3).toString("hex")}`;
  await db.insert(settings).values({ key, value: { ...(data as object), ip: clientIp(request.headers).replace(/\.\d+$/, ".x") } });
  return Response.json({ ok: true, id: key }, { headers: PRIVATE });
}
