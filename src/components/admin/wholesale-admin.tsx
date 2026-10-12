"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { approveWholesaleCustomer, fetchSheetCsv, saveWholesalePrices, saveWholesaleSettings, setWholesaleCustomerStatus, setWholesaleExistingCustomer } from "@/app/admin/actions";
import { CopyButton } from "@/components/admin/copy-button";
import { Field, FeedbackText, Section, Toggle, parseMoney, useAction } from "@/components/admin/ui";
import { WhatsAppIcon } from "@/components/icons";
import { formatDate, formatPrice } from "@/lib/format";
import { SALES_CHANNELS, type WholesaleSettings } from "@/lib/wholesale-config";
import { toWhatsappNumber, whatsappUrl } from "@/lib/whatsapp";
import { csvToRows, normalizeName, parsePriceTable, type Cell, type PriceRow } from "@/lib/wholesale-import";

type Row = { id: number; name: string; articleCode: string | null; price: number; wholesalePrice: number | null; visible: boolean; categoryName: string | null };
type Change = { id: number; name: string; articleCode: string | null; from: number | null; to: number };
type Preview = { changes: Change[]; same: number; unknown: PriceRow[]; missing: Row[] };
export type Customer = {
  id: number;
  name: string;
  business: string | null;
  taxId: string | null;
  phone: string;
  email: string;
  city: string;
  instagram: string | null;
  salesChannel: string | null;
  comment: string | null;
  status: string; // pendiente, aprobado, rechazado, baja
  existingCustomer: boolean; // ya era clienta: sin mínimo en la primera compra
  createdAt: string;
  approvedAt: string | null;
  lastLoginAt: string | null;
  orders: number;
  lastOrderAt: string | null;
};

export function WholesaleAdmin({ config, link, customers, rows }: { config: WholesaleSettings; link: string; customers: Customer[]; rows: Row[] }) {
  return (
    <>
      <Customers customers={customers} firstOrderMinUnits={config.firstOrderMinUnits} />
      <AccessSettings config={config} link={link} />
      <PriceImport rows={rows} />
      <PriceTable rows={rows} />
    </>
  );
}

