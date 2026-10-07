import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { SetupButton } from "@/components/admin/setup-button";
import { AdminLoading, AdminTitle, Section } from "@/components/admin/ui";
import { adminGate } from "@/lib/admin-data";
import { getInstallStatus } from "@/lib/install";

export const metadata: Metadata = { title: "Instalación" };

export default function InstallPage() {
  return (
    <>
      <AdminTitle title="Instalación" subtitle="Estado de la base de datos, las fotos y las integraciones" />
      <Suspense fallback={<AdminLoading />}>
        <Status />
      </Suspense>
    </>
  );
}

function Check({ ok, label, hint }: { ok: boolean; label: string; hint?: React.ReactNode }) {
  return (
    <li className="flex gap-3 border-b border-line py-3 text-[14px]">
      <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center border text-[11px] ${ok ? "border-ink bg-ink text-paper" : "border-ink"}`} aria-hidden>
        {ok ? "✓" : ""}
      </span>
      <div>
        <p>
          {label} <span className="sr-only">{ok ? "(listo)" : "(pendiente)"}</span>
        </p>
        {hint ? <p className="mt-0.5 text-[12px] text-mute">{hint}</p> : null}
      </div>
    </li>
  );
}

async function Status() {
  await adminGate();
  const s = await getInstallStatus();
  const tablesReady = s.counts !== null && s.migrations.applied >= s.migrations.total;
  const catalogReady = (s.counts?.products ?? 0) > 0;
  return (
    <>
      <Section title="1. Base de datos">
        <ul>
          <Check ok={s.env.database} label="DATABASE_URL configurada" hint={s.env.database ? null : "Conectá Neon al proyecto en Vercel (Storage → Neon) o cargá la variable a mano."} />
          <Check ok={s.connection.ok} label="Conexión con la base" hint={s.connection.error} />
          <Check ok={tablesReady} label={`Tablas creadas (${s.migrations.applied}/${s.migrations.total} migraciones)`} />
          <Check ok={catalogReady} label={catalogReady ? `Catálogo cargado: ${s.counts!.products} productos, ${s.counts!.variants} variantes, ${s.counts!.orders} pedidos` : "Catálogo cargado"} />
        </ul>
        <div className="mt-6">
          {s.connection.ok ? (
            <>
              <SetupButton label={tablesReady && catalogReady ? "Revisar y completar" : "Preparar base de datos"} />
              <p className="mt-3 max-w-2xl text-[12px] text-mute">
                Crea las tablas que falten y carga los productos del sistema del local (data/pos-productos.csv). No borra ni modifica nada de lo existente: se puede tocar las veces que haga falta.
              </p>
            </>
          ) : null}
        </div>
      </Section>

      <Section title="2. Fotos">
        <ul>
          <Check ok={s.env.blob} label="Vercel Blob conectado" hint={s.env.blob ? null : "Sin Blob, las fotos no se pueden guardar en producción. Vercel → Storage → Blob → conectar al proyecto."} />
          <Check ok={(s.counts?.images ?? 0) > 0} label={`Fotos importadas: ${s.counts?.images ?? 0}`} hint={<Link href="/admin/fotos" className="underline underline-offset-2">Importar desde Drive →</Link>} />
        </ul>
      </Section>

      <Section title="3. Acceso y medición">
        <ul>
          <Check ok label="ADMIN_PASSWORD configurada" />
          <Check ok={s.env.sessionSecret} label="ADMIN_SESSION_SECRET (opcional)" hint="Si no está, la sesión se firma con la contraseña. Recomendado: un texto largo al azar." />
          <Check ok label={`Dirección del sitio: ${s.env.siteUrl}`} hint="Se usa en links compartidos, feed y sitemap. Se toma sola en Vercel; para el dominio propio se define NEXT_PUBLIC_SITE_URL." />
          <Check ok={s.env.metaPixel} label="Meta Pixel (NEXT_PUBLIC_META_PIXEL_ID)" hint="Opcional. Si está vacío no se carga." />
          <Check ok={s.env.ga4} label="Google Analytics 4 (NEXT_PUBLIC_GA4_ID)" hint="Opcional. Si está vacío no se carga." />
        </ul>
        <p className="mt-4 text-[13px] text-mute">
          Feed para el catálogo de Meta: <code className="text-ink">{s.env.siteUrl}/feed/meta.xml</code> (o <code className="text-ink">/feed/meta.csv</code>)
        </p>
      </Section>
    </>
  );
}
