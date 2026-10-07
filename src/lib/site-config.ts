// Configuración editable desde /admin/configuracion. Estos son los valores por defecto:
// si en la base no hay nada guardado, la web usa esto.

export type StoreHours = { days: string; hours: string }[];

export type SiteSettings = {
  whatsappNumber: string; // formato internacional sin "+", ej. 5493412550777
  announcement: { enabled: boolean; text: string; href: string | null };
  hero: {
    imageUrl: string | null;
    secondaryImageUrl: string | null; // escritorio: si está, la portada se arma con dos fotos verticales
    mobileImageUrl: string | null;
    videoUrl: string | null;
    eyebrow: string;
    title: string;
    ctaLabel: string;
    ctaHref: string;
  };
  promo: {
    cashDiscountPercent: number; // 10 → 10% OFF efectivo / transferencia
    installments: number; // 3 cuotas sin interés
  };
  // Pop-up de bienvenida: mail + WhatsApp a cambio de un % OFF en la primera compra (efectivo/transferencia)
  welcome: { enabled: boolean; percent: number; title: string; text: string; delaySeconds: number };
  freeShippingThreshold: number | null; // null = no se muestra la barra
  lowStockThreshold: number; // stock <= este número → ÚLTIMAS UNIDADES
  newProductDays: number; // días para la etiqueta NUEVO
  storeHours: StoreHours;
  address: string;
  mapsQuery: string;
  instagram: string;
  cuit: string;
  businessName: string;
};

export const DEFAULT_SETTINGS: SiteSettings = {
  whatsappNumber: "5493412550777",
  announcement: {
    enabled: true,
    text: "10% OFF EN EFECTIVO / TRANSFERENCIA · 3 CUOTAS SIN INTERÉS · ENVÍOS A TODO EL PAÍS · RETIRÁ EN MITRE 830, ROSARIO",
    href: null,
  },
  hero: {
    imageUrl: null,
    secondaryImageUrl: null,
    mobileImageUrl: null,
    videoUrl: null,
    eyebrow: "Temporada 3",
    title: "Nueva colección",
    ctaLabel: "VER COLECCIÓN",
    ctaHref: "/productos",
  },
  promo: { cashDiscountPercent: 10, installments: 3 },
  welcome: {
    enabled: true,
    percent: 20,
    title: "20% OFF en tu primera compra",
    text: "Dejanos tu mail y tu WhatsApp y recibí un 20% OFF pagando en efectivo o transferencia.",
    delaySeconds: 8,
  },
  freeShippingThreshold: null,
  lowStockThreshold: 2,
  newProductDays: 15,
  storeHours: [
    { days: "Lunes a sábados", hours: "10 a 19 hs" },
    { days: "Domingos y feriados", hours: "Cerrado" },
  ],
  address: "Mitre 830, Rosario, Santa Fe",
  mapsQuery: "Mitre 830, Rosario, Santa Fe, Argentina",
  instagram: "ineditarosario",
  cuit: "27223006340",
  businessName: "INEDITA",
};

export type LookSettings = {
  enabled: boolean;
  title: string;
  imageUrl: string | null;
  productIds: number[];
};

export const DEFAULT_LOOK: LookSettings = {
  enabled: true,
  title: "Comprá el look",
  imageUrl: null,
  productIds: [],
};

export type PageKey = "faq" | "cambios" | "envios" | "talles" | "contacto";

export type PagesContent = Record<PageKey, { title: string; body: string; draft: boolean }>;

// Borradores marcados con draft: true. En el admin se ven con la marca "BORRADOR — REVISAR".
export const DEFAULT_PAGES: PagesContent = {
  faq: {
    title: "Preguntas frecuentes",
    draft: true,
    body: `## ¿Cómo compro?
Elegí tus prendas, agregalas al carrito y tocá **Enviar pedido por WhatsApp**. Te llega el pedido armado a nuestro WhatsApp y te respondemos para confirmar stock, forma de pago y entrega.

## ¿Tengo que pagar en la web?
No. La web no cobra: el pago se coordina por WhatsApp cuando confirmamos tu pedido.

## ¿Qué formas de pago aceptan?
Efectivo y transferencia (con 10% OFF) o tarjeta en 3 cuotas sin interés.

## ¿Puedo retirar en el local?
Sí, en Mitre 830, Rosario. Te avisamos por WhatsApp cuando el pedido está listo.

## ¿Hacen envíos?
Sí. Los coordinamos por WhatsApp según tu barrio o localidad. Mirá la sección Envíos.

## ¿Cómo sé mi talle?
Revisá la guía de talles en cada producto o consultanos por WhatsApp: te ayudamos con gusto.

## ¿Puedo cambiar una prenda?
Sí, dentro de los 30 días con el ticket. Mirá la sección Cambios y devoluciones.`,
  },
  cambios: {
    title: "Cambios y devoluciones",
    draft: true,
    body: `## Cambios
Podés cambiar tus prendas dentro de los **30 días** de la compra, presentando el ticket. La prenda tiene que estar sin uso, con sus etiquetas y en el mismo estado en que la recibiste.

Los cambios se hacen en el local (Mitre 830, Rosario) o se coordinan por WhatsApp si compraste con envío.

## Devoluciones y botón de arrepentimiento
Si compraste a distancia, tenés derecho a revocar la compra dentro de los **10 días corridos** desde que recibiste el producto (Ley 24.240, art. 34). Podés hacerlo desde el **Botón de arrepentimiento** al pie de la web. Te vamos a responder con un código de seguimiento.

## Prendas en promoción
Las prendas en promoción tienen cambio por talle o color sujeto a disponibilidad.`,
  },
  envios: {
    title: "Envíos",
    draft: true,
    body: `## Retiro en el local
Sin costo, en **Mitre 830, Rosario**. Te avisamos por WhatsApp cuando tu pedido está listo para retirar.

## Envíos en Rosario y alrededores
Coordinamos el envío por WhatsApp según tu barrio o localidad. El costo y el plazo dependen de la zona.

## Envíos al resto del país
Hacemos envíos a todo el país. Consultanos por WhatsApp el costo y la forma de envío.`,
  },
  talles: {
    title: "Guía de talles",
    draft: true,
    body: `## Prendas (S · M · L · XL)
Medidas aproximadas del cuerpo, en centímetros.

| Talle | Busto | Cintura | Cadera |
|---|---|---|---|
| S | 84–88 | 64–68 | 90–94 |
| M | 88–92 | 68–72 | 94–98 |
| L | 92–96 | 72–76 | 98–102 |
| XL | 96–100 | 76–80 | 102–106 |

## Jeans (22 al 36)
| Talle | Cintura | Cadera |
|---|---|---|
| 24 | 62 | 86 |
| 26 | 66 | 90 |
| 28 | 70 | 94 |
| 30 | 74 | 98 |
| 32 | 78 | 102 |
| 34 | 82 | 106 |
| 36 | 86 | 110 |

Las medidas son orientativas y pueden variar según el modelo. Ante cualquier duda, consultanos por WhatsApp.`,
  },
  contacto: {
    title: "Contacto",
    draft: false,
    body: `Escribinos por WhatsApp o visitanos en el local. Respondemos de lunes a sábados en horario comercial.`,
  },
};

export const PAGE_ROUTES: Record<PageKey, string> = {
  faq: "/preguntas-frecuentes",
  cambios: "/cambios-y-devoluciones",
  envios: "/envios",
  talles: "/guia-de-talles",
  contacto: "/contacto",
};
