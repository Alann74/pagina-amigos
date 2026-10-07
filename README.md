# INEDITA — tienda online

Tienda de INEDITA (ropa de mujer, Mitre 830, Rosario). Catálogo con precios, bolsa de compras y **pedido por WhatsApp**: el pedido se guarda en la base con número correlativo (`#INE-0001`) y el origen del tráfico, y se abre WhatsApp con el mensaje armado. No hay pasarela de pago: el pago y la entrega se coordinan por WhatsApp.

- **Tienda**: home, listados con filtros, búsqueda, ficha de producto, favoritos, bolsa, confirmación del pedido, páginas de ayuda y botón de arrepentimiento.
- **Admin** (`/admin`): pedidos, productos, stock, precios (uno por uno, en tabla o aumento masivo por %), CSV, fotos, textos, portada, categorías y configuración.
- **Marketing**: Meta Pixel y GA4 (opcionales), Vercel Analytics, feed de catálogo para Meta en `/feed/meta.xml` y `/feed/meta.csv`, sitemap y Open Graph con la foto de cada producto.

## Tecnología

Next.js 16 (App Router) · TypeScript · Tailwind CSS 4 · Postgres en Neon con Drizzle ORM · fotos en Vercel Blob (WebP en 3 tamaños, procesadas con sharp) · bolsa y favoritos en el navegador (Zustand) · tests con Playwright.

## Variables de entorno

| Variable | Obligatoria | Para qué |
|---|---|---|
| `DATABASE_URL` | Sí | Conexión a Postgres (Neon). En Vercel la completa la integración de Neon. |
| `ADMIN_PASSWORD` | Sí | Contraseña del panel `/admin`. |
| `BLOB_READ_WRITE_TOKEN` | En producción | Guardar fotos en Vercel Blob. Lo completa Vercel al conectar Blob. Sin él (en local) las fotos van a `public/uploads`. |
| `ADMIN_SESSION_SECRET` | No | Texto largo al azar para firmar la sesión del admin. |
| `MAINTENANCE_TOKEN` | No | Clave para disparar la importación automática de fotos (`/api/maintenance/import-photos`). |
| `NEXT_PUBLIC_SITE_URL` | No | Dirección pública del sitio. En Vercel se toma sola; definila al pasar al dominio propio. |
| `NEXT_PUBLIC_META_PIXEL_ID` | No | Meta Pixel. Si está vacía no se carga. |
| `NEXT_PUBLIC_GA4_ID` | No | Google Analytics 4 (`G-XXXX`). Si está vacía no se carga. |

Copiá `.env.example` a `.env.local` y completalo.

## Correr en la computadora

Necesitás Node 20+ y un Postgres (local o un branch de Neon).

```bash
npm install
cp .env.example .env.local      # completar DATABASE_URL y ADMIN_PASSWORD
npm run db:migrate              # crea las tablas
npm run db:seed                 # carga el catálogo del POS (data/pos-productos.csv)
npm run dev                     # http://localhost:3000  ·  admin: http://localhost:3000/admin
```

Otros comandos: `npm run build` · `npm run lint` · `npm run typecheck` · `npm run test:unit` · `npm run test:e2e` (con la web corriendo en `npm run build && npm start`).

## Publicar en Vercel (primera vez)

