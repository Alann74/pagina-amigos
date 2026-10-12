// Acceso mayorista: los mayoristas se registran en /mayoristas con sus datos; el admin los aprueba y les
// manda por WhatsApp su código personal. Además hay un código general (lo comparte INEDITA con quien
// quiera): con ese se ven los precios por mayor sin registrarse, y para hacer el pedido se pide el
// registro. Con el acceso activo, la misma tienda muestra los precios por mayor (los manda el servidor
// solo a quien tiene la cookie firmada).

export const WHOLESALE_COOKIE = "inedita_mayorista";
// Cookie visible para el navegador: solo avisa "pedí los precios mayoristas" (no da acceso a nada por sí sola)
export const WHOLESALE_FLAG = "inedita_my";

export type WholesaleSettings = {
  enabled: boolean;
  minAmount: number; // compra mínima en pesos (0 = sin mínimo)
  minUnits: number; // compra mínima en prendas, en cada pedido (0 = sin mínimo)
  firstOrderMinUnits: number; // mínimo de prendas de la primera compra de cada mayorista nuevo (0 = sin mínimo)
  sharedCode: string; // código general para ver los precios sin registrarse ("" = desactivado)
  cashDiscountPercent: number; // descuento extra en efectivo/transferencia para mayoristas (0 = ninguno)
  note: string; // texto que ven al entrar y en la bolsa
};

export const DEFAULT_WHOLESALE: WholesaleSettings = {
  enabled: false,
  minAmount: 0,
  minUnits: 0,
  firstOrderMinUnits: 25,
  sharedCode: "",
  cashDiscountPercent: 0,
  note: "Precios por mayor. Confirmamos stock, pago y envío por WhatsApp.",
};

/** Lo que recibe el navegador del mayorista (sin el código). */
export type WholesaleSession = {
  customer: { name: string; business: string | null } | null; // null: entró con el código general y todavía no se registró
  guest: boolean; // entró con el código general (para pedir tiene que estar registrado)
  prices: Record<number, number>;
  minAmount: number;
  minUnits: number; // el que le corresponde a este pedido (en la primera compra, el de primera compra)
  firstOrder: boolean; // true si rige el mínimo de primera compra
  cashDiscountPercent: number;
  note: string;
};

export const SALES_CHANNELS = [
  { id: "local", label: "Tengo local" },
  { id: "online", label: "Vendo online / redes" },
  { id: "revendedora", label: "Revendo (sin local)" },
  { id: "otro", label: "Otro" },
] as const;
