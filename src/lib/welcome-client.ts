"use client";

// Código de bienvenida guardado en el navegador después de suscribirse en el pop-up.
// Estado del pop-up: "dismissed" (lo cerró: no se vuelve a mostrar por unos días) o "subscribed".

export type WelcomeCode = { code: string; percent: number };

const CODE_KEY = "inedita-bienvenida";
const POPUP_KEY = "inedita-popup";

export function readWelcome(): WelcomeCode | null {
  try {
    const v = JSON.parse(localStorage.getItem(CODE_KEY) ?? "null");
    return v && typeof v.code === "string" && typeof v.percent === "number" ? v : null;
  } catch {
    return null;
  }
}

export function saveWelcome(value: WelcomeCode) {
  try {
    localStorage.setItem(CODE_KEY, JSON.stringify(value));
    localStorage.setItem(POPUP_KEY, JSON.stringify({ state: "subscribed", at: Date.now() }));
  } catch {}
}

export function forgetWelcome() {
  try {
    localStorage.removeItem(CODE_KEY);
  } catch {}
}

/** Si corresponde mostrar el pop-up: nunca a quien ya se suscribió; a quien lo cerró, recién a los 7 días. */
export function popupAllowed(): boolean {
  try {
    const v = JSON.parse(localStorage.getItem(POPUP_KEY) ?? "null") as { state?: string; at?: number } | null;
    if (!v) return true;
    if (v.state === "subscribed") return false;
    return Date.now() - (v.at ?? 0) > 7 * 24 * 60 * 60 * 1000;
  } catch {
    return false;
  }
}

export function markPopupDismissed() {
  try {
    localStorage.setItem(POPUP_KEY, JSON.stringify({ state: "dismissed", at: Date.now() }));
  } catch {}
}