function AccessSettings({ config, link }: { config: WholesaleSettings; link: string }) {
  const [form, setForm] = useState({ ...config, minAmountText: config.minAmount ? String(config.minAmount) : "" });
  const action = useAction();
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }));
  const share = `Hola! Para comprar por mayor en INEDITA registrate acá con los datos de tu negocio: ${link} · Cuando te aprobamos te llega por WhatsApp tu código para ver los precios.`;

  return (
    <Section title="Acceso" aside={<FeedbackText feedback={action.feedback} pending={action.pending} />}>
      <div className="grid max-w-3xl gap-6 sm:grid-cols-2">
        <div className="flex items-center gap-3 sm:col-span-2">
          <Toggle checked={form.enabled} onChange={(v) => set("enabled", v)} label="Acceso mayorista activo" />
          <span className="text-[14px]">{form.enabled ? "Activo: se pueden registrar y los aprobados ven los precios por mayor" : "Desactivado: nadie ve los precios por mayor ni se puede registrar"}</span>
        </div>
        <Field label="Descuento extra efectivo/transferencia (%)" htmlFor="ws-cash" hint="0 = los precios por mayor ya son finales.">
          <input id="ws-cash" className="field" inputMode="numeric" value={form.cashDiscountPercent} onChange={(e) => set("cashDiscountPercent", Number(e.target.value.replace(/\D/g, "")) || 0)} />
        </Field>
        <Field label="Compra mínima ($)" htmlFor="ws-min" hint="Vacío = sin mínimo.">
          <input id="ws-min" className="field" inputMode="numeric" placeholder="Sin mínimo" value={form.minAmountText} onChange={(e) => set("minAmountText", e.target.value)} />
        </Field>
        <Field label="Mínimo de prendas en la primera compra" htmlFor="ws-first-units" hint="Para cada mayorista nuevo. A las que aprobás como “ya es mi clienta” no se les pide. 0 = sin mínimo.">
          <input
            id="ws-first-units"
            className="field"
            inputMode="numeric"
            value={form.firstOrderMinUnits}
            onChange={(e) => set("firstOrderMinUnits", Number(e.target.value.replace(/\D/g, "")) || 0)}
          />
        </Field>
        <Field label="Mínimo de prendas en todos los pedidos" htmlFor="ws-units" hint="Para todas, en cada pedido. 0 = sin mínimo.">
          <input id="ws-units" className="field" inputMode="numeric" value={form.minUnits} onChange={(e) => set("minUnits", Number(e.target.value.replace(/\D/g, "")) || 0)} />
        </Field>
        <Field label="Texto para mayoristas" htmlFor="ws-note" hint="Se ve en la bolsa al armar el pedido.">
          <textarea id="ws-note" className="field min-h-16" value={form.note} onChange={(e) => set("note", e.target.value)} maxLength={400} />
        </Field>
      </div>
      <button
        type="button"
        className="btn btn-primary mt-6"
        disabled={action.pending}
        onClick={() =>
          action.run(() =>
            saveWholesaleSettings({
              enabled: form.enabled,
              minAmount: parseMoney(form.minAmountText) ?? 0,
              minUnits: form.minUnits,
              firstOrderMinUnits: form.firstOrderMinUnits,
              cashDiscountPercent: form.cashDiscountPercent,
              note: form.note,
            }),
          )
        }
        data-testid="wholesale-save"
      >
        Guardar
      </button>
      <div className="mt-8 max-w-3xl border border-line p-4 sm:p-5">
        <p className="label text-mute">Link para registrarse</p>
        <p className="mt-2 break-all text-[15px]">{link}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <CopyButton text={link} label="Copiar link" />
          <CopyButton text={share} label="Copiar mensaje" />
          <a href={`https://wa.me/?text=${encodeURIComponent(share)}`} target="_blank" rel="noopener" className="btn btn-secondary gap-2">
            <WhatsAppIcon size={16} /> Mandar por WhatsApp
          </a>
        </div>
      </div>
    </Section>
  );
}

const CHANNEL_LABEL: Record<string, string> = Object.fromEntries(SALES_CHANNELS.map((c) => [c.id, c.label]));
const STATUS_LABEL: Record<string, string> = { pendiente: "Pendiente", aprobado: "Aprobado", rechazado: "Rechazado", baja: "Sin acceso" };

type Approved = { id: number; name: string; code: string; whatsapp: string; text: string };

function csvCell(v: string | number | null): string {
  const t = v === null ? "" : String(v);
  return `"${t.replace(/"/g, '""')}"`;
}

