import type { Metadata } from "next";
import { Suspense } from "react";
import { CsvImport } from "@/components/admin/csv-import";
import { AdminLoading, AdminTitle, Section } from "@/components/admin/ui";
import { adminGate } from "@/lib/admin-data";

export const metadata: Metadata = { title: "CSV" };

export default function CsvPage() {
  return (
    <>
      <AdminTitle title="Importar / exportar CSV" subtitle="Para actualizar precios, stock y visibilidad desde Excel o Google Sheets" />
      <Suspense fallback={<AdminLoading />}>
        <Content />
      </Suspense>
    </>
  );
}

async function Content() {
  await adminGate();
  return (
    <>
      <Section title="1. Exportar">
        <p className="max-w-2xl text-[14px] leading-relaxed">Descargá el listado actual: una fila por artículo + color + talle. Abrilo con Excel o Google Sheets, cambiá lo que necesites y guardalo como CSV.</p>
        <a href="/api/admin/csv" className="btn btn-primary mt-5" download>
          Descargar CSV
        </a>
      </Section>
      <Section title="2. Importar">
        <ul className="mb-6 max-w-2xl list-disc space-y-1 pl-5 text-[14px] leading-relaxed">
          <li><strong>precio</strong>: precio de lista por artículo (sin $ ni puntos también vale: 45000).</li>
          <li><strong>stock</strong>: unidades por SKU. Un guion (-) = sin control de stock. Vacío = no se toca.</li>
          <li><strong>visible</strong>: si / no. Los productos sin foto siguen ocultos.</li>
          <li><strong>etiqueta</strong>: código de la etiqueta física (ej. 39603%DMS).</li>
          <li>Antes de aplicar vas a ver la lista de cambios. No se crean ni se borran productos.</li>
        </ul>
        <CsvImport />
      </Section>
    </>
  );
}
