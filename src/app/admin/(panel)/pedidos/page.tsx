import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { OrderStatusSelect } from "@/components/admin/order-status";
import { AdminLoading, AdminTitle, Section, Stat } from "@/components/admin/ui";
import { adminGate, getOrdersList, monthStart, parseOrderFilters, shiftDays, todayAR, type OrderFilters } from "@/lib/admin-data";
import { formatDate, formatOrderNumber, formatPrice } from "@/lib/format";

export const metadata: Metadata = { title: "Pedidos" };

const PAYMENT: Record<string, string> = { efectivo: "Efectivo", transferencia: "Transferencia", tarjeta: "Tarjeta" };

export default function OrdersPage(props: PageProps<"/admin/pedidos">) {
  return (
    <>
      <AdminTitle title="Pedidos" subtitle="Pedidos enviados por WhatsApp desde la web" />
      <Suspense fallback={<AdminLoading />}>
        <Orders searchParams={props.searchParams} />
      </Suspense>
    </>
  );
}

function qs(f: OrderFilters, patch: Partial<Record<"estado" | "desde" | "hasta", string | null>>) {
  const p = new URLSearchParams();
  const base = { estado: f.status, desde: f.from ?? "todo", hasta: f.to, ...patch };
  for (const [k, v] of Object.entries(base)) if (v) p.set(k, v);
  return `/admin/pedidos?${p.toString()}`;
}

async function Orders({ searchParams }: { searchParams: PageProps<"/admin/pedidos">["searchParams"] }) {
  await adminGate();
  const filters = parseOrderFilters(await searchParams);
  const { list, totals, top, sources } = await getOrdersList(filters);
  const today = todayAR();
  const prevMonthEnd = shiftDays(monthStart(today), -1);
  const ranges = [
    { label: "Hoy", desde: today, hasta: null },
    { label: "7 días", desde: shiftDays(today, -6), hasta: null },
    { label: "Este mes", desde: monthStart(today), hasta: null },
    { label: "Mes pasado", desde: monthStart(prevMonthEnd), hasta: prevMonthEnd },
    { label: "Todo", desde: "todo", hasta: null },
  ];
  const isRange = (r: (typeof ranges)[number]) => (filters.from ?? "todo") === r.desde && (filters.to ?? null) === r.hasta;

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {ranges.map((r) => (
          <Link key={r.label} href={qs(filters, { desde: r.desde, hasta: r.hasta })} className={`label border px-3 py-2 ${isRange(r) ? "border-ink bg-ink text-paper" : "border-line hover:border-ink"}`}>
            {r.label}
          </Link>
        ))}
      </div>

      <form className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-4 sm:items-end" action="/admin/pedidos">
        <div>
          <label htmlFor="f-desde" className="label text-mute">Desde</label>
          <input id="f-desde" type="date" name="desde" defaultValue={filters.from ?? ""} className="field" />
        </div>
        <div>
          <label htmlFor="f-hasta" className="label text-mute">Hasta</label>
          <input id="f-hasta" type="date" name="hasta" defaultValue={filters.to ?? ""} className="field" />
        </div>
        <div>
          <label htmlFor="f-estado" className="label text-mute">Estado</label>
          <select id="f-estado" name="estado" defaultValue={filters.status ?? ""} className="field">
            <option value="">Todos</option>
            <option value="nuevo">Nuevo</option>
            <option value="confirmado">Confirmado</option>
            <option value="entregado">Entregado</option>
            <option value="cancelado">Cancelado</option>
          </select>
        </div>
        <button type="submit" className="btn btn-secondary">Filtrar</button>
      </form>

      <div className="mt-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Pedidos" value={totals.count} hint={`${totals.items} prendas · sin cancelados`} />
        <Stat label="Total del período" value={formatPrice(totals.estimated)} hint="Según el medio de pago elegido" />
        <Stat label="Total de lista" value={formatPrice(totals.subtotal)} hint="Sin descuento" />
        <Stat label="Entregados" value={formatPrice(totals.delivered)} hint="Ventas cerradas" />
      </div>

      <Section title={`Pedidos (${list.length})`}>
        {list.length === 0 ? (
          <p className="text-[14px] text-mute">No hay pedidos en este período.</p>
        ) : (
          <ul className="divide-y divide-line" data-testid="orders-list">
            {list.map((o) => (
              <li key={o.id} className="flex flex-wrap items-center justify-between gap-3 py-4">
                <Link href={`/admin/pedidos/${o.id}`} className="min-w-0 flex-1 hover:opacity-70">
                  <p className="text-[14px] font-medium tabular-nums">
                    {formatOrderNumber(o.number)} <span className="font-normal">· {o.customerName}</span>
                    {o.channel === "mayorista" ? <span className="label ml-2 inline-block bg-ink px-1.5 py-0.5 align-middle text-[9.5px] text-paper">Mayorista</span> : null}
                    {o.promoCode ? <span className="label ml-2 inline-block border border-ink px-1.5 py-0.5 align-middle text-[9.5px]">Bienvenida</span> : null}
                  </p>
                  <p className="mt-0.5 text-[12px] text-mute">
                    {formatDate(o.createdAt, true)} · {o.itemsCount} {o.itemsCount === 1 ? "prenda" : "prendas"} · {formatPrice(o.paymentMethod === "tarjeta" ? o.subtotal : o.cashTotal)} {PAYMENT[o.paymentMethod]} ·{" "}
                    {o.deliveryMethod === "retiro" ? "Retira" : `Envío ${o.deliveryArea ?? ""}`} · {o.trafficSource ?? "directo"}
                    {o.utmCampaign ? ` / ${o.utmCampaign}` : ""}
                  </p>
                </Link>
                <OrderStatusSelect orderId={o.id} status={o.status} compact />
              </li>
            ))}
          </ul>
        )}
      </Section>

      <div className="grid gap-x-12 lg:grid-cols-2">
        <Section title="Lo más pedido del período">
          {top.length === 0 ? (
            <p className="text-[14px] text-mute">Sin datos.</p>
          ) : (
            <ol className="divide-y divide-line">
              {top.map((t, i) => (
                <li key={`${t.productId}-${t.name}`} className="flex items-baseline justify-between gap-4 py-2.5 text-[14px]">
                  <span className="min-w-0">
                    <span className="mr-3 tabular-nums text-mute">{i + 1}.</span>
                    {t.name}
                    {t.articleCode ? <span className="text-mute"> · {t.articleCode}</span> : null}
                  </span>
                  <span className="shrink-0 tabular-nums">
                    {t.quantity} u. <span className="text-mute">· {formatPrice(t.amount)}</span>
                  </span>
                </li>
              ))}
            </ol>
          )}
        </Section>
        <Section title="Origen de los pedidos">
          {sources.length === 0 ? (
            <p className="text-[14px] text-mute">Sin datos.</p>
          ) : (
            <ul className="divide-y divide-line">
              {sources.map((s) => (
                <li key={s.source} className="flex justify-between py-2.5 text-[14px]">
                  <span className="capitalize">{s.source}</span>
                  <span className="tabular-nums">{s.count}</span>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>
    </>
  );
}