/** Planilla para Excel (separada por ";" y con BOM para que respete los acentos). */
function downloadCsv(customers: Customer[]) {
  const head = ["Nombre", "Negocio", "CUIT/DNI", "WhatsApp", "Mail", "Localidad", "Instagram", "Cómo vende", "Comentario", "Estado", "Registro", "Aprobado", "Último ingreso", "Pedidos", "Último pedido", "Ya era clienta"];
  const lines = customers.map((c) =>
    [
      c.name,
      c.business,
      c.taxId,
      c.phone,
      c.email,
      c.city,
      c.instagram ? `@${c.instagram}` : null,
      c.salesChannel ? (CHANNEL_LABEL[c.salesChannel] ?? c.salesChannel) : null,
      c.comment,
      STATUS_LABEL[c.status] ?? c.status,
      formatDate(c.createdAt),
      c.approvedAt ? formatDate(c.approvedAt) : null,
      c.lastLoginAt ? formatDate(c.lastLoginAt) : null,
      c.orders,
      c.lastOrderAt ? formatDate(c.lastOrderAt) : null,
      c.existingCustomer ? "Sí" : "No",
    ]
      .map(csvCell)
      .join(";"),
  );
  const blob = new Blob(["﻿" + [head.map(csvCell).join(";"), ...lines].join("\r\n")], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `mayoristas-inedita-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

function Customers({ customers, firstOrderMinUnits }: { customers: Customer[]; firstOrderMinUnits: number }) {
  const router = useRouter();
  const action = useAction();
  const [justApproved, setJustApproved] = useState<Approved[]>([]);
  // En las solicitudes pendientes: ¿ya es clienta? (por defecto, clienta nueva con el mínimo de primera compra)
  const [existing, setExisting] = useState<Record<number, boolean>>({});
  const [query, setQuery] = useState("");
  const pending = customers.filter((c) => c.status === "pendiente");
  const approved = customers.filter((c) => c.status === "aprobado");
  const others = customers.filter((c) => c.status === "rechazado" || c.status === "baja");
  const shownApproved = useMemo(() => {
    const q = normalizeName(query);
    return q ? approved.filter((c) => normalizeName(`${c.name} ${c.business ?? ""} ${c.city} ${c.email} ${c.phone}`).includes(q)) : approved;
  }, [approved, query]);

  const approve = (c: Customer, existingCustomer?: boolean) => {
    if (c.status === "aprobado" && !window.confirm(`¿Generar un código nuevo para ${c.name}? El que tiene ahora deja de funcionar.`)) return;
    action.run(async () => {
      const res = await approveWholesaleCustomer(c.id, existingCustomer);
      if (res.ok) {
        setJustApproved((list) => [{ id: c.id, name: c.name, code: res.code, whatsapp: res.whatsapp, text: res.text }, ...list.filter((a) => a.id !== c.id)]);
        router.refresh();
      }
      return res;
    });
  };
  const changeExisting = (c: Customer, value: boolean) => action.run(() => setWholesaleExistingCustomer(c.id, value), () => router.refresh());
  const changeStatus = (c: Customer, status: "rechazado" | "baja" | "pendiente", question: string) => {
    if (question && !window.confirm(question)) return;
    action.run(
      () => setWholesaleCustomerStatus(c.id, status),
      () => {
        setJustApproved((list) => list.filter((a) => a.id !== c.id));
        router.refresh();
      },
    );
  };

  return (
    <Section
      title={`Clientes mayoristas (${approved.length} ${approved.length === 1 ? "aprobado" : "aprobados"}${pending.length ? ` · ${pending.length} por revisar` : ""})`}
      aside={
        <div className="flex items-center gap-3">
          <FeedbackText feedback={action.feedback} pending={action.pending} />
          {customers.length ? (
            <button type="button" className="label underline underline-offset-4" onClick={() => downloadCsv(customers)} data-testid="wholesale-csv">
              Descargar planilla
            </button>
          ) : null}
        </div>
      }
    >
      {justApproved.map((a) => (
        <div key={a.id} className="mb-4 max-w-3xl border-2 border-ink p-4 sm:p-5" data-testid="wholesale-approved">
          <p className="text-[14px]">
            <strong>{a.name}</strong> ya tiene acceso. Su código personal es{" "}
            <span className="font-mono text-[16px] tracking-[0.12em]" data-testid="wholesale-new-code">
              {a.code}
            </span>
          </p>
          <p className="mt-1 text-[12.5px] text-mute">Mandáselo ahora: por seguridad el código no se guarda y no se vuelve a mostrar (si lo pierde, le generás uno nuevo).</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <a href={a.whatsapp} target="_blank" rel="noopener" className="btn btn-primary gap-2" data-testid="wholesale-send-code">
              <WhatsAppIcon size={16} /> Mandar por WhatsApp
            </a>
            <CopyButton text={a.text} label="Copiar mensaje" />
            <button type="button" className="btn btn-secondary" onClick={() => setJustApproved((list) => list.filter((x) => x.id !== a.id))}>
              Listo
            </button>
          </div>
        </div>
      ))}

      {customers.length === 0 ? (
        <p className="max-w-2xl text-[14px] leading-relaxed text-mute">Todavía no se registró nadie. Compartí el link de registro (más abajo) con tus clientes mayoristas.</p>
      ) : null}

      {pending.length ? (
        <div className="grid max-w-5xl gap-3 lg:grid-cols-2">
          {pending.map((c) => (
            <article key={c.id} className="border border-ink p-4" data-testid="wholesale-pending">
              <CustomerData c={c} />
              {firstOrderMinUnits > 0 ? (
                <fieldset className="mt-4">
                  <legend className="label text-mute">Primera compra</legend>
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    {[
                      { value: false, label: "Clienta nueva", hint: `Mínimo ${firstOrderMinUnits} prendas` },
                      { value: true, label: "Ya es mi clienta", hint: "Sin mínimo" },
                    ].map((o) => {
                      const checked = (existing[c.id] ?? false) === o.value;
                      return (
                        <label key={o.label} className={`flex cursor-pointer gap-2 border p-2.5 text-[13px] ${checked ? "border-ink" : "border-line"}`}>
                          <input
                            type="radio"
                            name={`existing-${c.id}`}
                            checked={checked}
                            onChange={() => setExisting((m) => ({ ...m, [c.id]: o.value }))}
                            className="mt-0.5 h-4 w-4 shrink-0 appearance-none rounded-full border border-ink checked:border-[5px]"
                          />
                          <span>
                            {o.label}
                            <span className="block text-[12px] text-mute">{o.hint}</span>
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </fieldset>
              ) : null}
              <div className="mt-4 flex flex-wrap gap-2">
                <button type="button" className="btn btn-primary" disabled={action.pending} onClick={() => approve(c, existing[c.id] ?? false)} data-testid="wholesale-approve">
                  Aprobar
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  disabled={action.pending}
                  onClick={() => changeStatus(c, "rechazado", `¿Rechazar la solicitud de ${c.name}? No ve los precios por mayor (queda guardada en la lista de rechazados).`)}
                >
                  Rechazar
                </button>
              </div>
            </article>
          ))}
        </div>
      ) : customers.length ? (
        <p className="text-[14px] text-mute">No hay solicitudes nuevas para revisar.</p>
      ) : null}

      {approved.length ? (
        <div className="mt-8">
          <div className="flex flex-wrap items-center gap-3">
            <p className="label">Aprobados</p>
            {approved.length > 8 ? (
              <input className="field max-w-xs" placeholder="Buscar nombre, negocio, localidad…" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Buscar mayorista" />
            ) : null}
          </div>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[880px] text-[13px]">
              <thead>
                <tr className="label border-b border-line text-left text-mute">
                  <th className="py-2 pr-3 font-normal">Cliente</th>
                  <th className="py-2 pr-3 font-normal">Contacto</th>
                  <th className="py-2 pr-3 font-normal">Localidad</th>
                  <th className="py-2 pr-3 text-right font-normal">Pedidos</th>
                  <th className="py-2 pr-3 font-normal">Primera compra</th>
                  <th className="py-2 pr-3 font-normal">Último ingreso</th>
                  <th className="py-2 font-normal" />
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {shownApproved.map((c) => (
                  <tr key={c.id} data-testid="wholesale-customer-row">
                    <td className="py-2 pr-3">
                      {c.name}
                      {c.business ? <span className="block text-mute">{c.business}</span> : null}
                    </td>
                    <td className="py-2 pr-3">
                      <a href={whatsappUrl(toWhatsappNumber(c.phone), `Hola ${c.name.split(/\s+/)[0]}! Te escribimos de INEDITA.`)} target="_blank" rel="noopener" className="underline underline-offset-2">
                        {c.phone}
                      </a>
                      <a href={`mailto:${c.email}`} className="block text-mute underline-offset-2 hover:underline">
                        {c.email}
                      </a>
                    </td>
                    <td className="py-2 pr-3">{c.city}</td>
                    <td className="py-2 pr-3 text-right tabular-nums">
                      {c.orders}
                      {c.lastOrderAt ? <span className="block text-mute">{formatDate(c.lastOrderAt)}</span> : null}
                    </td>
                    <td className="py-2 pr-3">
                      <select
                        className="border-b border-line bg-transparent py-1 text-[13px] focus:border-ink focus:outline-none"
                        value={c.existingCustomer ? "si" : "no"}
                        disabled={action.pending}
                        onChange={(e) => changeExisting(c, e.target.value === "si")}
                        aria-label={`Primera compra de ${c.name}`}
                        data-testid="wholesale-existing"
                      >
                        <option value="no">{firstOrderMinUnits > 0 ? `Clienta nueva (mín. ${firstOrderMinUnits})` : "Clienta nueva"}</option>
                        <option value="si">Ya es clienta (sin mínimo)</option>
                      </select>
                      {!c.existingCustomer && c.orders > 0 && firstOrderMinUnits > 0 ? <span className="block text-[12px] text-mute">Ya hizo su primera compra</span> : null}
                    </td>
                    <td className="py-2 pr-3">{c.lastLoginAt ? formatDate(c.lastLoginAt, true) : <span className="text-mute">Todavía no entró</span>}</td>
                    <td className="py-2 text-right">
                      <div className="flex justify-end gap-3 whitespace-nowrap">
                        <button type="button" className="label underline underline-offset-4" disabled={action.pending} onClick={() => approve(c)}>
                          Código nuevo
                        </button>
                        <button
                          type="button"
                          className="label underline underline-offset-4"
                          disabled={action.pending}
                          onClick={() => changeStatus(c, "baja", `¿Quitarle el acceso a ${c.name}? Deja de ver los precios por mayor al instante.`)}
                        >
                          Quitar acceso
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {others.length ? (
        <details className="mt-8 max-w-5xl">
          <summary className="label cursor-pointer text-mute">Rechazados y sin acceso ({others.length})</summary>
          <div className="mt-3 grid gap-3 lg:grid-cols-2">
            {others.map((c) => (
              <article key={c.id} className="border border-line p-4">
                <CustomerData c={c} />
                <div className="mt-4 flex flex-wrap gap-2">
                  <button type="button" className="btn btn-secondary" disabled={action.pending} onClick={() => approve(c)}>
                    Aprobar
                  </button>
                  <button type="button" className="btn btn-secondary" disabled={action.pending} onClick={() => changeStatus(c, "pendiente", "")}>
                    Volver a pendiente
                  </button>
                </div>
              </article>
            ))}
          </div>
        </details>
      ) : null}
    </Section>
  );
}

function CustomerData({ c }: { c: Customer }) {
  const firstName = c.name.split(/\s+/)[0];
  return (
    <>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-[15px]">
          <strong className="font-medium">{c.name}</strong>
          {c.business ? <span className="text-mute"> · {c.business}</span> : null}
        </p>
        <p className="label text-mute">
          {c.status === "pendiente" ? "" : `${STATUS_LABEL[c.status] ?? c.status} · `}
          {formatDate(c.createdAt, true)}
        </p>
      </div>
      <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-[13px]">
        <dt className="text-mute">WhatsApp</dt>
        <dd>
          <a href={whatsappUrl(toWhatsappNumber(c.phone), `Hola ${firstName}! Te escribimos de INEDITA por tu registro como mayorista.`)} target="_blank" rel="noopener" className="underline underline-offset-2">
            {c.phone}
          </a>
        </dd>
        <dt className="text-mute">Mail</dt>
        <dd className="break-all">
          <a href={`mailto:${c.email}`} className="underline underline-offset-2">
            {c.email}
          </a>
        </dd>
        <dt className="text-mute">Localidad</dt>
        <dd>{c.city}</dd>
        {c.taxId ? (
          <>
            <dt className="text-mute">CUIT/DNI</dt>
            <dd>{c.taxId}</dd>
          </>
        ) : null}
        {c.instagram ? (
          <>
            <dt className="text-mute">Instagram</dt>
            <dd>
              <a href={`https://instagram.com/${encodeURIComponent(c.instagram)}`} target="_blank" rel="noopener" className="underline underline-offset-2">
                @{c.instagram}
              </a>
            </dd>
          </>
        ) : null}
        {c.salesChannel ? (
          <>
            <dt className="text-mute">Vende</dt>
            <dd>{CHANNEL_LABEL[c.salesChannel] ?? c.salesChannel}</dd>
          </>
        ) : null}
        {c.comment ? (
          <>
            <dt className="text-mute">Comentario</dt>
            <dd className="whitespace-pre-line">{c.comment}</dd>
          </>
        ) : null}
      </dl>
    </>
  );
}

