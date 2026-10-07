"use client";

import Link from "next/link";
import { useState } from "react";
import { WhatsAppIcon } from "@/components/icons";
import { useWholesale } from "@/components/wholesale";

export function WholesaleLogin({ contactHref }: { contactHref: string }) {
  const { active, exit } = useWholesale();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  if (active) {
    return (
      <div className="mt-8 space-y-3" data-testid="wholesale-active">
        <p className="border border-ink p-4 text-[14px]">Ya estás navegando con precios por mayor.</p>
        <Link href="/productos" className="btn btn-primary w-full">
          Ver productos
        </Link>
        <button type="button" onClick={() => void exit()} className="btn btn-secondary w-full">
          Salir del modo mayorista
        </button>
      </div>
    );
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (sending || !code.trim()) return;
    setSending(true);
    setError(null);
    try {
      const res = await fetch("/api/mayoristas", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "No pudimos validar el código");
        setSending(false);
        return;
      }
      // Recarga completa: así toda la tienda arranca ya en modo mayorista
      window.location.href = new URL("/productos", window.location.origin).href;
    } catch {
      setError("No pudimos conectarnos. Probá de nuevo.");
      setSending(false);
    }
  };

  return (
    <>
      <form onSubmit={submit} className="mt-8" noValidate>
        <label htmlFor="wholesale-code" className="label">
          Código de acceso
        </label>
        <input
          id="wholesale-code"
          className="field uppercase tracking-[0.12em]"
          value={code}
          onChange={(e) => {
            setCode(e.target.value);
            setError(null);
          }}
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
      <a href={contactHref} target="_blank" rel="noopener" className="mt-8 inline-flex items-center gap-2 text-[13px] underline underline-offset-4">
        <WhatsAppIcon size={15} />
        ¿No tenés código? Pedilo por WhatsApp
      </a>
    </>
  );
}
