// En cada deploy, antes de armar las páginas: pasa a la base las fotos que estaban en Vercel Blob,
// importa las fotos de Drive que falten, las ordena (modelo primero) y revisa que existan todas.
// Nunca frena el deploy.   tsx scripts/photos.ts
import { syncPhotoOrder } from "../src/lib/drive-import";
import { importPendingPhotos, logImport, migrateCampaignToDb, migrateImagesToDb, photoProgress } from "../src/lib/photo-autoimport";
import { checkAllProductPhotos } from "../src/lib/photo-check";

const BUDGET = Number(process.env.PHOTO_IMPORT_BUDGET_MS ?? 14 * 60_000);

async function main() {
  if (!process.env.DATABASE_URL) return console.warn("[fotos] Sin DATABASE_URL: no se revisan fotos");
  const t0 = Date.now();
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
  const before = await photoProgress();
  const left = BUDGET - (Date.now() - t0);
  if (before.imported < before.files && left > 30_000) {
    const r = await importPendingPhotos(left);
    await logImport({ paso: "deploy", importadas: r.imported, errores: r.errors.slice(0, 15), cantidadErrores: r.errors.length, pendiente: r.pending });
    console.log(`[fotos] Importadas ${r.imported} fotos nuevas${r.errors.length ? ` (${r.errors.length} con error)` : ""}${r.pending ? " · quedan pendientes" : ""}`);
  }
  console.log(`[fotos] Orden: ${await syncPhotoOrder()} fotos reordenadas`);
  const check = await checkAllProductPhotos();
  console.log(`[fotos] Revisión: ${check.productosPublicados} productos, ${check.fotos} fotos, ${check.rotas.length} con problemas, ${check.productosSinFoto.length} sin foto`);
}

main()
  .catch((e) => console.error("[fotos] Error (el deploy sigue):", e))
  .finally(() => process.exit(0));
