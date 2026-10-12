import { cookies } from "next/headers";
import { after } from "next/server";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { createGuestToken, getWholesaleSettings, setWholesaleCookies, wholesaleFromCookie } from "@/lib/wholesale";
import { WHOLESALE_COOKIE } from "@/lib/wholesale-config";
import { registerWholesaleCustomer, wholesaleSignupNotice, wholesaleSignupSchema } from "@/lib/wholesale-signup";

const PRIVATE = { "Cache-Control": "private, no-store" };

// POST /api/mayoristas/registro → solicitud de acceso mayorista (queda pendiente hasta que INEDITA la aprueba).
// Si entró con el código general, con el registro ya puede mandar el pedido (queda a su nombre).
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || typeof body !== "object") return Response.json({ error: "Datos inválidos" }, { status: 400, headers: PRIVATE });
  // Campo trampa para bots: una persona no lo ve ni lo completa
  if (typeof body.website === "string" && body.website.trim()) return Response.json({ status: "recibido" }, { headers: PRIVATE });

  const parsed = wholesaleSignupSchema.safeParse(body);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return Response.json({ error: first?.message ?? "Revisá los datos", field: first?.path.join(".") }, { status: 400, headers: PRIVATE });
  }
  // Solo cuentan los envíos completos (un error de tipeo no gasta intentos)
  if (!rateLimit(`mayorista-registro:${clientIp(request.headers)}`, 8, 60 * 60 * 1000)) {
    return Response.json({ error: "Demasiados intentos. Probá más tarde o escribinos por WhatsApp." }, { status: 429, headers: PRIVATE });
  }
  const config = await getWholesaleSettings();
  if (!config.enabled) return Response.json({ error: "El registro mayorista no está habilitado en este momento. Escribinos por WhatsApp." }, { status: 403, headers: PRIVATE });

  try {
    const result = await registerWholesaleCustomer(parsed.data);
    // Aviso por mail a INEDITA (también si ya estaba pendiente y vuelve a mandar los datos)
    const notice = result.status === "ya-aprobado" ? null : await wholesaleSignupNotice(parsed.data, (task) => after(task), result.status === "ya-pendiente");
    // Con el código general: el acceso pasa a estar a su nombre y ya puede pedir. Si el mail ya tenía acceso
    // aprobado, tiene que entrar con su código personal (así nadie pide a nombre de otro).
    let canOrder = false;
    const access = await wholesaleFromCookie((await cookies()).get(WHOLESALE_COOKIE)?.value);
    if (access?.guest && result.status !== "ya-aprobado") {
      await setWholesaleCookies(createGuestToken(result.id, config.sharedCode));
      canOrder = true;
    }
    // El mínimo de la primera compra se avisa en la confirmación (a las que ya eran clientas se les saca al aprobarlas)
    return Response.json(
      { status: result.status, firstOrderMinUnits: config.firstOrderMinUnits, notice, canOrder },
      { status: result.status === "recibido" ? 201 : 200, headers: PRIVATE },
    );
  } catch (error) {
    console.error("[mayoristas] error en el registro", error);
    return Response.json({ error: "No pudimos guardar tus datos. Probá de nuevo o escribinos por WhatsApp." }, { status: 500, headers: PRIVATE });
  }
}
