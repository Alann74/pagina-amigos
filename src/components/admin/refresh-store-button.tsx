"use client";

import { refreshStore } from "@/app/admin/actions";
import { FeedbackText, useAction } from "@/components/admin/ui";

/** Rearma todas las páginas de la tienda (por si algún cambio no se ve en otro celular o computadora). */
export function RefreshStoreButton() {
  const action = useAction();
  return (
    <div className="flex flex-wrap items-center gap-3">
      <button type="button" className="btn btn-secondary" disabled={action.pending} onClick={() => action.run(() => refreshStore())} data-testid="refresh-store">
        Actualizar tienda
      </button>
      <FeedbackText feedback={action.feedback} pending={action.pending} />
    </div>
  );
}
