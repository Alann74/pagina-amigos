import type { Metadata } from "next";
import { Suspense } from "react";
import { WhatsAppIcon } from "@/components/icons";
import { WithdrawalStatus } from "@/components/admin/withdrawal-status";
import { AdminLoading, AdminTitle } from "@/components/admin/ui";
import { adminGate, getWithdrawals } from "@/lib/admin-data";
import { formatDate, formatWithdrawalNumber } from "@/lib/format";
import { toWhatsappNumber, whatsappUrl } from "@/lib/whatsapp";

export const metadata: Metadata = { title: "Arrepentimientos" };

export default function WithdrawalsPage() {
  return (
    <>
      <AdminTitle title="Botón de arrepentimiento" subtitle="Solicitudes de revocación de compra (Ley 24.240, art. 34). Respondé dentro de las 24 hs hábiles." />
      <Suspense fallback={<AdminLoading />}>
        <List />
      </Suspense>
    </>
  );
}

async function List() {
  await adminGate();
  const rows = await getWithdrawals();
  if (rows.length === 0) return <p className="text-[14px] text-mute">No hay solicitudes.</p>;
  return (
    <ul className="divide-y divide-line">
      {rows.map((r) => {
        const code = formatWithdrawalNumber(r.number);
        return (
          <li key={r.id} className="flex flex-wrap items-start justify-between gap-4 py-4">
            <div className="min-w-0 flex-1 text-[14px]">
              <p className="font-medium tabular-nums">
                {code} <span className="font-normal">· {r.name}</span>
              </p>
              <p className="mt-0.5 text-[12px] text-mute">
                {formatDate(r.createdAt, true)} · {r.phone}
                {r.email ? ` · ${r.email}` : ""}
                {r.orderReference ? ` · Pedido: ${r.orderReference}` : ""}
              </p>
              {r.detail ? <p className="mt-2 text-[13px]">{r.detail}</p> : null}
            </div>
            <div className="flex items-center gap-3">
              <a href={whatsappUrl(toWhatsappNumber(r.phone), `Hola ${r.name.split(" ")[0]}! Te escribimos de INEDITA por tu solicitud de arrepentimiento ${code}.`)} target="_blank" rel="noopener" className="flex h-9 w-9 items-center justify-center border border-line hover:border-ink" aria-label={`Escribirle a ${r.name} por WhatsApp`}>
                <WhatsAppIcon size={16} />
              </a>
              <WithdrawalStatus id={r.id} status={r.status} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
