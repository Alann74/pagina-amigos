import Link from "next/link";
import { Suspense } from "react";
import { AdminNav, AdminNavLinks } from "@/components/admin/admin-nav";
import { AdminLoading } from "@/components/admin/ui";
import { logout } from "@/app/admin/actions";

export default function PanelLayout({ children }: LayoutProps<"/admin">) {
  return (
    <>
      <header className="sticky top-0 z-30 border-b border-line bg-paper/95 backdrop-blur-sm">
        <div className="flex h-13 items-center justify-between px-4 sm:px-8">
          <Link href="/admin" className="flex items-baseline gap-3">
            <span className="pl-[0.32em] text-[15px] font-medium tracking-[0.32em]">INEDITA</span>
            <span className="label text-mute">Admin</span>
          </Link>
          <div className="flex items-center gap-5">
            <Link href="/" target="_blank" className="nav-link text-mute hover:text-ink">
              Ver tienda
            </Link>
            <form action={logout}>
              <button type="submit" className="nav-link text-mute hover:text-ink">
                Salir
              </button>
            </form>
          </div>
        </div>
        <nav aria-label="Secciones del admin">
          <Suspense fallback={<AdminNavLinks />}>
            <AdminNav />
          </Suspense>
        </nav>
      </header>
      <main className="mx-auto max-w-[1400px] px-4 pb-24 pt-8 sm:px-8">
        <Suspense fallback={<AdminLoading />}>{children}</Suspense>
      </main>
    </>
  );
}
