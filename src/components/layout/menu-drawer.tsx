"use client";

import Link from "next/link";
import { Drawer } from "@/components/layout/drawer";
import { InstagramIcon, WhatsAppIcon } from "@/components/icons";
import { useUi } from "@/stores/ui";

type MenuCategory = { slug: string; name: string };

export function MenuDrawer({ categories, whatsappHref, instagram }: { categories: MenuCategory[]; whatsappHref: string; instagram: string }) {
  const open = useUi((s) => s.menuOpen);
  const setMenu = useUi((s) => s.setMenu);
  const close = () => setMenu(false);
  return (
    <Drawer open={open} onClose={close} side="left" title="Menú" widthClass="max-w-[400px]" testId="menu-drawer">
      <nav className="px-5 pb-10 pt-4" aria-label="Categorías">
        <ul className="space-y-1">
          <li>
            <Link href="/productos?orden=nuevos" onClick={close} className="block py-2 text-[15px] font-medium uppercase tracking-[0.12em]">
              Nuevos ingresos
            </Link>
          </li>
          <li>
            <Link href="/productos" onClick={close} className="block py-2 text-[15px] font-medium uppercase tracking-[0.12em]">
              Ver todo
            </Link>
          </li>
        </ul>
        <ul className="mt-6 space-y-0.5 border-t border-line pt-6">
          {categories.map((c) => (
            <li key={c.slug}>
              <Link href={`/categoria/${c.slug}`} onClick={close} className="block py-1.5 text-[15px] uppercase tracking-[0.12em]">
                {c.name}
              </Link>
            </li>
          ))}
        </ul>
        <ul className="mt-8 space-y-2 border-t border-line pt-6 text-sm text-mute">
          <li>
            <Link href="/favoritos" onClick={close} className="nav-link">
              Favoritos
            </Link>
          </li>
          <li>
            <Link href="/guia-de-talles" onClick={close} className="nav-link">
              Guía de talles
            </Link>
          </li>
          <li>
            <Link href="/envios" onClick={close} className="nav-link">
              Envíos
            </Link>
          </li>
          <li>
            <Link href="/cambios-y-devoluciones" onClick={close} className="nav-link">
              Cambios y devoluciones
            </Link>
          </li>
          <li>
            <Link href="/contacto" onClick={close} className="nav-link">
              Contacto
            </Link>
          </li>
        </ul>
        <div className="mt-8 flex gap-3">
          <a href={whatsappHref} target="_blank" rel="noopener" className="btn btn-secondary flex-1" aria-label="Escribinos por WhatsApp">
            <WhatsAppIcon size={18} /> WhatsApp
          </a>
          <a href={`https://instagram.com/${instagram}`} target="_blank" rel="noopener" className="btn btn-secondary flex-1" aria-label="Instagram">
            <InstagramIcon size={18} /> Instagram
          </a>
        </div>
      </nav>
    </Drawer>
  );
}
