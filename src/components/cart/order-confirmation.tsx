"use client";

import { useEffect, useRef, useState } from "react";
import { CheckIcon, CopyIcon, WhatsAppIcon } from "@/components/icons";

export function OrderActions({ whatsappUrl, message }: { whatsappUrl: string; message: string }) {
  const [copied, setCopied] = useState(false);
  const opened = useRef(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("abrir") === "1" && !opened.current) {
      opened.current = true;
      window.history.replaceState(window.history.state, "", window.location.pathname);
      // Mobile / navegador de Instagram: navegar directo abre la app de WhatsApp
      window.location.href = whatsappUrl;
    }
  }, [whatsappUrl]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(message);
    } catch {
      const area = document.createElement("textarea");
      area.value = message;
      document.body.appendChild(area);
      area.select();
      document.execCommand("copy");
      area.remove();
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2200);
  };

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <a href={whatsappUrl} className="btn btn-primary w-full" data-testid="open-whatsapp">
        <WhatsAppIcon size={16} /> Abrir WhatsApp
      </a>
      <button type="button" onClick={copy} className="btn btn-secondary w-full" data-testid="copy-message">
        {copied ? <CheckIcon size={16} /> : <CopyIcon size={16} />}
        {copied ? "Mensaje copiado" : "Copiar mensaje"}
      </button>
    </div>
  );
}
