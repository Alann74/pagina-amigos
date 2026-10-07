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
  orderLabel: string; // #INE-0001
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

  const head = `Hola INEDITA! Quiero hacer este pedido ${input.orderLabel}:`;
  const totals = [`Subtotal: ${formatPrice(input.subtotal)}`];
  if (input.discountPercent > 0) {
    totals.push(`Total con ${input.discountPercent}% OFF efectivo/transferencia: ${formatPrice(input.cashTotal)}`);
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
    const summary = `• …y ${rest} ${rest === 1 ? "prenda más" : "prendas más"} (el detalle completo quedó registrado en el pedido ${input.orderLabel})`;
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
