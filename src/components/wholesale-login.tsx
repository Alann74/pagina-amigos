"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { WhatsAppIcon } from "@/components/icons";
import { useWholesale } from "@/components/wholesale";
import { sendBrowserNotice } from "@/lib/browser-notice";
import { CHECKOUT_FORM_KEY } from "@/lib/checkout-form";
import { SALES_CHANNELS } from "@/lib/wholesale-config";
import { whatsappUrl } from "@/lib/whatsapp";

type Mode = "registro" | "codigo";

const noSubscribe = () => () => {};
const codeFromUrl = () => new URLSearchParams(window.location.search).get("codigo")?.slice(0, 40) ?? "";

export function WholesaleLogin({ whatsappNumber }: { whatsappNumber: string }) {
  const { active, session, exit } = useWholesale();
  // El link que se manda al aprobar trae el código: /mayoristas?codigo=XXXX-XXXX
  const initialCode = useSyncExternalStore(noSubscribe, codeFromUrl, () => "");
  const [chosen, setMode] = useState<Mode | null>(null);
  const mode = chosen ?? (initialCode ? "codigo" : "registro");

  if (active) {
    return (
      <div className="mt-8 space-y-3" data-testid="wholesale-active">
        <p className="border border-ink p-4 text-[14px]">
          {session?.customer?.name ? `Hola ${session.customer.name.split(/\s+/)[0]}! ` : ""}Ya estás navegando con precios por mayor.
          {session?.guest && !session.customer ? " Para hacer un pedido te vamos a pedir tus datos." : ""}
        </p>
        <Link href="/" className="btn btn-primary w-full">
          Ver la tienda
        </Link>
        <button type="button" onClick={() => void exit()} className="btn btn-secondary w-full">
          Salir del modo mayorista
        </button>
      </div>
    );
  }

  return (
    <div className="mt-8">
      <div className="grid grid-cols-2 border border-ink" role="tablist" aria-label="Acceso mayoristas">
        {(
          [
            { id: "registro", label: "Quiero registrarme" },
            { id: "codigo", label: "Ya tengo mi código" },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={mode === t.id}
            onClick={() => setMode(t.id)}
            className={`h-11 px-2 text-[12px] uppercase tracking-[0.12em] transition-colors ${mode === t.id ? "bg-ink text-paper" : ""}`}
            data-testid={`wholesale-tab-${t.id}`}
          >
            {t.label}
          </button>
        ))}
      </div>
      {mode === "registro" ? (
        <SignupForm whatsappNumber={whatsappNumber} onHasCode={() => setMode("codigo")} />
      ) : (
        <CodeForm key={initialCode} initialCode={initialCode} whatsappNumber={whatsappNumber} />
      )}
    </div>
  );
}

function CodeForm({ initialCode, whatsappNumber }: { initialCode: string; whatsappNumber: string }) {
  const [code, setCode] = useState(initialCode);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const autoSent = useRef(false);

  const enter = async (value: string) => {
    if (sending || !value.trim()) return;
    setSending(true);
    setError(null);
    try {
      const res = await fetch("/api/mayoristas", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code: value }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "No pudimos validar el código");
        setSending(false);
        return;
      }
      // Recarga completa al inicio: la misma tienda de siempre, ya con los precios por mayor
      window.location.href = new URL("/", window.location.origin).href;
    } catch {
      setError("No pudimos conectarnos. Probá de nuevo.");
      setSending(false);
    }
  };

  useEffect(() => {
    if (initialCode && !autoSent.current) {
      autoSent.current = true;
      void enter(initialCode);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialCode]);

  return (
    <>
      <p className="mt-6 text-[13px] leading-relaxed text-mute">Es el código personal que te mandamos por WhatsApp cuando aprobamos tu registro.</p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void enter(code);
        }}
        className="mt-5"
        noValidate
      >
        <label htmlFor="wholesale-code" className="label">
          Tu código
        </label>
        <input
          id="wholesale-code"
          className="field uppercase tracking-[0.12em]"
          value={code}
          onChange={(e) => {
            setCode(e.target.value);
            setError(null);
          }}
          placeholder="XXXX-XXXX"
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          aria-invalid={Boolean(error)}
          data-testid="wholesale-code"
        />
        {error ? (
          <p className="mt-2 text-[12.5px]" role="alert">
            {error}
          </p>
        ) : null}
        <button type="submit" className="btn btn-primary mt-6 w-full" disabled={sending || !code.trim()} data-testid="wholesale-enter">
          {sending ? "Ingresando…" : "Ingresar"}
        </button>
      </form>
      <a
        href={whatsappUrl(whatsappNumber, "Hola INEDITA! Ya me registré como mayorista y no encuentro mi código.")}
        target="_blank"
        rel="noopener"
        className="mt-8 inline-flex items-center gap-2 text-[13px] underline underline-offset-4"
      >
        <WhatsAppIcon size={15} />
        ¿Perdiste el código? Escribinos
      </a>
    </>
  );
}

