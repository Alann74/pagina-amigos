"use client";

import { usePathname } from "next/navigation";
import { WhatsAppIcon } from "@/components/icons";
import { useShopConfig } from "@/components/shop-config";
import { trackContactWhatsapp } from "@/lib/analytics";
import { whatsappUrl } from "@/lib/whatsapp";

export function WhatsAppFloat() {
  const pathname = usePathname();
  const { whatsappNumber, siteUrl } = useShopConfig();
  if (pathname.startsWith("/carrito") || pathname.startsWith("/pedido")) return null;
  const onProduct = pathname.startsWith("/producto/");
  const text = onProduct ? `Hola INEDITA! Tengo una consulta sobre ${siteUrl}${pathname}` : "Hola INEDITA! Tengo una consulta.";
  return (
    <a
      href={whatsappUrl(whatsappNumber, text)}
      target="_blank"
      rel="noopener"
      onClick={() => trackContactWhatsapp("flotante")}
      aria-label="Escribinos por WhatsApp"
      className={`fixed bottom-[calc(1.25rem+env(safe-area-inset-bottom))] right-4 z-30 h-12 w-12 items-center justify-center rounded-full bg-ink text-paper transition-transform duration-200 hover:scale-105 sm:bottom-6 sm:right-6 ${
        onProduct ? "hidden lg:flex" : "flex"
      }`}
      data-testid="whatsapp-float"
    >
      <WhatsAppIcon size={22} />
    </a>
  );
}
