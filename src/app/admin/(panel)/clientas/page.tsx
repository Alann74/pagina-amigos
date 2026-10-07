import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { SubscribersExport } from "@/components/admin/subscribers-export";
import { AdminLoading, AdminTitle, Section, Stat } from "@/components/admin/ui";
import { adminGate, getSubscribers } from "@/lib/admin-data";
import { formatDate, formatOrderNumber } from "@/lib/format";
import { toWhatsappNumber } from "@/lib/whatsapp";

export const metadata: Metadata = { title: "Clientas" };

export default function SubscribersPage() {
  return (
    <>
      <AdminTitle title="Clientas" subtitle="Quienes se suscribieron en el pop-up de bienvenida (mail + WhatsApp) y si ya usaron su descuento." />
      <Suspense fallback={<AdminLoading />}>
        <Content />
      </Suspense>
    </>
  );
}

async function Content() {
  await adminGate();
  const rows = await getSubscribers();
  const used = rows.filter((r) => r.usedAt).length;
  const last7 = rows.filter((r) => r.recent).length;
  return (
    <>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Suscriptas" value={rows.length} />
        <Stat label="Últimos 7 días" value={last7} />
        <Stat label="Usaron el descuento" value={used} />
        <Stat label="Conversión" value={rows.length ? `${Math.round((used / rows.length) * 100)}%` : "—"} />
      </div>
      <Section title={`Listado (${rows.length})`} aside={rows.length ? <SubscribersExport rows={rows} /> : null}>
        {rows.length === 0 ? (
          <p className="text-[14px] text-mute">Todavía no hay suscriptas. El pop-up se configura en Configuración → Pop-up de bienvenida.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-[13px]">
              <thead>
                <tr className="label border-b border-line text-left text-mute">
                  <th className="py-2 pr-3 font-normal">Fecha</th>
                  <th className="py-2 pr-3 font-normal">Mail</th>
                  <th className="py-2 pr-3 font-normal">WhatsApp</th>
                  <th className="py-2 pr-3 font-normal">Código</th>
                  <th className="py-2 font-normal">Usado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td className="py-2 pr-3 tabular-nums text-mute">{formatDate(r.createdAt)}</td>
                    <td className="py-2 pr-3">
                      <a href={`mailto:${r.email}`} className="link-underline">
                        {r.email}
                      </a>
                    </td>
                    <td className="py-2 pr-3">
                      <a href={`https://wa.me/${toWhatsappNumber(r.phone)}`} target="_blank" rel="noopener" className="link-underline">
                        {r.phone}
                      </a>
                    </td>
                    <td className="py-2 pr-3 tabular-nums">
                      {r.code} <span className="text-mute">· {r.discountPercent}%</span>
                    </td>
                    <td className="py-2">
                      {r.orderId && r.orderNumber ? (
                        <Link href={`/admin/pedidos/${r.orderId}`} className="link-underline">
                          {formatOrderNumber(r.orderNumber)}
                        </Link>
                      ) : r.usedAt ? (
                        formatDate(r.usedAt)
                      ) : (
                        <span className="text-mute">No</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>
    </>
  );
}
