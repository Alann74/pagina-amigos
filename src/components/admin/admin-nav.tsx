"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export const ADMIN_LINKS = [
  { href: "/admin", label: "Inicio" },
  { href: "/admin/pedidos", label: "Pedidos" },
  { href: "/admin/productos", label: "Productos" },
  { href: "/admin/precios", label: "Precios" },
  { href: "/admin/csv", label: "CSV" },
  { href: "/admin/fotos", label: "Fotos" },
  { href: "/admin/configuracion", label: "Configuración" },
  { href: "/admin/arrepentimientos", label: "Arrepentimientos" },
  { href: "/admin/instalacion", label: "Instalación" },
];

export function AdminNavLinks({ active }: { active?: string | null }) {
  return (
    <ul className="scrollbar-none flex gap-6 overflow-x-auto px-4 sm:px-8">
      {ADMIN_LINKS.map((l) => {
        const on = active ? (l.href === "/admin" ? active === "/admin" : active.startsWith(l.href)) : false;
        return (
          <li key={l.href} className="shrink-0">
            <Link href={l.href} className={`nav-link flex h-11 items-center border-b ${on ? "border-ink text-ink" : "border-transparent text-mute hover:text-ink"}`} aria-current={on ? "page" : undefined}>
              {l.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

export function AdminNav() {
  const pathname = usePathname();
  return <AdminNavLinks active={pathname} />;
}
