import { getCatalog, getSettings } from "@/lib/catalog";
import { cashPrice, displayColor, displaySize, formatPrice } from "@/lib/format";
import { shareImageUrl } from "@/lib/share-image";
import { absoluteUrl, BRAND } from "@/lib/site";

// Catálogo para Meta (Facebook / Instagram Shopping y anuncios dinámicos): una fila por variante,
// agrupadas por artículo con item_group_id.

export type FeedItem = {
  id: string;
  item_group_id: string;
  title: string;
  description: string;
  availability: "in stock" | "out of stock";
  condition: "new";
  price: string;
  link: string;
  image_link: string;
  additional_image_link: string[];
  brand: string;
  color: string;
  size: string;
  gender: "female";
  age_group: "adult";
  google_product_category: string;
  product_type: string;
  custom_label_0: string;
};

const BAGS = /cartera|bolso|accesorio/i;

export async function getFeedItems(): Promise<FeedItem[]> {
  const [catalog, settings] = await Promise.all([getCatalog(), getSettings()]);
  const discount = settings.promo.cashDiscountPercent;
  const items: FeedItem[] = [];
  for (const p of catalog) {
    if (!p.images.length) continue;
    const group = p.articleCode ?? `P${p.id}`;
    const link = absoluteUrl(`/producto/${p.slug}`);
    const baseDescription =
      p.description.trim() ||
      `${p.name} de ${BRAND}. ${p.sizes.length ? `Talles: ${p.sizes.map(displaySize).join(", ")}. ` : ""}${discount ? `${formatPrice(cashPrice(p.price, discount))} con ${discount}% OFF en efectivo o transferencia. ` : ""}Pedilo por WhatsApp.`;
    for (const v of p.variants) {
      const colorImages = v.color ? p.images.filter((i) => i.color === v.color) : [];
      const images = [...colorImages, ...p.images.filter((i) => !colorImages.includes(i))].map((i) => absoluteUrl(shareImageUrl(i.url)));
      items.push({
        id: v.sku,
        item_group_id: group,
        title: p.name,
        description: baseDescription.slice(0, 5000),
        availability: v.available ? "in stock" : "out of stock",
        condition: "new",
        price: `${v.price.toFixed(2)} ARS`,
        link,
        image_link: images[0],
        additional_image_link: images.slice(1, 10),
        brand: BRAND,
        color: v.color ? displayColor(v.color) : "",
        size: displaySize(v.size),
        gender: "female",
        age_group: "adult",
        google_product_category: BAGS.test(p.categoryName ?? "") ? "Apparel & Accessories > Handbags, Wallets & Cases" : "Apparel & Accessories > Clothing",
        product_type: p.categoryName ?? "Ropa",
        custom_label_0: p.badge === "nuevo" ? "nuevo" : "",
      });
    }
  }
  return items;
}
