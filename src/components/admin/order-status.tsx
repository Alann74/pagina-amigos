"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { updateOrderStatus } from "@/app/admin/actions";
import { FeedbackText, useAction } from "@/components/admin/ui";

const OPTIONS = [
  { value: "nuevo", label: "Nuevo" },
  { value: "confirmado", label: "Confirmado" },
  { value: "entregado", label: "Entregado" },
  { value: "cancelado", label: "Cancelado" },
];

export function OrderStatusSelect({ orderId, status, compact = false }: { orderId: number; status: string; compact?: boolean }) {
  const router = useRouter();
  const [value, setValue] = useState(status);
  const { pending, feedback, run } = useAction();
  return (
    <div className="flex items-center gap-3">
      <label className="sr-only" htmlFor={`status-${orderId}`}>
        Estado
      </label>
      <select
        id={`status-${orderId}`}
        value={value}
        disabled={pending}
        onChange={(e) => {
          const next = e.target.value;
          const prev = value;
          setValue(next);
          run(
            async () => {
              const res = await updateOrderStatus(orderId, next);
              if (!res.ok) setValue(prev);
              return res;
            },
            () => router.refresh(),
          );
        }}
        className={`border px-2 text-[13px] ${compact ? "h-9" : "h-11"} ${value === "nuevo" ? "border-ink bg-ink text-paper" : "border-line bg-paper"}`}
        data-testid="order-status"
      >
        {OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {!compact ? <FeedbackText feedback={feedback} pending={pending} /> : feedback?.kind === "error" ? <FeedbackText feedback={feedback} /> : null}
    </div>
  );
}

export function OrderNote({ orderId, status, note }: { orderId: number; status: string; note: string }) {
  const [value, setValue] = useState(note);
  const { pending, feedback, run } = useAction();
  return (
    <div>
      <label htmlFor="admin-note" className="label text-mute">
        Nota interna
      </label>
      <textarea id="admin-note" value={value} onChange={(e) => setValue(e.target.value)} className="field min-h-24" maxLength={1000} placeholder="Ej.: pagó por transferencia, retira el sábado" />
      <div className="mt-3 flex items-center gap-4">
        <button type="button" className="btn btn-secondary" disabled={pending || value === note} onClick={() => run(() => updateOrderStatus(orderId, status, value))}>
          Guardar nota
        </button>
        <FeedbackText feedback={feedback} pending={pending} />
      </div>
    </div>
  );
}