type SignupData = {
  name: string;
  business: string;
  taxId: string;
  phone: string;
  email: string;
  city: string;
  instagram: string;
  salesChannel: string;
  comment: string;
};

const EMPTY: SignupData = { name: "", business: "", taxId: "", phone: "", email: "", city: "", instagram: "", salesChannel: "", comment: "" };

const FIELDS: { key: keyof SignupData; label: string; required?: boolean; type?: string; autoComplete?: string; placeholder?: string; inputMode?: "tel" | "email" }[] = [
  { key: "name", label: "Nombre y apellido", required: true, autoComplete: "name" },
  { key: "business", label: "Negocio o marca", autoComplete: "organization" },
  { key: "phone", label: "WhatsApp", required: true, type: "tel", inputMode: "tel", autoComplete: "tel", placeholder: "341 555-1234" },
  { key: "email", label: "Mail", required: true, type: "email", inputMode: "email", autoComplete: "email" },
  { key: "city", label: "Localidad y provincia", required: true, autoComplete: "address-level2", placeholder: "Rosario, Santa Fe" },
  { key: "taxId", label: "CUIT o DNI" },
  { key: "instagram", label: "Instagram", placeholder: "@tu.negocio" },
];

/**
 * Registro mayorista. `forOrder`: se muestra en la bolsa a quien entró con el código general; con el
 * registro ya puede mandar el pedido (se recarga la bolsa con su nombre y WhatsApp completos).
 */
