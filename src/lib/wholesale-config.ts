// Acceso mayorista: se entra por /mayoristas con un código. Con el acceso activo, la misma tienda
// muestra los precios por mayor (los manda el servidor solo a quien tiene la cookie firmada).

export const WHOLESALE_COOKIE = "inedita_mayorista";
// Cookie visible para el navegador: solo avisa "pedí los precios mayoristas" (no da acceso a nada por sí sola)
export const WHOLESALE_FLAG = "inedita_my";

export type WholesaleSettings = {
  enabled: boolean;
  code: string;
  minAmount: number; // compra mínima en pesos (0 = sin mínimo)
  minUnits: number; // compra mínima en prendas (0 = sin mínimo)
  cashDiscountPercent: number; // descuento extra en efectivo/transferencia para mayoristas (0 = ninguno)
  note: string; // texto que ven al entrar y en la bolsa
};

export const DEFAULT_WHOLESALE: WholesaleSettings = {
  enabled: false,
  code: "",
  minAmount: 0,
  minUnits: 0,
  cashDiscountPercent: 0,
  note: "Precios por mayor. Confirmamos stock, pago y envío por WhatsApp.",
};

/** Lo que recibe el navegador del mayorista (sin el código). */
export type WholesaleSession = {
  prices: Record<number, number>;
  minAmount: number;
  minUnits: number;
  cashDiscountPercent: number;
  note: string;
};
