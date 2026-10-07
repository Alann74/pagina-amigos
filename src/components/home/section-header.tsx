import Link from "next/link";

export function SectionHeader({ title, href, linkLabel = "Ver todo" }: { title: string; href?: string; linkLabel?: string }) {
  return (
    <div className="flex items-end justify-between px-4 pb-5 sm:px-8 sm:pb-6">
      <h2 className="text-[12px] font-medium uppercase tracking-[0.24em] sm:text-[13px]">{title}</h2>
      {href ? (
        <Link href={href} className="nav-link link-underline pb-0.5">
          {linkLabel}
        </Link>
      ) : null}
    </div>
  );
}
