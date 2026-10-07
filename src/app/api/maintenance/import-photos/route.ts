import { after } from "next/server";
import { revalidateTag } from "next/cache";
import { TAGS } from "@/lib/catalog";
import { blobEnabled } from "@/lib/storage";
import { autoConfigureCampaign, importPendingPhotos, logImport, photoProgress, testOnePhoto, validMaintenanceToken } from "@/lib/photo-autoimport";

export const maxDuration = 300;

// GET /api/maintenance/import-photos?token=…               → arranca (o continúa) la importación en segundo plano
// GET /api/maintenance/import-photos?token=…&estado=1      → solo muestra el avance
// GET /api/maintenance/import-photos?token=…&diagnostico=1 → prueba bajar y guardar una foto y muestra el resultado
// Solo los nombres de las variables relacionadas con Blob (nunca los valores), para diagnosticar la conexión
const blobEnvNames = () => Object.keys(process.env).filter((k) => /BLOB|OIDC/.test(k)).sort();

export async function GET(request: Request) {
  const url = new URL(request.url);
  if (!validMaintenanceToken(url.searchParams.get("token"))) return new Response("No encontrado", { status: 404 });
  // Refrescar la tienda ya mismo (fuera de segundo plano, así seguro se aplica)
  if (url.searchParams.get("refrescar")) {
    revalidateTag(TAGS.catalog, { expire: 0 });
    revalidateTag(TAGS.settings, { expire: 0 });
    return Response.json({ ok: true, refrescado: true });
  }
  const progress = await photoProgress();
  if (url.searchParams.get("estado")) return Response.json(progress);
  if (url.searchParams.get("diagnostico")) {
    const test = await testOnePhoto();
    await logImport({ diagnostico: test });
    return Response.json({ ...progress, blob: blobEnabled(), variables: blobEnvNames(), diagnostico: test });
  }

  const step = Number(url.searchParams.get("paso") ?? 1);
  // Lo importado en la tanda anterior se publica ya (además de al final de cada tanda)
  if (step > 1) revalidateTag(TAGS.catalog, { expire: 0 });
  await logImport({ paso: step, estado: "iniciado", blob: blobEnabled(), variables: blobEnvNames(), ...progress });
  after(async () => {
    try {
      const result = await importPendingPhotos(240_000);
      revalidateTag(TAGS.catalog, { expire: 0 });
      await logImport({ paso: step, estado: result.pending ? "continúa" : "terminado", importadas: result.imported, errores: result.errors.slice(0, 15), cantidadErrores: result.errors.length });
      if (result.pending && step < 40) {
        // Siguiente tanda en una invocación nueva (por el límite de tiempo de cada función)
        const host = process.env.VERCEL_PROJECT_PRODUCTION_URL ?? url.host;
        const next = `https://${host}/api/maintenance/import-photos?token=${encodeURIComponent(url.searchParams.get("token")!)}&paso=${step + 1}`;
        await fetch(next, { cache: "no-store", signal: AbortSignal.timeout(20_000) }).catch((e) => logImport({ paso: step, estado: "no se pudo encadenar", error: String(e) }));
      } else {
        const configured = await autoConfigureCampaign().catch((e) => {
          void logImport({ paso: step, estado: "error portada/look", error: String(e) });
          return [];
        });
        revalidateTag(TAGS.settings, { expire: 0 });
        revalidateTag(TAGS.catalog, { expire: 0 });
        await logImport({ paso: step, estado: "terminado", configurado: configured });
      }
    } catch (e) {
      await logImport({ paso: step, estado: "falló", error: e instanceof Error ? `${e.message}\n${e.stack?.slice(0, 800)}` : String(e) });
    }
  });
  return Response.json({ ok: true, paso: step, blob: blobEnabled(), variables: blobEnvNames(), ...progress });
}
