import type { Metadata } from "next";
import { WholesaleLogin } from "@/components/wholesale-login";
import { getSettings } from "@/lib/catalog";

export const metadata: Metadata = {
  title: "Mayoristas",
  description: "Registro y acceso para clientes mayoristas de INEDITA.",
  alternates: { canonical: "/mayoristas" },
  robots: { index: false, follow: false },
};

export default async function WholesalePage() {
  const settings = await getSettings();
  return (
    <div className="mx-auto flex min-h-[62vh] max-w-[560px] flex-col justify-center px-5 py-16 sm:py-24">
      <p className="label text-mute">INEDITA · Por mayor</p>
      <h1 className="mt-3 text-[26px] font-light leading-tight sm:text-[30px]">Mayoristas</h1>
      <p className="mt-3 text-[14px] leading-relaxed text-mute">
        Registrate con los datos de tu negocio. Cuando te aprobamos, entrás a la misma tienda con los precios por mayor y armás tu pedido por WhatsApp.
      </p>
      <WholesaleLogin whatsappNumber={settings.whatsappNumber} />
    </div>
  );
}
