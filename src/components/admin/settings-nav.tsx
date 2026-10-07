import Link from "next/link";

const LINKS = [
  { href: "/admin/configuracion", label: "General" },
  { href: "/admin/configuracion/textos", label: "Textos" },
  { href: "/admin/configuracion/categorias", label: "Categorías" },
  { href: "/admin/configuracion/look", label: "Comprá el look" },
] as const;

export function SettingsNav({ active }: { active: (typeof LINKS)[number]["href"] }) {
  return (
    <div className="mb-8 flex flex-wrap gap-2">
      {LINKS.map((l) => (
        <Link key={l.href} href={l.href} className={`label border px-3 py-2 ${l.href === active ? "border-ink bg-ink text-paper" : "border-line hover:border-ink"}`}>
          {l.label}
        </Link>
      ))}
    </div>
  );
}