1. En Vercel: **Add New → Project** e importar este repositorio de GitHub (rama `main`).
2. Antes de tocar **Deploy**, en **Environment Variables** cargar `DATABASE_URL`, `ADMIN_PASSWORD`, `ADMIN_SESSION_SECRET` y `MAINTENANCE_TOKEN` (se puede pegar un bloque `.env` entero). Si no hay base todavía: **Storage → Create → Neon** (región *São Paulo, sa-east-1*) crea `DATABASE_URL`.
3. **Deploy**. En el build se crean las tablas y, si la base está vacía, se cargan los 182 productos del POS (`npm run vercel-build`). Las funciones corren en São Paulo, junto a la base.
4. **Storage → Create → Blob → Connect** al proyecto (crea `BLOB_READ_WRITE_TOKEN`) y después **Deployments → Redeploy** para que tome la variable.
5. Fotos: en `/admin` → **Fotos** → **Importar fotos pendientes**, o abrir una vez `https://<proyecto>.vercel.app/api/maintenance/import-photos?token=<MAINTENANCE_TOKEN>`: importa todas las fotos de Drive en segundo plano (unos minutos) y, si no se eligieron, pone fotos de campaña en la portada y en “Comprá el look”. Agregando `&estado=1` muestra el avance.
6. Revisar en `/admin` → **Instalación** que todo esté tildado, y los textos marcados como **BORRADOR** en **Configuración → Textos**.

> El dominio `inedita-rosario.com` sigue en Tienda Nube. El cambio de dominio se hace aparte, cuando se apruebe: en Vercel **Settings → Domains** y después definir `NEXT_PUBLIC_SITE_URL`.
>
> El plan Hobby de Vercel es gratis pero sus términos lo limitan a uso no comercial; para la tienda en producción corresponde el plan Pro.

## Cómo se usa el admin

- **Precios**: en la ficha de cada producto, en **Precios** (tabla rápida: cambiás y tocás Guardar) o con **Aumento masivo** (porcentaje para todos, una categoría o los seleccionados, con redondeo a la centena o al mil y vista previa antes de aplicar). Los cambios se ven en la tienda al instante.
- **Fotos**: en la ficha del producto → **Subir fotos** (desde el celular también). La primera es la principal y la segunda aparece al pasar el mouse; se ordenan con las flechas y se puede asignar cada foto a un color. Un producto sin fotos no se muestra.
- **Stock**: en la ficha, tabla por color y talle. Vacío = sin control (se vende como disponible); 0 = sin stock. Con 2 o menos aparece “ÚLTIMAS UNIDADES”.
- **Nuevos ingresos**: botón **Marcar como nuevo** (ficha o lista de productos): muestra la etiqueta NUEVO durante 15 días (configurable).
- **Pedidos**: lista con estado (Nuevo / Confirmado / Entregado / Cancelado), filtro por fecha, total del período, lo más pedido y de dónde vinieron (Instagram, Google, campañas con UTM). Desde cada pedido se le escribe a la clienta por WhatsApp.
- **CSV**: exportás el listado (una fila por artículo + color + talle), lo editás en Excel o Google Sheets y lo importás: antes de aplicar se ven todos los cambios.
- **Configuración**: número de WhatsApp, barra de anuncios, portada, % de descuento, cuotas, envío gratis desde, horarios, textos, categorías destacadas y “Comprá el look”.

## Datos y sistema del local (POS)

El catálogo inicial sale del sistema del local (`data/pos-productos.csv`) y las fotos de Drive se cruzan por el número de artículo de 5 dígitos del nombre del archivo (`scripts/match-photos.mjs` → `data/photo-matches.json`, con el reporte en `data/REPORTE-FOTOS.md`). El modelo de datos está listo para que el POS sea la fuente de verdad más adelante: los SKU tienen el mismo formato (`39603-NEGRO-M`), cada variante tiene `label_code` para el código de la etiqueta física (`39603%DMS`) y los productos y variantes guardan el id del POS.

## Estructura

```
src/app/(shop)      tienda (home, listados, ficha, bolsa, pedido, ayuda)
src/app/admin       panel de administración
src/app/api         pedidos, búsqueda, arrepentimiento y rutas del admin
src/app/feed        feed de catálogo para Meta
src/components      componentes de la tienda y del admin
src/lib             catálogo, pedidos, WhatsApp, imágenes, Drive, precios
src/db              esquema de la base (Drizzle) · drizzle/ migraciones
scripts             migraciones, carga del catálogo y cruce de fotos
tests               tests unitarios y end-to-end (Playwright: celular, navegador de Instagram y escritorio)
```
