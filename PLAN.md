# INEDITA — Plan de la web

## Contexto y decisiones tomadas

- **Fuente de productos**: la red de esta sesión bloquea `inedita-rosario.com` (Tienda Nube), así que no pude scrapearla.
  Usé tu **POS en Neon (`inedita-pos`)**, que ya tiene 182 productos, 2.598 variantes (talle × color), precios y SKU.
  Como el POS va a ser la fuente de verdad, el modelo de la web queda alineado desde el día 1.
  CSV intermedio: `data/pos-productos.csv`. Faltan descripciones (el POS no las tiene): quedan vacías para cargar desde el admin.
- **Fotos**: listé la carpeta de Drive `FOTOS DE CAPSULAS LIMPIAS/TODAS` (851 archivos) y las crucé por código de artículo.
  178 de 180 artículos tienen foto. Reporte: `data/REPORTE-FOTOS.md`. La importación a Vercel Blob la hace el
  propio servidor desde `/admin/fotos` (descarga de Drive → WebP 1200×1600 → Blob), porque desde esta sesión no hay acceso directo.
- **Referencias** (COS, Arket, Zara, Frankie Shop, Toteme, Massimo Dutti): bloqueadas por la red de la sesión; tomé los patrones que ya conozco de esas tiendas.

## Estructura

```
/                         Home: anuncio, hero, categorías destacadas, nuevos ingresos, lo más pedido, comprá el look
/productos                Todo el catálogo (filtros talle/color/precio, orden, grilla 1/2/4)
/categoria/[slug]         Listado por categoría
/producto/[slug]          Ficha: galería swipe/zoom, talle+color, sticky "AGREGAR AL CARRITO", WhatsApp, avisame, guía de talles
/buscar                   Resultados (el buscador del header muestra resultados en vivo)
/favoritos                Favoritos (localStorage) + "Consultar todos por WhatsApp"
/carrito                  Carrito + formulario + "ENVIAR PEDIDO POR WHATSAPP" (también drawer lateral)
/pedido/[numero]          Confirmación: abrir WhatsApp de nuevo, copiar mensaje, QR en desktop
/contacto /preguntas-frecuentes /cambios-y-devoluciones /envios /guia-de-talles /arrepentimiento
/admin                    Panel: productos, precios, aumento masivo, CSV, fotos, pedidos, settings
/feed/meta.xml            Feed de catálogo para Meta (Instagram Shopping / anuncios)
/sitemap.xml /robots.txt  SEO
```

## Modelo de datos (Neon Postgres + Drizzle)

| Tabla | Campos clave |
|---|---|
| `categories` | slug, nombre, orden, visible, destacada, imagen, guía de talles |
| `colors` | nombre canónico, slug, `brand_code` (sufijo de etiqueta, ej. `BC`) |
| `products` | slug, **`article_code`** (5 dígitos, único), nombre, descripción, categoría, precio, visible, destacado, `pos_product_id` |
| `product_images` | producto, url Blob, alt, color (opcional), orden, `drive_file_id` |
| `variants` | producto, color, talle, orden de talle, **`sku`** (`39603-NEGRO-M`, igual al POS), **`label_code`** (etiqueta `39603%DMS`), stock (vacío = sin control), precio propio opcional, `pos_variant_id` |
| `orders` | **número correlativo** (`#INE-0001`), estado, cliente, entrega, pago, comentario, totales, **UTMs + referrer + landing**, mensaje de WhatsApp |
| `order_items` | snapshot de artículo, nombre, talle, color, SKU, cantidad, precio |
| `settings` | clave/valor JSON: WhatsApp, anuncio, hero, promo, horarios, envío gratis, textos de páginas, "comprá el look" |
| `withdrawal_requests` | botón de arrepentimiento (código `#ARR-0001`) |

Integración futura con el POS: se sincroniza por `article_code` (producto) y `sku` / `label_code` (variante). Los IDs del POS quedan guardados (`pos_product_id`, `pos_variant_id`).

## Dirección visual

- Blanco y negro estricto. Gris solo para bordes (#E5E5E5), textos secundarios (#6B6B6B) y estados. Las fotos son el único color.
- **Inter Tight** (Google Fonts). Navegación y títulos en mayúsculas, 11–12 px, tracking 0.16–0.3 em. Logo: wordmark INEDITA.
- Sin sombras ni bordes redondeados. Mucho aire. Grilla 2 columnas en mobile (opción 1), 4 en desktop, foto 3:4 con segunda foto al hover.
- Colores como texto (no swatches de color) para respetar la paleta.
- Animaciones cortas (fade/slide 200–300 ms), respetando `prefers-reduced-motion`.
- Mobile-first, probado en 375 px. Botón de WhatsApp flotante negro.

## Etapas

1. Base + diseño → 2. Catálogo → 3. Ficha → 4. Carrito + WhatsApp + pedidos → 5. Admin → 6. Datos y fotos → 7. Marketing/SEO → 8. Tests, auditoría y deploy (`*.vercel.app`, sin tocar `inedita-rosario.com`).
