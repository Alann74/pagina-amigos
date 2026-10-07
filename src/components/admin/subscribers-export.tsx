"use client";

type Row = { email: string; phone: string; code: string; discountPercent: number; createdAt: string; usedAt: string | null; orderNumber: number | null; utmSource: string | null; utmCampaign: string | null; landingPath: string | null };

const cell = (v: unknown) => {
  const s = v === null || v === undefined ? "" : String(v);
  return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** CSV para Excel (separador ; y BOM), listo para importar en Meta, Mailchimp o una planilla. */
export function SubscribersExport({ rows }: { rows: Row[] }) {
  const download = () => {
    const header = ["fecha", "mail", "whatsapp", "codigo", "descuento", "usado", "pedido", "utm_source", "utm_campaign", "entro_por"];
    const lines = rows.map((r) =>
      [r.createdAt.slice(0, 10), r.email, r.phone, r.code, `${r.discountPercent}%`, r.usedAt ? r.usedAt.slice(0, 10) : "", r.orderNumber ?? "", r.utmSource, r.utmCampaign, r.landingPath].map(cell).join(";"),
    );
    const blob = new Blob(["﻿" + [header.join(";"), ...lines].join("\r\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `clientas-inedita-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };
  return (
    <button type="button" className="label border border-ink px-3 py-2 hover:bg-ink hover:text-paper" onClick={download}>
      Descargar CSV
    </button>
  );
}
