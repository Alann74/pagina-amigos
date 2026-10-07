"use client";

import { useState } from "react";
import { WhatsAppIcon } from "@/components/icons";

export function WithdrawalForm() {
  const [state, setState] = useState<{ code: string; whatsappUrl: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  if (state) {
    return (
      <div className="mt-10 border border-ink p-6" role="status">
        <p className="label">Solicitud registrada</p>
        <p className="mt-2 text-[22px] font-light tracking-[0.06em]" data-testid="withdrawal-code">
          {state.code}
        </p>
        <p className="mt-3 text-[14px] leading-relaxed">Guardá este código. Te contactamos dentro de las 24 horas hábiles para coordinar la devolución. Si querés, avisanos también por WhatsApp:</p>
        <a href={state.whatsappUrl} target="_blank" rel="noopener" className="btn btn-primary mt-5">
          <WhatsAppIcon size={16} /> Enviar por WhatsApp
        </a>
      </div>
    );
  }

  return (
    <form
      className="mt-10 space-y-6"
      onSubmit={async (e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        setSending(true);
        setError(null);
        const res = await fetch("/api/arrepentimiento", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(Object.fromEntries(fd)) });
        const data = await res.json().catch(() => ({}));
        setSending(false);
        if (!res.ok) return setError(data.error ?? "No pudimos registrar la solicitud");
        setState(data);
      }}
    >
      <input type="text" name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden />
      <div>
        <label htmlFor="w-name" className="label">Nombre y apellido</label>
        <input id="w-name" name="name" className="field" required autoComplete="name" />
      </div>
      <div>
        <label htmlFor="w-phone" className="label">Teléfono</label>
        <input id="w-phone" name="phone" className="field" required type="tel" autoComplete="tel" />
      </div>
      <div>
        <label htmlFor="w-email" className="label">Email <span className="normal-case tracking-normal text-mute">(opcional)</span></label>
        <input id="w-email" name="email" className="field" type="email" autoComplete="email" />
      </div>
      <div>
        <label htmlFor="w-order" className="label">Número de pedido o fecha de compra</label>
        <input id="w-order" name="orderReference" className="field" placeholder="#INE-0001" />
      </div>
      <div>
        <label htmlFor="w-detail" className="label">Detalle <span className="normal-case tracking-normal text-mute">(opcional)</span></label>
        <textarea id="w-detail" name="detail" className="field min-h-20" maxLength={800} />
      </div>
      {error ? <p className="border border-ink p-3 text-[13px]" role="alert">{error}</p> : null}
      <button type="submit" className="btn btn-primary w-full sm:w-auto" disabled={sending}>
        {sending ? "Enviando…" : "Enviar solicitud"}
      </button>
    </form>
  );
}
