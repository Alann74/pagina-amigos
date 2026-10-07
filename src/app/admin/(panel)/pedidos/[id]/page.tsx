import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { WhatsAppIcon } from "@/components/icons";
import { OrderNote, OrderStatusSelect } from "@/components/admin/order-status";
import { CopyButton } from "@/components/admin/copy-button";
import { AdminLoading, Section } from "@/components/admin/ui";
import { adminGate, getOrderDetail } from "@/lib/admin-data";
import { displayColor, displaySize, formatDate, formatOrderNumber, formatPrice } from "@/lib/format";
import { toWhatsappNumber, whatsappUrl } from "@/lib/whatsapp";

export const metadata: Metadata = { title: "Pedido" };

const PAYMENT: Record<string, string> = { efectivo: "Efectivo", transferencia: "Transferencia", tarjeta: "Tarjeta (3 cuotas sin interés)" };

export default function OrderPage(props: PageProps<"/admin/pedidos/[id]">) {
  return (
    <Suspense fallback={<AdminLoading />}>
      <OrderDetail params={props.params} />
    </Suspense>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[120px_1fr] gap-4 border-b border-line py-2.5 text-[14px]">
      <dt className="text-mute">{label}</dt>
      <dd className="min-w-0 break-words">{children}</dd>
    </div>
  );
}

async function OrderDetail({ params }: { params: PageProps<"/admin/pedidos/[id]">["params"] }) {
  await adminGate();
  const { id } = await params;
  const data = /^\d+$/.test(id) ? await getOrderDetail(Number(id)) : null;
  if (!data) notFound();
  const { order, items } = data;
  const label = formatOrderNumber(order.number);
  const firstName = order.customerName.split(" ")[0];
  const toCustomer = whatsappUrl(toWhatsappNumber(order.customerPhone), `Hola ${firstName}! Te escribimos de INEDITA por tu pedido ${label}.`);
  const total = order.paymentMethod === "tarjeta" ? order.subtotal : order.cashTotal;

  return (
    <>
      <Link href="/admin/pedidos" className="nav-link text-mute hover:text-ink">
        ← Pedidos
      </Link>
      <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[24px] font-light tabular-nums tracking-[0.08em]">{label}</h1>
          <p className="mt-1 text-[13px] text-mute">{formatDate(order.createdAt, true)}</p>
        </div>
        <OrderStatusSelect orderId={order.id} status={order.status} />
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        <a href={toCustomer} target="_blank" rel="noopener" className="btn btn-primary">
          <WhatsAppIcon size={16} /> Escribirle a {firstName}
        </a>
        <CopyButton text={order.whatsappMessage} label="Copiar mensaje del pedido" />
      </div>

      <div className="grid gap-x-12 lg:grid-cols-[1.4fr_1fr]">
        <Section title={`Prendas (${order.itemsCount})`}>
          <ul className="divide-y divide-line">
            {items.map((it) => (
              <li key={it.id} className="flex justify-between gap-4 py-3 text-[14px]">
                <div className="min-w-0">
                  <p className="font-medium">
                    {it.slug ? (
                      <Link href={`/producto/${it.slug}`} target="_blank" className="link-underline">
                        {it.name}
                      </Link>
                    ) : (
                      it.name
                    )}
                  </p>
                  <p className="text-[12px] text-mute">
                    {[it.articleCode ? `Art. ${it.articleCode}` : null, it.size ? `Talle ${displaySize(it.size)}` : null, it.color ? displayColor(it.color) : null, it.sku].filter(Boolean).join(" · ")}
                  </p>
                </div>
                <p className="shrink-0 text-right tabular-nums">
                  {it.quantity} × {formatPrice(it.unitPrice)}
                  <br />
                  <span className="font-medium">{formatPrice(it.lineTotal)}</span>
                </p>
              </li>
            ))}
          </ul>
          <dl className="mt-4">
            <Row label="Subtotal">{formatPrice(order.subtotal)}</Row>
            <Row label={`Con ${order.discountPercent}% OFF`}>{formatPrice(order.cashTotal)} (efectivo / transferencia)</Row>
            <Row label="A cobrar">
              <span className="font-medium">{formatPrice(total)}</span> · {PAYMENT[order.paymentMethod]}
            </Row>
          </dl>
        </Section>

        <div>
          <Section title="Clienta">
            <dl>
              {order.channel === "mayorista" ? <Row label="Tipo">Pedido mayorista (precios por mayor)</Row> : null}
              <Row label="Nombre">{order.customerName}</Row>
              <Row label="Teléfono">
                <a href={`tel:${order.customerPhone.replace(/[^\d+]/g, "")}`} className="link-underline">
                  {order.customerPhone}
                </a>
              </Row>
              <Row label="Entrega">{order.deliveryMethod === "retiro" ? "Retira en el local" : `Envío a coordinar · ${order.deliveryArea ?? ""}`}</Row>
              <Row label="Pago">{PAYMENT[order.paymentMethod]}</Row>
              {order.promoCode ? <Row label="Bienvenida">{order.discountPercent}% OFF · código {order.promoCode}</Row> : null}
              {order.comment ? <Row label="Comentario">{order.comment}</Row> : null}
            </dl>
          </Section>
          <Section title="Origen">
            <dl>
              <Row label="Fuente">{order.trafficSource ?? "directo"}</Row>
              {order.utmSource ? <Row label="utm_source">{order.utmSource}</Row> : null}
              {order.utmMedium ? <Row label="utm_medium">{order.utmMedium}</Row> : null}
              {order.utmCampaign ? <Row label="utm_campaign">{order.utmCampaign}</Row> : null}
              {order.utmContent ? <Row label="utm_content">{order.utmContent}</Row> : null}
              {order.utmTerm ? <Row label="utm_term">{order.utmTerm}</Row> : null}
              {order.landingPath ? <Row label="Entró por">{order.landingPath}</Row> : null}
              {order.referrer ? <Row label="Referrer">{order.referrer}</Row> : null}
            </dl>
          </Section>
          <Section title="Notas">
            <OrderNote orderId={order.id} status={order.status} note={order.adminNote ?? ""} />
          </Section>
        </div>
      </div>

      <Section title="Mensaje enviado">
        <pre className="whitespace-pre-wrap bg-soft p-4 font-sans text-[13px] leading-relaxed">{order.whatsappMessage}</pre>
      </Section>
    </>
  );
}
