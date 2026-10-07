// En cada deploy, antes de armar las páginas: pasa a la base las fotos que estaban en Vercel Blob,
// importa las fotos de Drive que falten, las ordena (modelo primero) y revisa que existan todas.
// Nunca frena el deploy.   tsx scripts/photos.ts
import { importPendingPhotos, logImport, migrateCampaignToDb, migrateImagesToDb, photoProgress } from "../src/lib/photo-autoimport";
import { discoverDrivePhotos } from "../src/lib/drive-discovery";
import { classificationReport } from "../src/lib/photo-analysis";
import { liveCheck } from "../src/lib/live-check";
import { checkAllProductPhotos } from "../src/lib/photo-check";
import { backfillHashes, crossProductReport, removeDuplicatePhotos, removeForeignPhotos } from "../src/lib/photo-dedupe";
import { syncPhotoOrder } from "../src/lib/photo-order";
import { refitModelPhotos } from "../src/lib/photo-refit";
import { purgeDeferredMedia } from "../src/lib/media";

const BUDGET = Number(process.env.PHOTO_IMPORT_BUDGET_MS ?? 14 * 60_000);

async function main() {
  if (!process.env.DATABASE_URL) return console.warn("[fotos] Sin DATABASE_URL: no se revisan fotos");
  const t0 = Date.now();
  // Lo que dejó de usarse en el deploy anterior (ya no lo muestra la versión publicada)
  console.log(`[fotos] Fotos viejas borradas: ${await purgeDeferredMedia().catch(() => 0)}`);
  const campaign = await migrateCampaignToDb().catch((e) => {
    console.error("[fotos] Portada/look:", e);
    return [];
  });
  if (campaign.length) console.log(`[fotos] Portada y look pasados a la base: ${campaign.length}`);
  const moved = await migrateImagesToDb(BUDGET);
  if (moved.moved || moved.errors.length) {
    await logImport({ paso: "deploy-migracion", pasadas: moved.moved, errores: moved.errors.slice(0, 15), cantidadErrores: moved.errors.length, pendientes: moved.pending });
    console.log(`[fotos] Pasadas a la base: ${moved.moved}${moved.errors.length ? ` (${moved.errors.length} con error)` : ""}${moved.pending ? ` · quedan ${moved.pending}` : ""}`);
  }
  // Fotos en las carpetas de Drive de Temporada 3 (las nuevas se importan abajo)
  const found = await discoverDrivePhotos().catch((e) => {
    console.error("[fotos] Búsqueda en Drive:", e);
    return null;
  });
  if (found) console.log(`[fotos] Drive: ${found.fotos} fotos para ${found.articulos} artículos · sin foto: ${found.sinFoto.length} · sin modelo: ${found.sinModelo.length} · ${JSON.stringify(found.carpetas)}`);
  const before = await photoProgress();
  const left = BUDGET - (Date.now() - t0);
  if (before.imported < before.files && left > 30_000) {
    const r = await importPendingPhotos(left);
    await logImport({ paso: "deploy", importadas: r.imported, errores: r.errors.slice(0, 15), cantidadErrores: r.errors.length, pendiente: r.pending });
    console.log(`[fotos] Importadas ${r.imported} fotos nuevas${r.errors.length ? ` (${r.errors.length} con error)` : ""}${r.pending ? " · quedan pendientes" : ""}`);
  }
  console.log(`[fotos] Huellas calculadas: ${await backfillHashes()}`);
  const removed = await removeDuplicatePhotos();
  console.log(`[fotos] Repetidas quitadas: ${removed.length}`);
  const foreign = await removeForeignPhotos();
  console.log(`[fotos] Fotos de otra prenda quitadas: ${foreign.length}`);
  console.log(`[fotos] Orden: ${await syncPhotoOrder()} fotos reordenadas`);
  // Fotos con modelo que quedaron con bandas blancas: se vuelven a encuadrar desde el original de Drive
  const refit = await refitModelPhotos(Math.max(60_000, BUDGET - (Date.now() - t0))).catch((e) => ({ error: String(e) }));
  console.log("[fotos] Encuadre:", JSON.stringify(refit));
  await logImport({ paso: "encuadre", ...refit });
  await classificationReport().catch((e) => console.error("[fotos] Análisis:", e));
  const cross = await crossProductReport();
  console.log(`[fotos] Misma foto en artículos distintos (a revisar): ${cross.total}`);
  // La tienda publicada (la versión anterior a este deploy), vista desde afuera
  const host = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (host) {
    const live = await liveCheck(`https://${host}`).catch((e) => ({ error: String(e) }));
    console.log("[fotos] En vivo:", JSON.stringify((live as { fotos?: unknown }).fotos ?? live).slice(0, 300));
  }
  const check = await checkAllProductPhotos();
  console.log(`[fotos] Revisión: ${check.productosPublicados} productos, ${check.fotos} fotos, ${check.rotas.length} con problemas, ${check.productosSinFoto.length} sin foto`);
}

main()
  .catch((e) => console.error("[fotos] Error (el deploy sigue):", e))
  .finally(() => process.exit(0));