function buildPreview(parsed: PriceRow[], rows: Row[]): Preview {
  const byCode = new Map(rows.filter((r) => r.articleCode).map((r) => [r.articleCode!, r]));
  const byName = new Map(rows.map((r) => [normalizeName(r.name), r]));
  const changes = new Map<number, Change>();
  const unknown: PriceRow[] = [];
  let same = 0;
  for (const p of parsed) {
    // Por número de artículo; si el producto no tiene artículo cargado, por nombre
    const row = (p.code ? byCode.get(p.code) : undefined) ?? (p.name ? byName.get(normalizeName(p.name)) : undefined);
    if (!row) {
      unknown.push(p);
      continue;
    }
    if (row.wholesalePrice === p.price) same++;
    else changes.set(row.id, { id: row.id, name: row.name, articleCode: row.articleCode, from: row.wholesalePrice, to: p.price });
  }
  const touched = new Set(parsed.map((p) => (p.code ? byCode.get(p.code)?.id : undefined) ?? byName.get(normalizeName(p.name))?.id));
  const missing = rows.filter((r) => r.visible && !touched.has(r.id) && !r.wholesalePrice);
  return { changes: [...changes.values()], same, unknown, missing };
}

function PriceImport({ rows }: { rows: Row[] }) {
  const router = useRouter();
  const [preview, setPreview] = useState<Preview | null>(null);
  const [source, setSource] = useState<string>("");
  const [sheetLink, setSheetLink] = useState("");
  const [paste, setPaste] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [reading, setReading] = useState(false);
  const action = useAction();

  const load = (table: Cell[][], label: string) => {
    const parsed = parsePriceTable(table);
    if (parsed.length === 0) {
      setError("No encontramos precios en la planilla. Tiene que tener una columna con el número de artículo (o el nombre) y otra con el precio.");
      setPreview(null);
      return;
    }
    setError(null);
    setSource(`${label}: ${parsed.length} filas con precio`);
    setPreview(buildPreview(parsed, rows));
  };

  const readFile = async (file: File | undefined) => {
    if (!file) return;
    setReading(true);
    try {
      if (/\.xlsx$/i.test(file.name)) {
        const { readSheet } = await import("read-excel-file/universal");
        load((await readSheet(file)) as Cell[][], file.name);
      } else if (/\.(csv|txt|tsv)$/i.test(file.name)) {
        load(csvToRows(await file.text()), file.name);
      } else setError("Subí un archivo .xlsx (Excel) o .csv. Si es .xls viejo, guardalo como .xlsx.");
    } catch {
      setError("No se pudo leer el archivo. Probá guardarlo de nuevo como .xlsx o .csv.");
    } finally {
      setReading(false);
    }
  };

  const readSheetLink = async () => {
    setReading(true);
    setError(null);
    const res = await fetchSheetCsv(sheetLink);
    setReading(false);
    if (!res.ok) return setError(res.error);
    load(csvToRows(res.csv), "Google Sheets");
  };

  return (
    <Section title="Importar precios por mayor" aside={<FeedbackText feedback={action.feedback} pending={action.pending} />}>
      <p className="max-w-2xl text-[14px] leading-relaxed">
        Subí la planilla de precios por mayor (Excel o CSV) o pegá el link de Google Sheets. Se cruza por <strong>número de artículo</strong> (y por nombre si el producto no tiene artículo). Antes de aplicar ves todos los cambios.
      </p>
      <div className="mt-5 grid max-w-3xl gap-4 lg:grid-cols-2">
        <div className="border border-line p-4">
          <p className="label text-mute">Archivo</p>
          <label className="btn btn-secondary mt-3 cursor-pointer">
            {reading ? "Leyendo…" : "Elegir Excel o CSV"}
            <input
              type="file"
              accept=".xlsx,.csv,.tsv,.txt"
              className="sr-only"
              onChange={(e) => {
                void readFile(e.target.files?.[0]);
                e.target.value = "";
              }}
              data-testid="wholesale-file"
            />
          </label>
        </div>
        <div className="border border-line p-4">
          <p className="label text-mute">Google Sheets</p>
          <div className="mt-3 flex gap-2">
            <input className="field flex-1" placeholder="https://docs.google.com/spreadsheets/d/…" value={sheetLink} onChange={(e) => setSheetLink(e.target.value)} />
            <button type="button" className="btn btn-secondary" disabled={!sheetLink || reading} onClick={() => void readSheetLink()}>
              Leer
            </button>
          </div>
        </div>
        <details className="border border-line p-4 lg:col-span-2">
          <summary className="label cursor-pointer text-mute">O pegar desde Excel (copiar las columnas artículo, nombre y precio)</summary>
          <textarea className="field mt-3 min-h-28 font-mono text-[12px]" value={paste} onChange={(e) => setPaste(e.target.value)} placeholder={"39601\tRemera Niro\t$25,300"} />
          <button type="button" className="btn btn-secondary mt-3" disabled={!paste.trim()} onClick={() => load(csvToRows(paste), "Texto pegado")}>
            Ver cambios
          </button>
        </details>
      </div>
      {error ? (
        <p className="mt-4 max-w-3xl border border-ink p-3 text-[13px]" role="alert">
          {error}
        </p>
      ) : null}

      {preview ? (
        <div className="mt-6 max-w-3xl border border-ink p-4 sm:p-5" data-testid="wholesale-preview">
          <p className="text-[14px]">
            {source} · <strong>{preview.changes.length}</strong> cambios · {preview.same} sin cambios
            {preview.unknown.length ? ` · ${preview.unknown.length} que no están en la tienda` : ""}
          </p>
          {preview.changes.length ? (
            <div className="mt-4 max-h-80 overflow-y-auto">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="label text-left text-mute">
                    <th className="py-2 pr-3 font-normal">Producto</th>
                    <th className="py-2 pr-3 text-right font-normal">Antes</th>
                    <th className="py-2 text-right font-normal">Nuevo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {preview.changes.map((c) => (
                    <tr key={c.id}>
                      <td className="py-2 pr-3">
                        {c.name} <span className="text-mute">{c.articleCode ? `· ${c.articleCode}` : ""}</span>
                      </td>
                      <td className="py-2 pr-3 text-right tabular-nums text-mute">{c.from ? formatPrice(c.from) : "—"}</td>
                      <td className="py-2 text-right tabular-nums">{formatPrice(c.to)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
          {preview.unknown.length ? (
            <details className="mt-3 text-[13px]">
              <summary className="cursor-pointer text-mute">Filas sin producto en la tienda ({preview.unknown.length})</summary>
              <ul className="mt-2 list-disc pl-5 text-mute">
                {preview.unknown.slice(0, 80).map((u, i) => (
                  <li key={i}>
                    {u.code ?? "sin artículo"} · {u.name} · {formatPrice(u.price)}
                  </li>
                ))}
              </ul>
            </details>
          ) : null}
          {preview.missing.length ? (
            <details className="mt-3 text-[13px]">
              <summary className="cursor-pointer text-mute">Productos publicados que siguen sin precio por mayor ({preview.missing.length})</summary>
              <ul className="mt-2 list-disc pl-5 text-mute">
                {preview.missing.slice(0, 80).map((m) => (
                  <li key={m.id}>
                    {m.articleCode ?? "—"} · {m.name}
                  </li>
                ))}
              </ul>
            </details>
          ) : null}
          <div className="mt-5 flex flex-wrap gap-3">
            <button
              type="button"
              className="btn btn-primary"
              disabled={action.pending || preview.changes.length === 0}
              onClick={() =>
                action.run(
                  () => saveWholesalePrices(preview.changes.map((c) => ({ id: c.id, wholesalePrice: c.to }))),
                  () => {
                    setPreview(null);
                    router.refresh();
                  },
                )
              }
              data-testid="wholesale-apply"
            >
              Aplicar {preview.changes.length} cambios
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => setPreview(null)}>
              Cancelar
            </button>
          </div>
        </div>
      ) : null}
    </Section>
  );
}

function PriceTable({ rows }: { rows: Row[] }) {
  const router = useRouter();
  const [edits, setEdits] = useState<Record<number, string>>({});
  const [query, setQuery] = useState("");
  const action = useAction();
  const withPrice = rows.filter((r) => r.wholesalePrice).length;
  const shown = useMemo(() => {
    const q = normalizeName(query);
    return q ? rows.filter((r) => normalizeName(`${r.name} ${r.articleCode ?? ""}`).includes(q)) : rows;
  }, [rows, query]);
  const pending = Object.entries(edits)
    .map(([id, value]) => ({ id: Number(id), wholesalePrice: value.trim() ? parseMoney(value) : null }))
    .filter((c) => c.wholesalePrice === null || (c.wholesalePrice ?? 0) > 0);

  return (
    <Section title={`Precios por mayor (${withPrice} de ${rows.length})`} aside={<FeedbackText feedback={action.feedback} pending={action.pending} />}>
      <div className="flex flex-wrap items-center gap-3">
        <input className="field max-w-xs" placeholder="Buscar producto o artículo" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Buscar" />
        {pending.length ? (
          <button
            type="button"
            className="btn btn-primary"
            disabled={action.pending}
            onClick={() =>
              action.run(
                () => saveWholesalePrices(pending),
                () => {
                  setEdits({});
                  router.refresh();
                },
              )
            }
          >
            Guardar {pending.length} {pending.length === 1 ? "cambio" : "cambios"}
          </button>
        ) : null}
      </div>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[560px] text-[13px]">
          <thead>
            <tr className="label border-b border-line text-left text-mute">
              <th className="py-2 pr-3 font-normal">Producto</th>
              <th className="py-2 pr-3 text-right font-normal">Tienda</th>
              <th className="py-2 pr-3 text-right font-normal">Por mayor</th>
              <th className="py-2 text-right font-normal">Diferencia</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {shown.map((r) => {
              const value = edits[r.id] ?? (r.wholesalePrice ? String(r.wholesalePrice) : "");
              const current = parseMoney(value);
              return (
                <tr key={r.id} className={r.visible ? "" : "text-mute"}>
                  <td className="py-2 pr-3">
                    {r.name} <span className="text-mute">{r.articleCode ? `· ${r.articleCode}` : ""}</span>
                  </td>
                  <td className="py-2 pr-3 text-right tabular-nums">{formatPrice(r.price)}</td>
                  <td className="py-1 pr-3 text-right">
                    <input
                      className="w-28 border-b border-line bg-transparent py-1 text-right tabular-nums focus:border-ink focus:outline-none"
                      inputMode="numeric"
                      value={value}
                      placeholder="—"
                      onChange={(e) => setEdits((m) => ({ ...m, [r.id]: e.target.value }))}
                      aria-label={`Precio por mayor de ${r.name}`}
                    />
                  </td>
                  <td className="py-2 text-right tabular-nums text-mute">{current ? `${Math.round((1 - current / r.price) * 100)}% menos` : ""}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Section>
  );
}
