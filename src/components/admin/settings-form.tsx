"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { saveSettings } from "@/app/admin/actions";
import { CheckboxRow, Field, FeedbackText, Section, parseMoney, useAction } from "@/components/admin/ui";
import { ImageField } from "@/components/admin/image-field";
import { formatPrice } from "@/lib/format";
import type { SiteSettings } from "@/lib/site-config";

export function SettingsForm({ initial }: { initial: SiteSettings }) {
  const router = useRouter();
  const [s, setS] = useState<SiteSettings>(initial);
  const [threshold, setThreshold] = useState(initial.freeShippingThreshold ? String(initial.freeShippingThreshold) : "");
  const { pending, feedback, setFeedback, run } = useAction();

  const set = <K extends keyof SiteSettings>(k: K, v: SiteSettings[K]) => setS((prev) => ({ ...prev, [k]: v }));
  const setHero = (patch: Partial<SiteSettings["hero"]>) => setS((prev) => ({ ...prev, hero: { ...prev.hero, ...patch } }));
  const setAnn = (patch: Partial<SiteSettings["announcement"]>) => setS((prev) => ({ ...prev, announcement: { ...prev.announcement, ...patch } }));
  const setPromo = (patch: Partial<SiteSettings["promo"]>) => setS((prev) => ({ ...prev, promo: { ...prev.promo, ...patch } }));
  const setWelcome = (patch: Partial<SiteSettings["welcome"]>) => setS((prev) => ({ ...prev, welcome: { ...prev.welcome, ...patch } }));

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const wa = s.whatsappNumber.replace(/\D/g, "");
    if (!/^549\d{10}$/.test(wa)) return setFeedback({ kind: "error", text: "El WhatsApp tiene que tener el formato 549 + característica + número (ej. 5493412550777)" });
    const value: SiteSettings = { ...s, whatsappNumber: wa, freeShippingThreshold: parseMoney(threshold) || null, storeHours: s.storeHours.filter((h) => h.days.trim() || h.hours.trim()) };
    run(() => saveSettings("site", value), () => router.refresh());
  }

  return (
    <form onSubmit={submit}>
      <Section title="WhatsApp y contacto">
        <div className="grid gap-6 sm:grid-cols-2">
          <Field label="Número de WhatsApp" htmlFor="s-wa" hint="Formato internacional sin + ni espacios: 5493412550777. Acá llegan los pedidos.">
            <input id="s-wa" className="field tabular-nums" value={s.whatsappNumber} onChange={(e) => set("whatsappNumber", e.target.value)} inputMode="numeric" required />
          </Field>
          <Field label="Instagram" htmlFor="s-ig" hint="Usuario sin @">
            <input id="s-ig" className="field" value={s.instagram} onChange={(e) => set("instagram", e.target.value.replace(/^@/, ""))} />
          </Field>
          <Field label="Dirección del local" htmlFor="s-addr">
            <input id="s-addr" className="field" value={s.address} onChange={(e) => set("address", e.target.value)} />
          </Field>
          <Field label="Búsqueda en Google Maps" htmlFor="s-maps" hint="Lo que se busca en el mapa de Contacto">
            <input id="s-maps" className="field" value={s.mapsQuery} onChange={(e) => set("mapsQuery", e.target.value)} />
          </Field>
          <Field label="CUIT" htmlFor="s-cuit">
            <input id="s-cuit" className="field tabular-nums" value={s.cuit} onChange={(e) => set("cuit", e.target.value)} />
          </Field>
        </div>
      </Section>

      <Section title="Horarios del local">
        <ul className="space-y-3">
          {s.storeHours.map((h, i) => (
            <li key={i} className="grid grid-cols-[1fr_1fr_auto] items-end gap-4">
              <input aria-label="Días" className="field" value={h.days} placeholder="Lunes a sábados" onChange={(e) => set("storeHours", s.storeHours.map((x, j) => (j === i ? { ...x, days: e.target.value } : x)))} />
              <input aria-label="Horario" className="field" value={h.hours} placeholder="10 a 19 hs" onChange={(e) => set("storeHours", s.storeHours.map((x, j) => (j === i ? { ...x, hours: e.target.value } : x)))} />
              <button type="button" className="label h-11 px-2 text-mute hover:text-ink" onClick={() => set("storeHours", s.storeHours.filter((_, j) => j !== i))}>
                Quitar
              </button>
            </li>
          ))}
        </ul>
        <button type="button" className="label mt-4 border border-ink px-3 py-2 hover:bg-ink hover:text-paper" onClick={() => set("storeHours", [...s.storeHours, { days: "", hours: "" }])}>
          Agregar horario
        </button>
      </Section>

      <Section title="Barra de anuncios">
        <CheckboxRow checked={s.announcement.enabled} onChange={(v) => setAnn({ enabled: v })} label="Mostrar la barra arriba de todo" />
        <div className="mt-4 grid gap-6 sm:grid-cols-[2fr_1fr]">
          <Field label="Texto" htmlFor="s-ann" hint="Separá los mensajes con “·”: en el celular rotan de a uno.">
            <input id="s-ann" className="field" value={s.announcement.text} onChange={(e) => setAnn({ text: e.target.value })} maxLength={200} />
          </Field>
          <Field label="Link (opcional)" htmlFor="s-ann-href" hint="Ej.: /productos">
            <input id="s-ann-href" className="field" value={s.announcement.href ?? ""} onChange={(e) => setAnn({ href: e.target.value || null })} />
          </Field>
        </div>
      </Section>

      <Section title="Portada (hero)">
        <div className="grid gap-6 sm:grid-cols-2">
          <Field label="Texto chico" htmlFor="s-eyebrow">
            <input id="s-eyebrow" className="field" value={s.hero.eyebrow} onChange={(e) => setHero({ eyebrow: e.target.value })} maxLength={60} />
          </Field>
          <Field label="Título" htmlFor="s-title">
            <input id="s-title" className="field" value={s.hero.title} onChange={(e) => setHero({ title: e.target.value })} maxLength={80} />
          </Field>
          <Field label="Texto del botón" htmlFor="s-cta">
            <input id="s-cta" className="field" value={s.hero.ctaLabel} onChange={(e) => setHero({ ctaLabel: e.target.value })} maxLength={40} />
          </Field>
          <Field label="Link del botón" htmlFor="s-cta-href" hint="Ej.: /productos o /categoria/vestidos">
            <input id="s-cta-href" className="field" value={s.hero.ctaHref} onChange={(e) => setHero({ ctaHref: e.target.value })} />
          </Field>
        </div>
        <div className="mt-8 grid gap-8 sm:grid-cols-3">
          <ImageField label="Foto principal" name="portada" value={s.hero.imageUrl} onChange={(url) => setHero({ imageUrl: url })} hint="Si no hay, se usan fotos de productos nuevos." />
          <ImageField label="Segunda foto (escritorio)" name="portada-2" value={s.hero.secondaryImageUrl} onChange={(url) => setHero({ secondaryImageUrl: url })} hint="Opcional: en compu se ven dos fotos verticales." />
          <ImageField label="Foto para celular" name="portada-celular" value={s.hero.mobileImageUrl} onChange={(url) => setHero({ mobileImageUrl: url })} hint="Opcional: vertical." />
        </div>
        <div className="mt-6 max-w-xl">
          <Field label="Video (opcional)" htmlFor="s-video" hint="URL de un .mp4 corto y liviano. Si está, reemplaza a la foto.">
            <input id="s-video" className="field" value={s.hero.videoUrl ?? ""} onChange={(e) => setHero({ videoUrl: e.target.value || null })} />
          </Field>
        </div>
      </Section>

      <Section title="Promociones y etiquetas">
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="% OFF efectivo / transferencia" htmlFor="s-disc">
            <input id="s-disc" className="field tabular-nums" value={s.promo.cashDiscountPercent} onChange={(e) => setPromo({ cashDiscountPercent: Math.min(90, Math.max(0, Number(e.target.value.replace(/\D/g, "")) || 0)) })} inputMode="numeric" />
          </Field>
          <Field label="Cuotas sin interés" htmlFor="s-inst" hint="0 para no mostrar">
            <input id="s-inst" className="field tabular-nums" value={s.promo.installments} onChange={(e) => setPromo({ installments: Math.min(24, Number(e.target.value.replace(/\D/g, "")) || 0) })} inputMode="numeric" />
          </Field>
          <Field label="Envío gratis desde" htmlFor="s-free" hint={parseMoney(threshold) ? `Se muestra la barra de progreso hasta ${formatPrice(parseMoney(threshold)!)}` : "Vacío = no se muestra la barra"}>
            <input id="s-free" className="field tabular-nums" value={threshold} onChange={(e) => setThreshold(e.target.value)} inputMode="numeric" placeholder="Ej. 150000" />
          </Field>
          <Field label="Días con etiqueta NUEVO" htmlFor="s-newdays">
            <input id="s-newdays" className="field tabular-nums" value={s.newProductDays} onChange={(e) => set("newProductDays", Math.min(120, Number(e.target.value.replace(/\D/g, "")) || 0))} inputMode="numeric" />
          </Field>
          <Field label="ÚLTIMAS UNIDADES con stock ≤" htmlFor="s-low" hint="Solo para variantes con stock controlado">
            <input id="s-low" className="field tabular-nums" value={s.lowStockThreshold} onChange={(e) => set("lowStockThreshold", Math.min(50, Number(e.target.value.replace(/\D/g, "")) || 0))} inputMode="numeric" />
          </Field>
        </div>
      </Section>

      <Section title="Pop-up de bienvenida">
        <p className="mb-4 max-w-2xl text-[13px] text-mute">
          Aparece una vez a quien entra por primera vez: deja su mail y WhatsApp y recibe un código para su primera compra pagando en efectivo o transferencia (no se suma al descuento de efectivo: queda el mayor). Las suscriptas se ven en Clientas.
        </p>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          <div className="sm:col-span-2 lg:col-span-3">
            <CheckboxRow checked={s.welcome.enabled} onChange={(v) => setWelcome({ enabled: v })} label="Mostrar el pop-up" />
          </div>
          <Field label="% OFF de bienvenida" htmlFor="s-wpct">
            <input id="s-wpct" className="field tabular-nums" value={s.welcome.percent} onChange={(e) => setWelcome({ percent: Math.min(90, Number(e.target.value.replace(/\D/g, "")) || 0) })} inputMode="numeric" />
          </Field>
          <Field label="Aparece a los (segundos)" htmlFor="s-wdelay" hint="O antes, si baja por la página">
            <input id="s-wdelay" className="field tabular-nums" value={s.welcome.delaySeconds} onChange={(e) => setWelcome({ delaySeconds: Math.min(120, Number(e.target.value.replace(/\D/g, "")) || 0) })} inputMode="numeric" />
          </Field>
          <Field label="Título" htmlFor="s-wtitle">
            <input id="s-wtitle" className="field" value={s.welcome.title} onChange={(e) => setWelcome({ title: e.target.value })} maxLength={80} />
          </Field>
          <div className="sm:col-span-2 lg:col-span-3">
            <Field label="Texto" htmlFor="s-wtext">
              <textarea id="s-wtext" className="field min-h-16" value={s.welcome.text} onChange={(e) => setWelcome({ text: e.target.value })} maxLength={240} />
            </Field>
          </div>
        </div>
      </Section>

      <div className="sticky bottom-0 z-20 -mx-4 mt-12 flex items-center gap-4 border-t border-line bg-paper/95 px-4 py-4 backdrop-blur-sm sm:-mx-8 sm:px-8">
        <button type="submit" className="btn btn-primary min-w-48" disabled={pending} data-testid="save-settings">
          Guardar cambios
        </button>
        <FeedbackText feedback={feedback} pending={pending} />
      </div>
    </form>
  );
}
