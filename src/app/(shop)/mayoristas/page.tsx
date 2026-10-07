import type { Metadata } from "next";
import { WholesaleLogin } from "@/components/wholesale-login";
import { getSettings } from "@/lib/catalog";
import { whatsappUrl } from "@/lib/whatsapp";

export const metadata: Metadata = {
  title: "Mayoristas",
  description: "Acceso para clientes mayoristas de INEDITA.",
  alternates: { canonical: "/mayoristas" },
  robots: { index: false, follow: false },
};

export default async function WholesalePage() {
  const settings = await getSettings();
  const contact = whatsappUrl(settings.whatsappNumber, "Hola INEDITA! Quiero comprar por mayor. ¿Me pasan el código de acceso?");
  return (
    <div className="mx-auto flex min-h-[62vh] max-w-[480px] flex-col justify-center px-5 py-16 sm:py-24">
      <p className="label text-mute">INEDITA · Por mayor</p>
      <h1 className="mt-3 text-[26px] font-light leading-tight sm:text-[30px]">Acceso mayoristas</h1>
      <p className="mt-3 text-[14px] leading-relaxed text-mute">Ingresá tu código para ver la tienda con los precios por mayor y armar tu pedido por WhatsApp.</p>
      <WholesaleLogin contactHref={contact} />
    </div>
  );
}
