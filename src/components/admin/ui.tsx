"use client";

import { useCallback, useEffect, useState, useTransition, type ReactNode } from "react";

export function AdminLoading() {
  return (
    <div className="space-y-4 py-6" aria-busy="true" aria-label="Cargando">
      <div className="h-6 w-48 animate-pulse bg-soft" />
      <div className="h-24 w-full animate-pulse bg-soft" />
      <div className="h-64 w-full animate-pulse bg-soft" />
    </div>
  );
}

export function AdminTitle({ title, subtitle, children }: { title: string; subtitle?: ReactNode; children?: ReactNode }) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-[20px] font-light uppercase tracking-[0.14em]">{title}</h1>
        {subtitle ? <p className="mt-1 text-[13px] text-mute">{subtitle}</p> : null}
      </div>
      {children ? <div className="flex flex-wrap items-center gap-3">{children}</div> : null}
    </div>
  );
}

export function Stat({ label, value, hint }: { label: string; value: ReactNode; hint?: ReactNode }) {
  return (
    <div className="border border-line p-4">
      <p className="label text-mute">{label}</p>
      <p className="mt-2 text-[22px] font-light tabular-nums">{value}</p>
      {hint ? <p className="mt-1 text-[12px] text-mute">{hint}</p> : null}
    </div>
  );
}

export function Section({ title, children, aside }: { title: string; children: ReactNode; aside?: ReactNode }) {
  return (
    <section className="mt-12 first:mt-0">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-ink pb-2">
        <h2 className="label font-medium">{title}</h2>
        {aside}
      </div>
      {children}
    </section>
  );
}

const STATUS_LABEL: Record<string, string> = {
  nuevo: "Nuevo",
  confirmado: "Confirmado",
  entregado: "Entregado",
  cancelado: "Cancelado",
  "en curso": "En curso",
  resuelto: "Resuelto",
};

export function StatusBadge({ status }: { status: string }) {
  const style =
    status === "nuevo"
      ? "bg-ink text-paper border-ink"
      : status === "cancelado"
        ? "border-line text-faint line-through"
        : status === "entregado" || status === "resuelto"
          ? "border-line text-mute"
          : "border-ink text-ink";
  return <span className={`label inline-block border px-2 py-0.5 ${style}`}>{STATUS_LABEL[status] ?? status}</span>;
}

export function statusLabel(status: string) {
  return STATUS_LABEL[status] ?? status;
}

type Feedback = { kind: "ok" | "error"; text: string } | null;

/** Ejecuta una acción del servidor mostrando "Guardando…" y el resultado. */
export function useAction() {
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<Feedback>(null);

  useEffect(() => {
    if (feedback?.kind !== "ok") return;
    const t = setTimeout(() => setFeedback(null), 3500);
    return () => clearTimeout(t);
  }, [feedback]);

  const run = useCallback(
    (fn: () => Promise<{ ok: boolean; message?: string; error?: string }>, onOk?: () => void) => {
      startTransition(async () => {
        try {
          const res = await fn();
          if (res.ok) {
            setFeedback({ kind: "ok", text: res.message ?? "Guardado" });
            onOk?.();
          } else setFeedback({ kind: "error", text: res.error ?? "No se pudo guardar" });
        } catch (e) {
          setFeedback({ kind: "error", text: e instanceof Error ? e.message : "Error de conexión" });
        }
      });
    },
    [],
  );

  return { pending, feedback, setFeedback, run };
}

export function FeedbackText({ feedback, pending }: { feedback: Feedback; pending?: boolean }) {
  if (pending) return <span className="text-[13px] text-mute" role="status">Guardando…</span>;
  if (!feedback) return null;
  return (
    <span className={`text-[13px] ${feedback.kind === "error" ? "font-medium text-ink underline decoration-1 underline-offset-4" : "text-mute"}`} role={feedback.kind === "error" ? "alert" : "status"}>
      {feedback.kind === "ok" ? "✓ " : ""}
      {feedback.text}
    </span>
  );
}

export function Field({ label, htmlFor, hint, children }: { label: string; htmlFor?: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <div>
      <label htmlFor={htmlFor} className="label text-mute">
        {label}
      </label>
      {children}
      {hint ? <p className="mt-1 text-[12px] text-mute">{hint}</p> : null}
    </div>
  );
}

export function Toggle({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center border transition-colors disabled:opacity-40 ${checked ? "border-ink bg-ink" : "border-line bg-paper"}`}
    >
      <span className={`absolute h-4 w-4 transition-transform duration-200 ${checked ? "translate-x-[22px] bg-paper" : "translate-x-[3px] bg-faint"}`} />
    </button>
  );
}

export function CheckboxRow({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: ReactNode }) {
  return (
    <label className="flex cursor-pointer items-center gap-3 py-1.5 text-[14px]">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="h-4 w-4 shrink-0 appearance-none border border-ink checked:bg-ink" />
      {label}
    </label>
  );
}

/** Convierte "45.000" / "$45000" en 45000 */
export function parseMoney(value: string): number | null {
  const clean = value.replace(/[$\s.]/g, "").replace(",", ".");
  if (!clean) return null;
  const n = Number(clean);
  return Number.isFinite(n) ? Math.round(n) : null;
}
