"use client";

// Guarda de dónde viene la visita (UTMs, Instagram, anuncios) para adjuntarlo a cada pedido.

export type Attribution = {
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  utmContent: string | null;
  utmTerm: string | null;
  trafficSource: string;
  referrer: string | null;
  landingPath: string | null;
  capturedAt: number;
};

const KEY = "inedita-attribution";
const TTL = 30 * 24 * 60 * 60 * 1000;

function classify(params: URLSearchParams, referrer: string, ua: string): string {
  const source = params.get("utm_source")?.toLowerCase();
  const medium = params.get("utm_medium")?.toLowerCase() ?? "";
  if (source) {
    if (/ig|instagram/.test(source)) return medium.includes("story") ? "instagram-historia" : /paid|cpc|ads?/.test(medium) ? "instagram-anuncio" : "instagram";
    if (/fb|facebook|meta/.test(source)) return /paid|cpc|ads?/.test(medium) ? "meta-anuncio" : "facebook";
    return source;
  }
  if (params.get("fbclid")) return /instagram/i.test(ua) ? "instagram-anuncio" : "meta-anuncio";
  if (params.get("gclid")) return "google-anuncio";
  if (/instagram/i.test(ua) || /instagram\.com/.test(referrer)) return "instagram";
  if (/FBAN|FBAV/i.test(ua) || /facebook\.com/.test(referrer)) return "facebook";
  if (/google\./.test(referrer)) return "google";
  if (/whatsapp|wa\.me/.test(referrer)) return "whatsapp";
  if (referrer) {
    try {
      return new URL(referrer).hostname.replace(/^www\./, "");
    } catch {
      return "referido";
    }
  }
  return "directo";
}

export function captureAttribution(): void {
  try {
    const params = new URLSearchParams(window.location.search);
    const hasCampaign = ["utm_source", "utm_medium", "utm_campaign", "fbclid", "gclid"].some((k) => params.has(k));
    const stored = readAttribution();
    const externalReferrer = document.referrer && !document.referrer.startsWith(window.location.origin) ? document.referrer : "";
    // Última interacción con campaña gana; si no hay campaña, se respeta la que ya estaba guardada
    if (!hasCampaign && stored && Date.now() - stored.capturedAt < TTL) return;
    if (!hasCampaign && !externalReferrer && stored) return;
    const data: Attribution = {
      utmSource: params.get("utm_source"),
      utmMedium: params.get("utm_medium"),
      utmCampaign: params.get("utm_campaign"),
      utmContent: params.get("utm_content"),
      utmTerm: params.get("utm_term"),
      trafficSource: classify(params, externalReferrer, navigator.userAgent),
      referrer: externalReferrer || null,
      landingPath: window.location.pathname + window.location.search,
      capturedAt: Date.now(),
    };
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    // localStorage no disponible (modo privado): seguimos sin atribución
  }
}

export function readAttribution(): Attribution | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Attribution) : null;
  } catch {
    return null;
  }
}
