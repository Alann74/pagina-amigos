// Avisos por mail a INEDITA que manda el navegador (pedido web, registro mayorista). FormSubmit rechaza
// los envíos que salen de los servidores de Vercel (403 de su protección anti-bots) y acepta los del
// navegador, que es como está pensado. Va como formulario común (sin consulta previa de CORS) y con
// keepalive, así sale aunque la página pase enseguida a WhatsApp.

export type BrowserNotice = { url: string; subject: string; fields: Record<string, string>; cc?: string[] };

/** `cc`: copias a otras casillas (no hace falta activarlas). */
export function formSubmitNotice(to: string, subject: string, fields: Record<string, string>, cc: string[] = []): BrowserNotice {
  return { url: `https://formsubmit.co/ajax/${encodeURIComponent(to)}`, subject, fields, ...(cc.length ? { cc } : {}) };
}

/** Manda el aviso sin esperar respuesta. Nunca tira error. */
export function sendBrowserNotice(notice: BrowserNotice | null | undefined): void {
  if (!notice?.url?.startsWith("https://formsubmit.co/ajax/")) return;
  const body = new URLSearchParams({ ...notice.fields, _subject: notice.subject, _template: "table", _captcha: "false" });
  if (notice.cc?.length) body.set("_cc", notice.cc.join(","));
  try {
    void fetch(notice.url, { method: "POST", body, headers: { Accept: "application/json" }, keepalive: true }).catch(() => {});
  } catch {
    // sin red o navegador viejo: el pedido o el registro ya quedaron guardados igual
  }
}
