import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import QRCode from "qrcode";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { orders } from "@/db/schema";
import { OrderActions } from "@/components/cart/order-confirmation";
import { getSettings } from "@/lib/catalog";
import { formatOrderNumber, formatPrice } from "@/lib/format";
import { whatsappUrl } from "@/lib/whatsapp";

export const metadata: Metadata = { title: "¡Pedido listo!", robots: { index: false, follow: false } };

async function Confirmation({ params }: { params: PageProps<"/pedido/[token]">["params"] }) {
  const { token } = await params;
  if (!/^[A-Za-z0-9_-]{16,40}$/.test(token)) notFound();
  const [order, settings] = await Promise.all([db.query.orders.findFirst({ where: eq(orders.publicToken, token) }), getSettings()]);
  if (!order) notFound();
  const url = whatsappUrl(settings.whatsappNumber, order.whatsappMessage);
  const qr = await QRCode.toString(url, { type: "svg", margin: 0, errorCorrectionLevel: "L", color: { dark: "#000000", light: "#ffffff" } });
  const label = formatOrderNumber(order.number);
  return (
    <div className="mx-auto max-w-[1000px] px-4 pb-24 pt-12 sm:px-8 sm:pt-16">
      <p className="label text-mute">Pedido {label}</p>
      <h1 className="mt-3 text-[22px] font-light uppercase leading-tight tracking-[0.08em] sm:text-[28px]">¡Listo!</h1>
      <p className="mt-3 max-w-xl text-[14px] leading-relaxed">
        Registramos tu pedido. Mandanos el mensaje por WhatsApp y te respondemos para confirmar stock, pago y entrega.{" "}
        <strong className="font-medium">Si WhatsApp no se abrió, tocá acá:</strong>
      </p>
      <div className="mt-6 max-w-xl">
        <OrderActions whatsappUrl={url} message={order.whatsappMessage} />
      </div>

      <div className="mt-12 grid gap-10 lg:grid-cols-[1fr_260px]">
        <section aria-label="Mensaje del pedido">
          <p className="label text-mute">Tu mensaje</p>
          <pre className="mt-3 whitespace-pre-wrap border border-line bg-soft/50 p-5 font-sans text-[13px] leading-relaxed" data-testid="order-message">
            {order.whatsappMessage}
          </pre>
          <dl className="mt-4 grid grid-cols-2 gap-2 text-[13px] sm:max-w-sm">
            <dt className="text-mute">Subtotal</dt>
            <dd className="text-right tabular-nums">{formatPrice(order.subtotal)}</dd>
            {order.discountPercent > 0 ? (
              <>
                <dt className="text-mute">Efectivo/transferencia</dt>
                <dd className="text-right tabular-nums">{formatPrice(order.cashTotal)}</dd>
              </>
            ) : null}
          </dl>
        </section>
        <aside className="hidden lg:block" aria-label="Seguir desde el celular">
          <p className="label text-mute">Seguí desde tu celular</p>
          <div className="mt-3 border border-line p-5" aria-hidden dangerouslySetInnerHTML={{ __html: qr }} />
          <p className="mt-3 text-[12px] text-mute">Escaneá el código con la cámara y se abre WhatsApp con tu pedido.</p>
        </aside>
      </div>

      <Link href="/productos" className="btn btn-secondary mt-12">
        Seguir viendo
      </Link>
    </div>
  );
}

export default function OrderPage({ params }: PageProps<"/pedido/[token]">) {
  return (
    <Suspense fallback={<div className="min-h-[60vh]" aria-busy />}>
      <Confirmation params={params} />
    </Suspense>
  );
}
