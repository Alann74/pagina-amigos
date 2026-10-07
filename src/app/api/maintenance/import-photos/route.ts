import { after } from "next/server";
import { revalidateTag } from "next/cache";
import { TAGS } from "@/lib/catalog";
import { autoConfigureCampaign, importPendingPhotos, photoProgress, validMaintenanceToken } from "@/lib/photo-autoimport";

export const maxDuration = 300;

// GET /api/maintenance/import-photos?token=…          → arranca (o continúa) la importación en segundo plano
// GET /api/maintenance/import-photos?token=…&estado=1 → solo muestra el avance
export async function GET(request: Request) {
  const url = new URL(request.url);
  if (!validMaintenanceToken(url.searchParams.get("token"))) return new Response("No encontrado", { status: 404 });
  const progress = await photoProgress();
  if (url.searchParams.get("estado")) return Response.json(progress);

  const step = Number(url.searchParams.get("paso") ?? 1);
  after(async () => {
    const result = await importPendingPhotos(240_000);
    revalidateTag(TAGS.catalog, { expire: 0 });
    if (result.errors.length) console.error("[fotos] errores:", result.errors.slice(0, 20));
    console.log(`[fotos] paso ${step}: ${result.imported} importadas, quedan pendientes: ${result.pending}`);
    if (result.pending && step < 40) {
      // Siguiente tanda en una invocación nueva (por el límite de tiempo de cada función)
      const host = process.env.VERCEL_PROJECT_PRODUCTION_URL ?? url.host;
      const next = `https://${host}/api/maintenance/import-photos?token=${encodeURIComponent(url.searchParams.get("token")!)}&paso=${step + 1}`;
      await fetch(next, { cache: "no-store", signal: AbortSignal.timeout(20_000) }).catch((e) => console.error("[fotos] no se pudo encadenar", e));
    } else {
      const configured = await autoConfigureCampaign().catch((e) => {
        console.error("[fotos] portada/look", e);
        return [];
      });
      revalidateTag(TAGS.settings, { expire: 0 });
      revalidateTag(TAGS.catalog, { expire: 0 });
      console.log("[fotos] terminado", configured);
    }
  });
  return Response.json({ ok: true, paso: step, ...progress });
}
