import Link from "next/link";
import { InstagramIcon, WhatsAppIcon } from "@/components/icons";
import { getCategories, getSettings } from "@/lib/catalog";
import { whatsappUrl } from "@/lib/whatsapp";

function formatPhone(number: string): string {
  // 5493412550777 → +54 9 341 255-0777
  const m = number.match(/^54(9)(\d{3})(\d{3})(\d{4})$/);
  return m ? `+54 ${m[1]} ${m[2]} ${m[3]}-${m[4]}` : `+${number}`;
}

export async function Footer() {
  const [settings, categories] = await Promise.all([getSettings(), getCategories()]);
  const visibleCats = categories.filter((c) => c.productCount > 0);
  const wa = whatsappUrl(settings.whatsappNumber, "Hola INEDITA! Tengo una consulta.");
  return (
    <footer className="mt-24 border-t border-line">
      <div className="mx-auto grid max-w-[1600px] gap-10 px-5 py-14 sm:px-8 md:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-4">
          <p className="pl-[0.32em] text-[15px] font-semibold tracking-[0.32em]">INEDITA</p>
          <address className="space-y-1 text-[13px] not-italic leading-relaxed">
            <p>{settings.address}</p>
            {settings.storeHours.map((h) => (
              <p key={h.days} className="text-mute">
                {h.days}: {h.hours}
              </p>
            ))}
          </address>
          <div className="flex flex-col gap-2 text-[13px]">
            <a href={wa} target="_blank" rel="noopener" className="inline-flex items-center gap-2">
              <WhatsAppIcon size={16} /> {formatPhone(settings.whatsappNumber)}
            </a>
            <a href={`https://instagram.com/${settings.instagram}`} target="_blank" rel="noopener" className="inline-flex items-center gap-2">
              <InstagramIcon size={16} /> @{settings.instagram}
            </a>
          </div>
        </div>
        <nav aria-label="Categorías">
          <p className="label font-medium">Categorías</p>
          <ul className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-[13px]">
            {visibleCats.map((c) => (
              <li key={c.slug}>
                <Link href={`/categoria/${c.slug}`} className="link-underline">
                  {c.name}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <nav aria-label="Ayuda">
          <p className="label font-medium">Ayuda</p>
          <ul className="mt-4 space-y-2 text-[13px]">
            <li>
              <Link href="/preguntas-frecuentes" className="link-underline">
                Preguntas frecuentes
              </Link>
            </li>
            <li>
              <Link href="/envios" className="link-underline">
                Envíos
              </Link>
            </li>
            <li>
              <Link href="/cambios-y-devoluciones" className="link-underline">
                Cambios y devoluciones
              </Link>
            </li>
            <li>
              <Link href="/guia-de-talles" className="link-underline">
                Guía de talles
              </Link>
            </li>
            <li>
              <Link href="/contacto" className="link-underline">
                Contacto
              </Link>
            </li>
          </ul>
        </nav>
        <div className="space-y-4">
          <p className="label font-medium">Legales</p>
          <Link href="/arrepentimiento" className="btn btn-secondary w-full sm:w-auto" data-testid="withdrawal-button">
            Botón de arrepentimiento
          </Link>
          <ul className="space-y-2 text-[12px] text-mute">
            <li>
              <a
                href="https://www.argentina.gob.ar/produccion/defensadelconsumidor/formulario"
                target="_blank"
                rel="noopener"
                className="underline underline-offset-4 hover:text-ink"
              >
                Defensa de las y los consumidores. Para reclamos ingresá acá.
              </a>
            </li>
            <li>CUIT {settings.cuit}</li>
            <li>Rosario, Santa Fe, Argentina</li>
          </ul>
        </div>
      </div>
      <div className="border-t border-line">
        <p className="mx-auto max-w-[1600px] px-5 py-5 text-[11px] text-mute sm:px-8">© INEDITA. Precios en pesos argentinos.</p>
      </div>
    </footer>
  );
}
