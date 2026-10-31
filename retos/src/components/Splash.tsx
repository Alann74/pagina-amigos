"use client";
import { useCallback, useEffect, useState } from "react";
import { Mascot } from "./Mascot";
import { useSettings } from "./Settings";

/** Pantalla de entrada: el mono sonriendo con humo. Una vez por sesión; se cierra sola o al tocar. */
export function Splash() {
  const { reduced } = useSettings();
  const [show, setShow] = useState(false);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    try { if (sessionStorage.getItem("retos:splash")) return; sessionStorage.setItem("retos:splash", "1"); } catch { /* sin storage: se muestra siempre */ }
    setShow(true);
  }, []);
  const close = useCallback(() => { setLeaving(true); setTimeout(() => setShow(false), 450); }, []);
  useEffect(() => {
    if (!show) return;
    const t = setTimeout(close, reduced ? 1500 : 3400);
    const k = (e: KeyboardEvent) => { if (e.key === "Escape" || e.key === "Enter" || e.key === " ") close(); };
    window.addEventListener("keydown", k);
    return () => { clearTimeout(t); window.removeEventListener("keydown", k); };
  }, [show, reduced, close]);

  if (!show) return null;
  return (
    <div className={`splash${leaving ? " is-leaving" : ""}`} role="dialog" aria-label="Boca Abajo" onClick={close}>
      <div className="splash-inner">
        <Mascot className="splash-mascot" />
        <p className="splash-logo" aria-hidden="true"><span>Boca</span> <span>Abajo</span></p>
        <p className="splash-tap">Tocá para entrar</p>
      </div>
    </div>
  );
}
