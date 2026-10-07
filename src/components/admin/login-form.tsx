"use client";

import { useActionState } from "react";
import { useSearchParams } from "next/navigation";
import { login } from "@/app/admin/actions";

export function LoginForm() {
  const params = useSearchParams();
  const [state, action, pending] = useActionState(login, undefined);
  return (
    <form action={action} className="space-y-8">
      <input type="hidden" name="next" value={params.get("next") ?? "/admin"} />
      <div>
        <label htmlFor="password" className="label text-mute">
          Contraseña
        </label>
        <input id="password" name="password" type="password" required autoComplete="current-password" autoFocus className="field" data-testid="admin-password" />
      </div>
      {state?.error ? (
        <p role="alert" className="text-[13px] font-medium">
          {state.error}
        </p>
      ) : null}
      <button type="submit" className="btn btn-primary w-full" disabled={pending}>
        {pending ? "Entrando…" : "Entrar"}
      </button>
    </form>
  );
}
