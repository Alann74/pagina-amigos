import { Suspense } from "react";
import { AnnouncementBar } from "@/components/layout/announcement-bar";
import { MarketingScripts } from "@/components/marketing-scripts";
import { RevealOnScroll } from "@/components/reveal";
import { Footer } from "@/components/layout/footer";
import { Header } from "@/components/layout/header";
import { MenuDrawer } from "@/components/layout/menu-drawer";
import { SearchOverlay } from "@/components/layout/search-overlay";
import { WhatsAppFloat } from "@/components/layout/whatsapp-float";
import { CartDrawer } from "@/components/cart/cart-drawer";
import { ShopProviders } from "@/components/providers";
import { ShopConfigProvider } from "@/components/shop-config";
import { WelcomePopup } from "@/components/welcome-popup";
import { WholesaleBar, WholesaleProvider } from "@/components/wholesale";
import { getCategories, getSettings } from "@/lib/catalog";
import { SITE_URL } from "@/lib/site";
import { whatsappUrl } from "@/lib/whatsapp";

export default async function ShopLayout({ children }: LayoutProps<"/">) {
  const [settings, categories] = await Promise.all([getSettings(), getCategories()]);
  const menuCategories = categories.filter((c) => c.productCount > 0).map((c) => ({ slug: c.slug, name: c.name }));
  // Escritorio: accesos directos en el header (las categorías destacadas en el admin)
  const featured = categories.filter((c) => c.featured && c.productCount > 0);
  const headerLinks = [{ href: "/productos?orden=nuevos", label: "Nuevo" }, ...(featured.length ? featured : categories.filter((c) => c.productCount > 0)).slice(0, 5).map((c) => ({ href: `/categoria/${c.slug}`, label: c.name }))];
  const config = {
    whatsappNumber: settings.whatsappNumber,
    cashDiscountPercent: settings.promo.cashDiscountPercent,
    installments: settings.promo.installments,
    freeShippingThreshold: settings.freeShippingThreshold,
    storeAddressShort: settings.address.split(",")[0] ?? settings.address,
    siteUrl: SITE_URL,
    welcome: settings.welcome,
  };
  return (
    <ShopConfigProvider value={config}>
      <WholesaleProvider>
        <a href="#contenido" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:bg-paper focus:px-4 focus:py-2">
          Saltar al contenido
        </a>
        <WholesaleBar />
        <AnnouncementBar />
        <Header links={headerLinks} />
        <main id="contenido" className="min-h-[60vh]">
          {children}
        </main>
        <Footer />
        <RevealOnScroll />
        {/* Google Analytics y Meta Pixel: solo en la tienda (el panel no se mide) */}
        <MarketingScripts />
        <Suspense>
          <ShopProviders />
        </Suspense>
        <MenuDrawer categories={menuCategories} whatsappHref={whatsappUrl(settings.whatsappNumber, "Hola INEDITA! Tengo una consulta.")} instagram={settings.instagram} />
        <SearchOverlay />
        <CartDrawer />
        <Suspense>
          <WelcomePopup />
        </Suspense>
        <Suspense>
          <WhatsAppFloat />
        </Suspense>
      </WholesaleProvider>
    </ShopConfigProvider>
  );
}
