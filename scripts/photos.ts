// En cada deploy, antes de armar las páginas: ordena las fotos (modelo primero), importa las fotos de
// Drive que falten (hasta unos minutos) y revisa que existan todas. Nunca frena el deploy.
//   tsx scripts/photos.ts
import { syncPhotoOrder } from "../src/lib/drive-import";
import { importPendingPhotos, logImport, photoProgress } from "../src/lib/photo-autoimport";
import { checkAllProductPhotos } from "../src/lib/photo-check";
import { blobEnabled } from "../src/lib/storage";

async function main() {
  if (!process.env.DATABASE_URL) return console.warn("[fotos] Sin DATABASE_URL: no se revisan fotos");
  const reordered = await syncPhotoOrder();
  console.log(`[fotos] Orden: ${reordered} fotos reordenadas`);
  if (blobEnabled()) {
    const before = await photoProgress();
    if (before.imported < before.files) {
      const r = await importPendingPhotos(Number(process.env.PHOTO_IMPORT_BUDGET_MS ?? 300_000));
      await syncPhotoOrder();
      await logImport({ paso: "deploy", importadas: r.imported, errores: r.errors.slice(0, 15), cantidadErrores: r.errors.length, pendiente: r.pending });
      console.log(`[fotos] Importadas ${r.imported} fotos nuevas${r.errors.length ? ` (${r.errors.length} con error)` : ""}${r.pending ? " · quedan pendientes" : ""}`);
    } else console.log(`[fotos] Todas las fotos de Drive ya están importadas (${before.imported})`);
  } else console.warn("[fotos] Sin Vercel Blob en el build: no se importan fotos nuevas");
  const check = await checkAllProductPhotos();
  console.log(`[fotos] Revisión: ${check.productosPublicados} productos, ${check.fotos} fotos, ${check.archivos} archivos, ${check.rotas.length} con problemas, ${check.productosSinFoto.length} sin foto`);
}

main()
  .catch((e) => console.error("[fotos] Error (el deploy sigue):", e))
  .finally(() => process.exit(0));
