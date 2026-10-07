import { getFeedItems } from "@/lib/feed";
import { absoluteUrl, BRAND } from "@/lib/site";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// Feed RSS 2.0 con el namespace de Google (formato que acepta el Administrador de catálogos de Meta).
export async function GET() {
  const items = await getFeedItems();
  const body = items
    .map((i) => {
      const fields = [
        `<g:id>${esc(i.id)}</g:id>`,
        `<g:item_group_id>${esc(i.item_group_id)}</g:item_group_id>`,
        `<g:title>${esc(i.title)}</g:title>`,
        `<g:description>${esc(i.description)}</g:description>`,
        `<g:availability>${i.availability}</g:availability>`,
        `<g:condition>${i.condition}</g:condition>`,
        `<g:price>${i.price}</g:price>`,
        `<g:link>${esc(i.link)}</g:link>`,
        `<g:image_link>${esc(i.image_link)}</g:image_link>`,
        ...i.additional_image_link.map((u) => `<g:additional_image_link>${esc(u)}</g:additional_image_link>`),
        `<g:brand>${esc(i.brand)}</g:brand>`,
        i.color ? `<g:color>${esc(i.color)}</g:color>` : "",
        `<g:size>${esc(i.size)}</g:size>`,
        `<g:gender>${i.gender}</g:gender>`,
        `<g:age_group>${i.age_group}</g:age_group>`,
        `<g:google_product_category>${esc(i.google_product_category)}</g:google_product_category>`,
        `<g:product_type>${esc(i.product_type)}</g:product_type>`,
        i.custom_label_0 ? `<g:custom_label_0>${esc(i.custom_label_0)}</g:custom_label_0>` : "",
      ].filter(Boolean);
      return `<item>${fields.join("")}</item>`;
    })
    .join("\n");
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
<channel>
<title>${BRAND}</title>
<link>${absoluteUrl("/")}</link>
<description>Catálogo de ${BRAND}</description>
${body}
</channel>
</rss>`;
  return new Response(xml, { headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400" } });
}
