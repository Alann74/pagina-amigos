import { displayColor, displaySize, formatPrice } from "./format";

export type OrderMessageItem = {
  name: string;
  articleCode: string | null;
  size: string | null;
  color: string | null;
  quantity: number;
  unitPrice: number;
};

export type OrderMessageInput = {
  orderLabel: string; // #INE-0001 ("" si no se pudo registrar en la web: el mensaje sale igual, sin número)
  items: OrderMessageItem[];
  subtotal: number;
  cashTotal: number;
  discountPercent: number;
  installments: number;
  customerName: string;
  customerPhone: string;
  delivery: { method: "retiro" | "envio"; area?: string | null; storeAddressShort: string };
  payment: "efectivo" | "transferencia" | "tarjeta";
  comment?: string | null;
  wholesale?: boolean; // pedido mayorista (entró con el código)
  welcomeCode?: string | null; // código de bienvenida aplicado
};

// Los links wa.me largos se rompen en algunos navegadores (sobre todo el de Instagram).
// Mantenemos el mensaje por debajo de este largo (sin codificar) acortando el detalle si hace falta.
export const MAX_MESSAGE_LENGTH = 1500;

const PAYMENT_LABEL: Record<OrderMessageInput["payment"], string> = {
  efectivo: "Efectivo",
  transferencia: "Transferencia",
  tarjeta: "Tarjeta",
};

function itemLine(item: OrderMessageItem, compact: boolean): string {
  const parts: string[] = [];
  parts.push(compact || !item.articleCode ? item.name : `${item.name} (art. ${item.articleCode})`);
  if (item.size) parts.push(item.size === "UNICO" ? "Talle único" : `Talle ${displaySize(item.size)}`);
  if (item.color) parts.push(displayColor(item.color));
  parts.push(`x${item.quantity}`);
  parts.push(formatPrice(item.unitPrice * item.quantity));
  return `• ${parts.join(" — ")}`;
}

export function buildOrderMessage(input: OrderMessageInput): string {
  const deliveryText =
    input.delivery.method === "retiro"
      ? `Retiro en ${input.delivery.storeAddressShort}`
      : `Envío a coordinar${input.delivery.area ? ` — ${input.delivery.area.trim()}` : ""}`;
  const paymentText =
    input.payment === "tarjeta" && input.installments > 1
      ? `${PAYMENT_LABEL.tarjeta} (${input.installments} cuotas sin interés)`
      : PAYMENT_LABEL[input.payment];

  const label = input.orderLabel ? ` ${input.orderLabel}` : "";
  const head = input.wholesale ? `Hola INEDITA! PEDIDO MAYORISTA${label}:` : `Hola INEDITA! Quiero hacer este pedido${label}:`;
  const totals = [`${input.wholesale ? "Subtotal mayorista" : "Subtotal"}: ${formatPrice(input.subtotal)}`];
  if (input.discountPercent > 0) {
    totals.push(
      input.welcomeCode
        ? `Total con ${input.discountPercent}% OFF de bienvenida (código ${input.welcomeCode}) en efectivo/transferencia: ${formatPrice(input.cashTotal)}`
        : `Total con ${input.discountPercent}% OFF efectivo/transferencia: ${formatPrice(input.cashTotal)}`,
    );
  }
  const customer = [
    `Nombre: ${input.customerName.trim()}`,
    `Teléfono: ${input.customerPhone.trim()}`,
    `Entrega: ${deliveryText}`,
    `Pago: ${paymentText}`,
  ];
  const comment = input.comment?.trim();
  if (comment) customer.push(`Comentario: ${comment.replace(/\s+/g, " ").slice(0, 300)}`);

  const compose = (lines: string[]) => [head, "", ...lines, "", ...totals, "", ...customer].join("\n");

  // 1) Mensaje completo
  let message = compose(input.items.map((i) => itemLine(i, false)));
  if (message.length <= MAX_MESSAGE_LENGTH) return message;

  // 2) Sin el código de artículo en cada línea
  message = compose(input.items.map((i) => itemLine(i, true)));
  if (message.length <= MAX_MESSAGE_LENGTH) return message;

  // 3) Recortamos la lista y avisamos que el detalle completo quedó registrado
  const lines = input.items.map((i) => itemLine(i, true));
  for (let keep = lines.length - 1; keep >= 1; keep--) {
    const rest = input.items.slice(keep).reduce((acc, i) => acc + i.quantity, 0);
    const more = `• …y ${rest} ${rest === 1 ? "prenda más" : "prendas más"}`;
    const summary = input.orderLabel ? `${more} (el detalle completo quedó registrado en el pedido ${input.orderLabel})` : more;
    message = compose([...lines.slice(0, keep), summary]);
    if (message.length <= MAX_MESSAGE_LENGTH) return message;
  }
  return message.slice(0, MAX_MESSAGE_LENGTH);
}

export function whatsappUrl(number: string, text: string): string {
  const clean = number.replace(/\D/g, "");
  return `https://wa.me/${clean}?text=${encodeURIComponent(text)}`;
}

export function productConsultMessage(name: string, detail: string | null, url: string): string {
  return `Hola INEDITA! Quiero consultar por ${name}${detail ? ` – ${detail}` : ""} – ${url}`;
}

export function notifyMeMessage(name: string, detail: string | null, url: string): string {
  return `Hola INEDITA! Quiero que me avisen cuando vuelva ${name}${detail ? ` – ${detail}` : ""} – ${url}`;
}

export function favoritesMessage(items: { name: string; url: string }[]): string {
  const lines = items.slice(0, 25).map((i) => `• ${i.name} – ${i.url}`);
  const extra = items.length > 25 ? `\n…y ${items.length - 25} más` : "";
  return `Hola INEDITA! Quiero consultar por estos productos:\n\n${lines.join("\n")}${extra}`;
}

export function variantDetail(size: string | null, color: string | null): string | null {
  const parts: string[] = [];
  if (size) parts.push(size === "UNICO" ? "Talle único" : `Talle ${size}`);
  if (color) parts.push(displayColor(color));
  return parts.length ? parts.join(" / ") : null;
}

/**
 * Pasa un teléfono argentino como lo escribe la clienta ("341 15 555-1234", "0341 5551234", "+54 9 341…")
 * al formato de wa.me (5493415551234). Si no se puede deducir, devuelve los dígitos tal cual.
 */
export function toWhatsappNumber(phone: string, defaultArea = "341"): string {
  let d = phone.replace(/\D/g, "");
  if (d.startsWith("00")) d = d.slice(2);
  if (d.startsWith("549")) return d;
  if (d.startsWith("54")) d = d.slice(2);
  if (d.startsWith("0")) d = d.slice(1);
  // "15" después del código de área (3 o 4 dígitos) o al principio de un número local
  if (d.length === 12 && d.slice(3, 5) === "15") d = d.slice(0, 3) + d.slice(5);
  else if (d.length === 12 && d.slice(4, 6) === "15") d = d.slice(0, 4) + d.slice(6);
  else if (d.length === 12 && d.slice(2, 4) === "15") d = d.slice(0, 2) + d.slice(4);
  if (d.startsWith("15") && d.length === 9) d = defaultArea + d.slice(2);
  if (d.length === 7) d = defaultArea + d;
  return d.length === 10 ? `549${d}` : d;
}
