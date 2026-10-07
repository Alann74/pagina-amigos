import type { Metadata } from "next";
import { InstagramIcon, WhatsAppIcon } from "@/components/icons";
import { getPages, getSettings } from "@/lib/catalog";
import { Markdown } from "@/lib/markdown";
import { whatsappUrl } from "@/lib/whatsapp";

export const metadata: Metadata = {
  title: "Contacto",
  description: "Visitanos en Mitre 830, Rosario, o escribinos por WhatsApp. Horarios del local de INEDITA.",
  alternates: { canonical: "/contacto" },
};

export default async function ContactPage() {
  const [settings, pages] = await Promise.all([getSettings(), getPages()]);
  const mapSrc = `https://maps.google.com/maps?q=${encodeURIComponent(settings.mapsQuery)}&z=16&output=embed`;
  return (
    <div className="mx-auto max-w-[1200px] px-5 pb-16 pt-10 sm:px-8 sm:pt-16">
      <h1 className="text-[13px] font-medium uppercase tracking-[0.24em] sm:text-sm">{pages.contacto.title}</h1>
      <div className="mt-8 grid gap-12 lg:grid-cols-[1fr_1.4fr]">
        <div className="space-y-8">
          <Markdown source={pages.contacto.body} />
          <div>
            <p className="label font-medium">Local</p>
            <p className="mt-2 text-[15px]">{settings.address}</p>
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(settings.mapsQuery)}`}
              target="_blank"
              rel="noopener"
              className="mt-1 inline-block text-[13px] underline underline-offset-4"
            >
              Cómo llegar
            </a>
          </div>
          <div>
            <p className="label font-medium">Horarios</p>
            <dl className="mt-2 space-y-1 text-[14px]">
              {settings.storeHours.map((h) => (
                <div key={h.days} className="flex justify-between gap-6 border-b border-line py-2">
                  <dt>{h.days}</dt>
                  <dd className="text-mute">{h.hours}</dd>
                </div>
              ))}
            </dl>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <a href={whatsappUrl(settings.whatsappNumber, "Hola INEDITA! Tengo una consulta.")} target="_blank" rel="noopener" className="btn btn-primary">
              <WhatsAppIcon size={16} /> Escribinos por WhatsApp
            </a>
            <a href={`https://instagram.com/${settings.instagram}`} target="_blank" rel="noopener" className="btn btn-secondary">
              <InstagramIcon size={16} /> @{settings.instagram}
            </a>
          </div>
        </div>
        <div className="relative aspect-[4/3] w-full overflow-hidden bg-soft lg:aspect-auto lg:min-h-[480px]">
          <iframe
            title={`Mapa: ${settings.address}`}
            src={mapSrc}
            className="absolute inset-0 h-full w-full grayscale"
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
          />
        </div>
      </div>
    </div>
  );
}
