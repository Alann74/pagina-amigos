import Link from "next/link";
import { Suspense } from "react";
import { AdminLoading, AdminTitle, Section, Stat, StatusBadge } from "@/components/admin/ui";
import { adminGate, getDashboard } from "@/lib/admin-data";
import { formatDate, formatOrderNumber, formatPrice } from "@/lib/format";

export default function AdminHome() {
  return (
    <>
      <AdminTitle title="Inicio" subtitle="Resumen del mes y accesos rápidos" />
      <Suspense fallback={<AdminLoading />}>
        <Dashboard />
      </Suspense>
    </>
  );
}

async function Dashboard() {
  await adminGate();
  const d = await getDashboard();
  return (
    <>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Pedidos nuevos" value={d.pending} hint={d.pending ? "Para confirmar por WhatsApp" : "Todo al día"} />
        <Stat label="Pedidos del mes" value={d.month.count} hint={`Estimado ${formatPrice(d.month.estimated)}`} />
        <Stat label="Productos publicados" value={`${d.catalog.visible} / ${d.catalog.total}`} hint={`${d.catalog.total - d.catalog.visible} ocultos`} />
        <Stat label="Sin foto" value={d.catalog.noPhoto} hint={d.catalog.noPrice ? `${d.catalog.noPrice} sin precio` : "Ocultos hasta tener foto"} />
      </div>

      {d.withdrawals ? (
        <Link href="/admin/arrepentimientos" className="mt-6 block border border-ink p-4 text-[14px]">
          Hay {d.withdrawals} {d.withdrawals === 1 ? "solicitud" : "solicitudes"} de arrepentimiento sin responder →
        </Link>
      ) : null}

      <Section title="Últimos pedidos" aside={<Link href="/admin/pedidos" className="nav-link link-underline">Ver todos</Link>}>
        {d.recent.length === 0 ? (
          <p className="text-[14px] text-mute">Todavía no hay pedidos.</p>
        ) : (
          <ul className="divide-y divide-line">
            {d.recent.map((o) => (
              <li key={o.id}>
                <Link href={`/admin/pedidos/${o.id}`} className="flex items-center justify-between gap-4 py-3 hover:bg-soft">
                  <div className="min-w-0">
                    <p className="text-[14px] font-medium tabular-nums">
                      {formatOrderNumber(o.number)} <span className="font-normal text-mute">· {o.customerName}</span>
                    </p>
                    <p className="text-[12px] text-mute">
                      {formatDate(o.createdAt, true)} · {o.itemsCount} {o.itemsCount === 1 ? "prenda" : "prendas"} · {formatPrice(o.subtotal)}
                    </p>
                  </div>
                  <StatusBadge status={o.status} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Accesos rápidos">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[
            { href: "/admin/productos/nuevo", label: "Cargar producto" },
            { href: "/admin/precios", label: "Actualizar precios" },
            { href: "/admin/fotos", label: "Importar fotos" },
            { href: "/admin/configuracion", label: "Anuncio y portada" },
          ].map((l) => (
            <Link key={l.href} href={l.href} className="btn btn-secondary w-full">
              {l.label}
            </Link>
          ))}
        </div>
      </Section>
    </>
  );
}
