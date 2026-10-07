"use client";

import { useState } from "react";
import { updateWithdrawalStatus } from "@/app/admin/actions";
import { FeedbackText, useAction } from "@/components/admin/ui";

export function WithdrawalStatus({ id, status }: { id: number; status: string }) {
  const [value, setValue] = useState(status);
  const { pending, feedback, run } = useAction();
  return (
    <div className="flex items-center gap-3">
      <select
        aria-label="Estado"
        value={value}
        disabled={pending}
        onChange={(e) => {
          setValue(e.target.value);
          run(() => updateWithdrawalStatus(id, e.target.value));
        }}
        className={`h-9 border px-2 text-[13px] ${value === "nuevo" ? "border-ink bg-ink text-paper" : "border-line bg-paper"}`}
      >
        <option value="nuevo">Nuevo</option>
        <option value="en curso">En curso</option>
        <option value="resuelto">Resuelto</option>
      </select>
      {feedback?.kind === "error" ? <FeedbackText feedback={feedback} /> : null}
    </div>
  );
}
