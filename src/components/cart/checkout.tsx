"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { CartLine } from "@/components/cart/cart-line";
import { CartTotals, FreeShippingBar } from "@/components/cart/cart-totals";
import { CompleteLook } from "@/components/cart/complete-look";
import { WhatsAppIcon } from "@/components/icons";
import { useShopConfig } from "@/components/shop-config";
import { useCartPricing, useWholesale } from "@/components/wholesale";
import { trackWhatsappOrder } from "@/lib/analytics";
import { readAttribution } from "@/lib/attribution";
import { useHydrated } from "@/lib/use-hydrated";
import { cartCount, useCart } from "@/stores/cart";
import { forgetWelcome, readWelcome, saveWelcome, type WelcomeCode } from "@/lib/welcome-client";

type Form = {
  customerName: string;
  customerPhone: string;
  deliveryMethod: "retiro" | "envio";
  deliveryArea: string;
  paymentMethod: "efectivo" | "transferencia" | "tarjeta";
  comment: string;
};

const FORM_KEY = "inedita-checkout";

function isMobileDevice() {
  return /Android|iPhone|iPad|iPod|Mobile|Instagram|FBAN|FBAV/i.test(navigator.userAgent);
}

export function Checkout() {
  const hydrated = useHydrated();
  const router = useRouter();
  const items = useCart((s) => s.items);
  const clear = useCart((s) => s.clear);
  const { storeAddressShort, cashDiscountPercent: retailCashPercent, installments } = useShopConfig();
  const wholesale = useWholesale();
  const pricing = useCartPricing();
  const cashDiscountPercent = wholesale.active ? (wholesale.session?.cashDiscountPercent ?? 0) : retailCashPercent;
  // Código de bienvenida del pop-up (guardado en este navegador) o escrito a mano
  const [welcome, setWelcome] = useState<WelcomeCode | null>(() => (typeof window === "undefined" ? null : readWelcome()));
  const [codeInput, setCodeInput] = useState("");
  const [codeMessage, setCodeMessage] = useState<string | null>(null);
  // Los datos de la última compra se recuerdan en este navegador (el formulario solo se muestra ya hidratado)
  const [form, setForm] = useState<Form>(() => {
    const base: Form = { customerName: "", customerPhone: "", deliveryMethod: "retiro", deliveryArea: "", paymentMethod: "transferencia", comment: "" };
    if (typeof window === "undefined") return base;
    try {
      const saved = JSON.parse(localStorage.getItem(FORM_KEY) ?? "null");
      return saved ? { ...base, customerName: saved.customerName ?? "", customerPhone: saved.customerPhone ?? "", deliveryArea: saved.deliveryArea ?? "" } : base;
    } catch {
      return base;
    }
  });
  const [error, setError] = useState<{ message: string; field?: string } | null>(null);
  const [sending, setSending] = useState(false);

  // El código guardado se confirma con el servidor (puede haberse usado en otro pedido)
  const storedCode = welcome?.code ?? null;
  useEffect(() => {
    if (!storedCode) return;
    let cancelled = false;
    fetch(`/api/bienvenida?codigo=${encodeURIComponent(storedCode)}`)
      .then((r) => r.json())
      .then((d: { valid: boolean; code?: string; percent?: number }) => {
        if (cancelled) return;
        if (d.valid && d.code && d.percent) setWelcome({ code: d.code, percent: d.percent });
        else {
          forgetWelcome();
          setWelcome(null);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [storedCode]);

  const applyCode = async () => {
    const code = codeInput.trim();
    if (!code) return;
    setCodeMessage(null);
    try {
      const d = (await (await fetch(`/api/bienvenida?codigo=${encodeURIComponent(code)}`)).json()) as { valid: boolean; code?: string; percent?: number };
      if (d.valid && d.code && d.percent) {
        const next = { code: d.code, percent: d.percent };
        saveWelcome(next);
        setWelcome(next);
        setCodeInput("");
      } else setCodeMessage("Ese código no es válido o ya se usó.");
    } catch {
      setCodeMessage("No pudimos validar el código. Probá de nuevo.");
    }
  };

  const set = <K extends keyof Form>(key: K, value: Form[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    if (error?.field === key) setError(null);
  };

  if (!hydrated) {
    return <div className="min-h-[50vh]" aria-busy />;
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center gap-6 px-6 py-24 text-center">
        <h1 className="text-[13px] font-medium uppercase tracking-[0.24em]">Tu bolsa está vacía</h1>
        <p className="text-sm text-mute">Elegí tus prendas y armá tu pedido.</p>
        <Link href="/productos" className="btn btn-primary">
          Ver colección
        </Link>
      </div>
    );
  }

  const subtotal = pricing.subtotal(items);
  const units = cartCount(items);
  const welcomePercent = !wholesale.active && welcome && welcome.percent > cashDiscountPercent ? welcome.percent : 0;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (sending) return;
    setError(null);
    if (form.customerName.trim().length < 2) return setError({ message: "Ingresá tu nombre", field: "customerName" });
    if (form.customerPhone.replace(/\D/g, "").length < 8) return setError({ message: "Ingresá un teléfono válido", field: "customerPhone" });
    if (form.deliveryMethod === "envio" && form.deliveryArea.trim().length < 2) return setError({ message: "Indicá tu barrio o localidad", field: "deliveryArea" });

    const mobile = isMobileDevice();
    // En desktop abrimos la pestaña ya (dentro del click) para que el navegador no la bloquee
    const preOpened = !mobile ? window.open("", "_blank") : null;
    setSending(true);
    try {
      const attribution = readAttribution();
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: items.map((i) => ({ variantId: i.variantId, quantity: i.quantity })),
          customerName: form.customerName,
          customerPhone: form.customerPhone,
          deliveryMethod: form.deliveryMethod,
          deliveryArea: form.deliveryMethod === "envio" ? form.deliveryArea : null,
          paymentMethod: form.paymentMethod,
          comment: form.comment,
          promoCode: wholesale.active ? null : (welcome?.code ?? null),
          attribution: attribution
            ? {
                utmSource: attribution.utmSource,
                utmMedium: attribution.utmMedium,
                utmCampaign: attribution.utmCampaign,
                utmContent: attribution.utmContent,
                utmTerm: attribution.utmTerm,
                trafficSource: attribution.trafficSource,
                referrer: attribution.referrer,
                landingPath: attribution.landingPath,
              }
            : null,
          website: "",
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        preOpened?.close();
        setError({ message: data.error ?? "No pudimos enviar el pedido", field: data.field });
        setSending(false);
        return;
      }
      try {
        localStorage.setItem(FORM_KEY, JSON.stringify({ customerName: form.customerName, customerPhone: form.customerPhone, deliveryArea: form.deliveryArea }));
        if (data.welcomeApplied) forgetWelcome();
        sessionStorage.setItem(`inedita-order-${data.token}`, JSON.stringify({ message: data.message, whatsappUrl: data.whatsappUrl }));
      } catch {}
      trackWhatsappOrder(data.label, form.paymentMethod === "tarjeta" ? data.subtotal : data.cashTotal, data.items);
      clear();
      if (preOpened) {
        preOpened.location.href = data.whatsappUrl;
        router.replace(`/pedido/${data.token}`);
      } else {
        router.replace(`/pedido/${data.token}?abrir=1`);
      }
    } catch {
      preOpened?.close();
      setError({ message: "No pudimos conectarnos. Revisá tu conexión y probá de nuevo." });
      setSending(false);
    }
  };

  const fieldError = (field: keyof Form) => (error?.field === field ? error.message : null);

  return (
    <div className="mx-auto grid max-w-[1200px] gap-10 px-4 pb-24 pt-8 sm:px-8 lg:grid-cols-[1fr_420px] lg:gap-16 lg:pt-12">
      <section aria-labelledby="bag-title">
        <h1 id="bag-title" className="text-[13px] font-medium uppercase tracking-[0.24em]">
          Tu bolsa
        </h1>
        <div className="-mx-5">
          <FreeShippingBar subtotal={subtotal} />
        </div>
        <ul className="mt-2 divide-y divide-line border-b border-line">
          {items.map((item) => (
            <CartLine key={item.variantId} item={item} />
          ))}
        </ul>
        <div className="mt-6 lg:hidden">
          <CartTotals subtotal={subtotal} units={units} welcomePercent={welcomePercent} />
        </div>
        <div className="-mx-5 mt-6 hidden lg:block">
          <CompleteLook items={items} />
        </div>
      </section>

      <section aria-labelledby="checkout-title" className="lg:sticky lg:top-24 lg:self-start" id="datos">
        <h2 id="checkout-title" className="text-[13px] font-medium uppercase tracking-[0.24em]">
          Tus datos
        </h2>
        <p className="mt-2 text-[13px] text-mute">
          {wholesale.active ? (wholesale.session?.note ?? "Pedido mayorista.") : "Te llega el pedido armado a nuestro WhatsApp y coordinamos pago y entrega."}
        </p>
        <form className="mt-6 space-y-6" onSubmit={submit} noValidate data-testid="checkout-form">
          <input type="text" name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden />
          <div>
            <label htmlFor="customerName" className="label">
              Nombre
            </label>
            <input
              id="customerName"
              className="field"
              autoComplete="name"
              value={form.customerName}
              onChange={(e) => set("customerName", e.target.value)}
              aria-invalid={Boolean(fieldError("customerName"))}
              required
            />
            {fieldError("customerName") ? <p className="mt-1 text-[12px]">{fieldError("customerName")}</p> : null}
          </div>
          <div>
            <label htmlFor="customerPhone" className="label">
              Teléfono / WhatsApp
            </label>
            <input
              id="customerPhone"
              className="field"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder="341 555-1234"
              value={form.customerPhone}
              onChange={(e) => set("customerPhone", e.target.value)}
              aria-invalid={Boolean(fieldError("customerPhone"))}
              required
            />
            {fieldError("customerPhone") ? <p className="mt-1 text-[12px]">{fieldError("customerPhone")}</p> : null}
          </div>
          <fieldset>
            <legend className="label">Entrega</legend>
            <div className="mt-3 grid gap-2">
              {[
                { value: "retiro" as const, label: `Retiro en ${storeAddressShort}`, hint: "Sin costo. Te avisamos cuando esté listo." },
                { value: "envio" as const, label: "Envío a coordinar", hint: "Costo según zona. Lo coordinamos por WhatsApp." },
              ].map((opt) => (
                <label key={opt.value} className={`flex cursor-pointer gap-3 border p-4 transition-colors ${form.deliveryMethod === opt.value ? "border-ink" : "border-line"}`}>
                  <input
                    type="radio"
                    name="deliveryMethod"
                    value={opt.value}
                    checked={form.deliveryMethod === opt.value}
                    onChange={() => set("deliveryMethod", opt.value)}
                    className="mt-0.5 h-4 w-4 shrink-0 appearance-none rounded-full border border-ink checked:border-[5px]"
                  />
                  <span>
                    <span className="block text-[13px]">{opt.label}</span>
                    <span className="block text-[12px] text-mute">{opt.hint}</span>
                  </span>
                </label>
              ))}
            </div>
            {form.deliveryMethod === "envio" ? (
              <div className="mt-4 animate-fade-in">
                <label htmlFor="deliveryArea" className="label">
                  Barrio o localidad
                </label>
                <input
                  id="deliveryArea"
                  className="field"
                  autoComplete="address-level2"
                  value={form.deliveryArea}
                  onChange={(e) => set("deliveryArea", e.target.value)}
                  aria-invalid={Boolean(fieldError("deliveryArea"))}
                />
                {fieldError("deliveryArea") ? <p className="mt-1 text-[12px]">{fieldError("deliveryArea")}</p> : null}
              </div>
            ) : null}
          </fieldset>
          <fieldset>
            <legend className="label">Forma de pago preferida</legend>
            <div className="mt-3 grid grid-cols-3 gap-2">
              {[
                { value: "efectivo" as const, label: "Efectivo" },
                { value: "transferencia" as const, label: "Transferencia" },
                { value: "tarjeta" as const, label: "Tarjeta" },
              ].map((opt) => (
                <label
                  key={opt.value}
                  className={`flex h-11 cursor-pointer items-center justify-center border px-2 text-center text-[12px] transition-colors focus-within:outline focus-within:outline-1 ${form.paymentMethod === opt.value ? "border-ink bg-ink text-paper" : "border-line"}`}
                >
                  <input type="radio" name="paymentMethod" value={opt.value} checked={form.paymentMethod === opt.value} onChange={() => set("paymentMethod", opt.value)} className="sr-only" />
                  {opt.label}
                </label>
              ))}
            </div>
            <p className="mt-2 text-[12px] text-mute">
              {wholesale.active
                ? cashDiscountPercent > 0 && form.paymentMethod !== "tarjeta"
                  ? `${cashDiscountPercent}% OFF pagando en efectivo o transferencia.`
                  : "Precios por mayor."
                : form.paymentMethod === "tarjeta"
                  ? `Hasta ${installments} cuotas sin interés. Se coordina al confirmar el pedido.`
                  : welcomePercent
                    ? `${welcomePercent}% OFF de bienvenida pagando en efectivo o transferencia.`
                    : cashDiscountPercent > 0
                      ? `${cashDiscountPercent}% OFF pagando en efectivo o transferencia.`
                      : ""}{" "}
              No se cobra nada en la web.
            </p>
          </fieldset>
          {!wholesale.active ? (
            welcome ? (
              <p className="border border-line p-3 text-[12px] leading-relaxed" data-testid="welcome-applied">
                Código <strong className="font-medium">{welcome.code}</strong>: {welcome.percent}% OFF en esta compra pagando en efectivo o transferencia.
              </p>
            ) : (
              <details className="text-[12px]">
                <summary className="cursor-pointer text-mute underline underline-offset-4">¿Tenés un código de descuento?</summary>
                <div className="mt-3 flex gap-2">
                  <input
                    className="field flex-1 uppercase"
                    value={codeInput}
                    onChange={(e) => setCodeInput(e.target.value)}
                    placeholder="HOLA-XXXXX"
                    aria-label="Código de descuento"
                    autoCapitalize="characters"
                  />
                  <button type="button" className="btn btn-secondary" onClick={() => void applyCode()}>
                    Aplicar
                  </button>
                </div>
                {codeMessage ? <p className="mt-2">{codeMessage}</p> : null}
              </details>
            )
          ) : null}
          <div>
            <label htmlFor="comment" className="label">
              Comentario <span className="normal-case tracking-normal text-mute">(opcional)</span>
            </label>
            <textarea id="comment" className="field min-h-20 resize-y" maxLength={500} value={form.comment} onChange={(e) => set("comment", e.target.value)} />
          </div>

          <div className="hidden lg:block">
            <CartTotals subtotal={subtotal} units={units} welcomePercent={welcomePercent} />
          </div>

          {error && !error.field ? (
            <p className="border border-ink p-3 text-[13px]" role="alert">
              {error.message}
            </p>
          ) : null}

          <button type="submit" className="btn btn-primary w-full" disabled={sending} data-testid="send-order">
            <WhatsAppIcon size={16} />
            {sending ? "Enviando…" : "Enviar pedido por WhatsApp"}
          </button>
          <p className="text-center text-[11px] leading-relaxed text-mute">
            Al enviar, tu pedido queda registrado y se abre WhatsApp con el detalle. La compra se confirma cuando te respondemos.
          </p>
        </form>
      </section>
    </div>
  );
}
