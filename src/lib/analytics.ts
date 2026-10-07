"use client";

type Fbq = (...args: unknown[]) => void;
type Gtag = (...args: unknown[]) => void;

declare global {
  interface Window {
    fbq?: Fbq;
    gtag?: Gtag;
  }
}

export type TrackItem = { id: string; name: string; price: number; quantity?: number; category?: string | null };

function toGa(items: TrackItem[]) {
  return items.map((i) => ({ item_id: i.id, item_name: i.name, price: i.price, quantity: i.quantity ?? 1, item_category: i.category ?? undefined }));
}

export function trackViewProduct(item: TrackItem) {
  try {
    window.fbq?.("track", "ViewContent", { content_ids: [item.id], content_type: "product", content_name: item.name, value: item.price, currency: "ARS" });
    window.gtag?.("event", "view_item", { currency: "ARS", value: item.price, items: toGa([item]) });
  } catch {}
}

export function trackAddToCart(item: TrackItem) {
  try {
    const value = item.price * (item.quantity ?? 1);
    window.fbq?.("track", "AddToCart", { content_ids: [item.id], content_type: "product", content_name: item.name, value, currency: "ARS" });
    window.gtag?.("event", "add_to_cart", { currency: "ARS", value, items: toGa([item]) });
  } catch {}
}

export function trackWhatsappOrder(orderLabel: string, value: number, items: TrackItem[]) {
  try {
    const ids = items.map((i) => i.id);
    // "Purchase" no corresponde (no hay pago online): usamos Lead/Contact + evento propio
    window.fbq?.("track", "Lead", { content_ids: ids, content_type: "product", value, currency: "ARS" });
    window.fbq?.("trackCustom", "PedidoWhatsApp", { order: orderLabel, value, currency: "ARS", num_items: items.length });
    window.gtag?.("event", "generate_lead", { currency: "ARS", value, transaction_id: orderLabel, items: toGa(items) });
    window.gtag?.("event", "pedido_whatsapp", { currency: "ARS", value, transaction_id: orderLabel });
  } catch {}
}

export function trackContactWhatsapp(context: string) {
  try {
    window.fbq?.("track", "Contact", { content_name: context });
    window.gtag?.("event", "contacto_whatsapp", { context });
  } catch {}
}

export function trackWelcomeSignup(percent: number) {
  try {
    window.fbq?.("track", "CompleteRegistration", { content_name: "bienvenida", value: percent, currency: "ARS" });
    window.gtag?.("event", "sign_up", { method: "popup_bienvenida" });
  } catch {}
}