export function SignupForm({ whatsappNumber, onHasCode, forOrder = false }: { whatsappNumber: string; onHasCode: () => void; forOrder?: boolean }) {
  const [form, setForm] = useState<SignupData>(EMPTY);
  const [website, setWebsite] = useState("");
  const [error, setError] = useState<{ message: string; field?: string } | null>(null);
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState<"recibido" | "ya-pendiente" | "ya-aprobado" | null>(null);
  const [firstOrderMin, setFirstOrderMin] = useState(0);

  const set = (key: keyof SignupData, value: string) => {
    setForm((f) => ({ ...f, [key]: value }));
    if (error?.field === key || !error?.field) setError(null);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (sending) return;
    const missing = FIELDS.find((f) => f.required && form[f.key].trim().length < 2);
    if (missing) {
      setError({ message: `Completá: ${missing.label}`, field: missing.key });
      document.getElementById(`ws-${missing.key}`)?.focus();
      return;
    }
    setSending(true);
    setError(null);
    try {
      const res = await fetch("/api/mayoristas/registro", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, salesChannel: form.salesChannel || null, website }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError({ message: data.error ?? "No pudimos mandar tus datos", field: data.field });
        if (data.field) document.getElementById(`ws-${data.field}`)?.focus();
        setSending(false);
        return;
      }
      sendBrowserNotice(data.notice);
      if (forOrder && data.canOrder) {
        try {
          const saved = JSON.parse(localStorage.getItem(CHECKOUT_FORM_KEY) ?? "{}");
          localStorage.setItem(CHECKOUT_FORM_KEY, JSON.stringify({ ...saved, customerName: form.name.trim(), customerPhone: form.phone.trim() }));
        } catch {}
        window.location.reload();
        return;
      }
      setDone(data.status ?? "recibido");
      setFirstOrderMin(Number(data.firstOrderMinUnits) || 0);
    } catch {
      setError({ message: "No pudimos conectarnos. Probá de nuevo." });
    }
    setSending(false);
  };

  if (done) {
    const firstName = form.name.trim().split(/\s+/)[0];
    return (
      <div className="mt-6 space-y-4 animate-fade-in" role="status" data-testid="wholesale-signup-done">
        {done === "ya-aprobado" ? (
          <>
            <p className="border border-ink p-4 text-[14px] leading-relaxed">Ese mail ya tiene acceso mayorista. Ingresá con el código personal que te mandamos por WhatsApp.</p>
            <button type="button" className="btn btn-primary w-full" onClick={onHasCode}>
              Ingresar con mi código
            </button>
          </>
        ) : (
          <>
            <p className="border border-ink p-4 text-[14px] leading-relaxed">
              {done === "ya-pendiente" ? `Gracias ${firstName}! Ya teníamos tu solicitud y actualizamos tus datos.` : `Gracias ${firstName}! Recibimos tus datos.`} Cuando
              aprobemos tu cuenta te mandamos por WhatsApp tu código personal para ver los precios por mayor.
            </p>
            {firstOrderMin > 0 ? (
              <p className="text-[13px] leading-relaxed text-mute" data-testid="wholesale-first-min">
                Para clientas nuevas, la primera compra por mayor es de mínimo {firstOrderMin} prendas.
              </p>
            ) : null}
            <a
              href={whatsappUrl(whatsappNumber, `Hola INEDITA! Me registré como mayorista: ${form.name.trim()}${form.business.trim() ? ` (${form.business.trim()})` : ""}.`)}
              target="_blank"
              rel="noopener"
              className="btn btn-secondary w-full gap-2"
            >
              <WhatsAppIcon size={16} />
              Avisar por WhatsApp
            </a>
          </>
        )}
      </div>
    );
  }

  const fieldError = (key: string) => (error?.field === key ? error.message : null);

  return (
    <form onSubmit={submit} className="mt-6 space-y-5" noValidate data-testid="wholesale-signup">
      {forOrder ? null : (
        <p className="text-[13px] leading-relaxed text-mute">Dejanos tus datos: revisamos cada solicitud y te mandamos por WhatsApp tu código personal para entrar.</p>
      )}
      <input type="text" name="website" value={website} onChange={(e) => setWebsite(e.target.value)} tabIndex={-1} autoComplete="off" className="hidden" aria-hidden />
      <div className="grid gap-5 sm:grid-cols-2">
        {FIELDS.map((f) => (
          <div key={f.key} className={f.key === "name" || f.key === "city" ? "sm:col-span-2" : ""}>
            <label htmlFor={`ws-${f.key}`} className="label">
              {f.label}
              {f.required ? "" : <span className="normal-case tracking-normal text-mute"> (opcional)</span>}
            </label>
            <input
              id={`ws-${f.key}`}
              className="field"
              type={f.type ?? "text"}
              inputMode={f.inputMode}
              autoComplete={f.autoComplete ?? "off"}
              placeholder={f.placeholder}
              value={form[f.key]}
              onChange={(e) => set(f.key, e.target.value)}
              aria-invalid={Boolean(fieldError(f.key))}
              required={f.required}
              data-testid={`ws-${f.key}`}
            />
            {fieldError(f.key) ? (
              <p className="mt-1 text-[12px]" role="alert">
                {fieldError(f.key)}
              </p>
            ) : null}
          </div>
        ))}
      </div>
      <fieldset>
        <legend className="label">
          ¿Cómo vendés? <span className="normal-case tracking-normal text-mute">(opcional)</span>
        </legend>
        <div className="mt-3 grid grid-cols-2 gap-2">
          {SALES_CHANNELS.map((c) => (
            <label
              key={c.id}
              className={`flex min-h-11 cursor-pointer items-center justify-center border px-2 text-center text-[12px] transition-colors focus-within:outline focus-within:outline-1 ${form.salesChannel === c.id ? "border-ink bg-ink text-paper" : "border-line"}`}
            >
              <input
                type="radio"
                name="salesChannel"
                value={c.id}
                checked={form.salesChannel === c.id}
                onChange={() => set("salesChannel", c.id)}
                className="sr-only"
              />
              {c.label}
            </label>
          ))}
        </div>
      </fieldset>
      <div>
        <label htmlFor="ws-comment" className="label">
          Comentario <span className="normal-case tracking-normal text-mute">(opcional)</span>
        </label>
        <textarea
          id="ws-comment"
          className="field min-h-20 resize-y"
          maxLength={500}
          placeholder="¿Qué te interesa? ¿Cada cuánto comprás?"
          value={form.comment}
          onChange={(e) => set("comment", e.target.value)}
        />
      </div>
      {error && !FIELDS.some((f) => f.key === error.field) ? (
        <p className="text-[12.5px]" role="alert">
          {error.message}
        </p>
      ) : null}
      <button type="submit" className="btn btn-primary w-full" disabled={sending} data-testid="wholesale-signup-send">
        {sending ? "Enviando…" : forOrder ? "Registrarme y seguir con el pedido" : "Enviar solicitud"}
      </button>
    </form>
  );
}
