import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { BulkUploader, type PlanEntry } from "@/components/admin/bulk-uploader";
import { DriveImporter } from "@/components/admin/drive-importer";
import { RefreshStoreButton } from "@/components/admin/refresh-store-button";
import { AdminLoading, AdminTitle, Section } from "@/components/admin/ui";
import { adminGate, getAdminProducts } from "@/lib/admin-data";
import { getImportedDriveIds, getLookCandidates, getPhotoStatus, PHOTO_MATCHES, PHOTO_UNMATCHED } from "@/lib/drive-import";

export const metadata: Metadata = { title: "Fotos" };

export default function PhotosPage() {
  return (
    <>
      <AdminTitle title="Fotos" subtitle="Importación desde Drive y reporte de productos sin foto">
        <RefreshStoreButton />
      </AdminTitle>
      <Suspense fallback={<AdminLoading />}>
        <Photos />
      </Suspense>
    </>
  );
}

async function Photos() {
  await adminGate();
  const [status, products, importedDriveIds] = await Promise.all([getPhotoStatus(), getAdminProducts(), getImportedDriveIds()]);
  const plan: PlanEntry[] = Object.entries(PHOTO_MATCHES).flatMap(([article, list]) => list.map((m, index): PlanEntry => [m.title.toLowerCase(), article, index, m.driveId, m.color ?? "", m.kind]));
  const withoutPhoto = products.filter((p) => p.imageCount === 0);
  const unmatched = Object.entries(PHOTO_UNMATCHED.codes);
  return (
    <>
      <DriveImporter status={status} looks={getLookCandidates()} />
      <BulkUploader plan={plan} products={products.map((p) => ({ id: p.id, articleCode: p.articleCode }))} importedDriveIds={importedDriveIds} />

      <Section title={`Productos sin foto (${withoutPhoto.length})`}>
        {withoutPhoto.length === 0 ? (
          <p className="text-[14px] text-mute">Todos los productos tienen al menos una foto.</p>
        ) : (
          <>
            <p className="mb-3 text-[13px] text-mute">Quedan ocultos en la tienda hasta que tengan foto. Podés subirlas desde la ficha de cada uno.</p>
            <ul className="divide-y divide-line">
              {withoutPhoto.map((p) => (
                <li key={p.id} className="flex justify-between gap-4 py-2.5 text-[14px]">
                  <Link href={`/admin/productos/${p.id}`} className="link-underline">
                    {p.name}
                  </Link>
                  <span className="text-mute">{p.articleCode ? `Art. ${p.articleCode}` : "Sin artículo"}</span>
                </li>
              ))}
            </ul>
          </>
        )}
      </Section>

      <Section title={`Fotos sin producto (${unmatched.length} artículos)`}>
        <p className="mb-3 max-w-2xl text-[13px] text-mute">
          Están en Drive pero su número de artículo no está cargado (puede ser de otra temporada o faltar en el sistema del local). Si das de alta el artículo, avisá para volver a cruzar las fotos.
        </p>
        <ul className="grid gap-x-8 sm:grid-cols-2 lg:grid-cols-3">
          {unmatched.map(([code, files]) => (
            <li key={code} className="border-b border-line py-2 text-[13px]">
              <span className="font-medium tabular-nums">{code}</span> <span className="text-mute">· {files.length} {files.length === 1 ? "foto" : "fotos"}</span>
              <p className="truncate text-[12px] text-mute" title={files.join("\n")}>
                {files[0]}
              </p>
            </li>
          ))}
        </ul>
      </Section>
    </>
  );
}
