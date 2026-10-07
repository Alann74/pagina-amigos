"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CloseIcon } from "@/components/icons";
import { useShopConfig } from "@/components/shop-config";
import { hasWholesaleFlag } from "@/components/wholesale";
import { trackWelcomeSignup } from "@/lib/analytics";
import { readAttribution } from "@/lib/attribution";
import { markPopupDismissed, popupAllowed, saveWelcome } from "@/lib/welcome-client";

// Páginas donde no se interrumpe: bolsa, pedido, mayoristas y formularios legales
const SKIP = /^\/(carrito|pedido|mayoristas|arrepentimiento)/;

/**
 * Pop-up de bienvenida: mail + WhatsApp → código con % OFF en la primera compra (efectivo/transferencia).
 * Aparece una sola vez: a los N segundos o al bajar por la página, lo que pase primero.
 * Si se cierra, no vuelve por 7 días; si se suscribe, no vuelve más (y el código queda aplicado en la bolsa).
 */
export function WelcomePopup() {
  const { welcome } = useShopConfig();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState<{ code: string; percent: number } | null>(null);
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [copied, setCopied] = useState(false);
  const shownRef = useRef(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const eligiblePath = !SKIP.test(pathname);

  useEffect(() => {
    if (!welcome.enabled || welcome.percent <= 0 || !eligiblePath || shownRef.current) return;
    if (hasWholesaleFlag() || !popupAllowed()) return;
    const show = () => {
      if (shownRef.current) return;
      shownRef.current = true;
      setOpen(true);
      cleanup();
    };
    const onScroll = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      if (max > 0 && window.scrollY / max > 0.45) show();
    };
    const timer = window.setTimeout(show, Math.max(3, welcome.delaySeconds) * 1000);
    window.addEventListener("scroll", onScroll, { passive: true });
    function cleanup() {
      window.clearTimeout(timer);
      window.removeEventListener("scroll", onScroll);
    }
    return cleanup;
  }, [welcome.enabled, welcome.percent, welcome.delaySeconds, eligiblePath]);

  const doneRef = useRef(false);
  useEffect(() => {
    doneRef.current = Boolean(done);
  }, [done]);

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const t = window.setTimeout(() => panelRef.current?.querySelector<HTMLElement>("input:not([tabindex='-1'])")?.focus({ preventScroll: true }), 50);
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (!doneRef.current) markPopupDismissed();
      setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => {
      window.clearTimeout(t);
      document.removeEventListener("keydown", onKey);
      previous?.focus?.({ preventScroll: true });
    };
  }, [open]);

  function close() {
    if (!done) markPopupDismissed();
    setOpen(false);
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (sending) return;
    setError(null);
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setError("Revisá tu mail");
    if (phone.replace(/\D/g, "").length < 8) return setError("Ingresá tu WhatsApp con característica (ej. 341 555-1234)");
    setSending(true);
    try {
      const a = readAttribution();
      const res = await fetch("/api/bienvenida", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, phone, landingPath: a?.landingPath ?? pathname, utmSource: a?.utmSource ?? null, utmCampaign: a?.utmCampaign ?? null, website: "" }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "No pudimos registrarte. Probá de nuevo.");
        if (data.used) markPopupDismissed();
        return;
      }
      saveWelcome({ code: data.code, percent: data.percent });
      setDone({ code: data.code, percent: data.percent });
      trackWelcomeSignup(data.percent);
    } catch {
      setError("No pudimos conectarnos. Probá de nuevo.");
    } finally {
      setSending(false);
    }
  };

  const copy = async () => {
    if (!done) return;
    try {
      await navigator.clipboard.writeText(done.code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center" data-testid="welcome-popup">
      <button type="button" aria-label="Cerrar" className="absolute inset-0 bg-ink/40 animate-fade-in" onClick={close} tabIndex={-1} />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="welcome-title"
        className="relative w-full max-w-[440px] animate-fade-in bg-paper px-6 pb-[max(1.75rem,env(safe-area-inset-bottom))] pt-8 sm:px-9 sm:pb-9 sm:pt-10"
      >
        <button type="button" onClick={close} className="absolute right-2 top-2 flex h-11 w-11 items-center justify-center" aria-label="Cerrar">
          <CloseIcon size={18} />
        </button>
        {done ? (
          <div className="text-center" data-testid="welcome-done">
            <p className="label text-mute">Listo</p>
            <h2 id="welcome-title" className="mt-3 text-[22px] font-light leading-tight">
              Tu {done.percent}% OFF ya es tuyo
            </h2>
            <button type="button" onClick={copy} className="mx-auto mt-6 block w-full border border-ink py-4 text-[20px] font-medium tracking-[0.18em]" aria-label={`Copiar el código ${done.code}`}>
              {done.code}
            </button>
            <p className="label mt-2 text-mute" aria-live="polite">
              {copied ? "Código copiado" : "Tocá para copiar"}
            </p>
            <p className="mt-5 text-[13px] leading-relaxed text-mute">
              Ya quedó aplicado en este celular: se descuenta al enviar tu pedido por WhatsApp pagando en efectivo o transferencia. Si comprás desde otro dispositivo, escribí el código en la bolsa.
            </p>
            <button type="button" onClick={() => setOpen(false)} className="btn btn-primary mt-6 w-full">
              Ver la colección
            </button>
          </div>
        ) : (
          <form onSubmit={submit} noValidate>
            <p className="label text-mute">Bienvenida</p>
            <h2 id="welcome-title" className="mt-3 text-[24px] font-light leading-[1.15] sm:text-[26px]">
              {welcome.title}
            </h2>
            <p className="mt-3 text-[13.5px] leading-relaxed text-mute">{welcome.text}</p>
            <input type="text" name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden />
            <div className="mt-6 space-y-4">
              <div>
                <label htmlFor="welcome-email" className="label">
                  Mail
                </label>
                <input id="welcome-email" type="email" inputMode="email" autoComplete="email" className="field" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </div>
              <div>
                <label htmlFor="welcome-phone" className="label">
                  WhatsApp
                </label>
                <input
                  id="welcome-phone"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  placeholder="341 555-1234"
                  className="field"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  required
                />
              </div>
            </div>
            {error ? (
              <p className="mt-3 text-[12.5px]" role="alert">
                {error}
              </p>
            ) : null}
            <button type="submit" className="btn btn-primary mt-6 w-full" disabled={sending} data-testid="welcome-submit">
              {sending ? "Un momento…" : `Quiero mi ${welcome.percent}% OFF`}
            </button>
            <button type="button" onClick={close} className="mt-3 w-full py-2 text-[12px] text-mute underline underline-offset-4">
              No, gracias
            </button>
            <p className="mt-3 text-center text-[11px] leading-relaxed text-faint">
              Válido para tu primera compra pagando en efectivo o transferencia. No acumulable con otras promociones. Te vamos a escribir solo con novedades de INEDITA.
            </p>
          </form>
        )}
      </div>
    </div>,
    document.body,
  );
}
