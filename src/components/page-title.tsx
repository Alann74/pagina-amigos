export function PageTitle({ title, subtitle, count }: { title: string; subtitle?: string; count?: number }) {
  return (
    <div className="px-4 pb-6 pt-8 sm:px-8 sm:pb-8 sm:pt-12">
      <h1 className="text-[13px] font-medium uppercase tracking-[0.24em] sm:text-sm">{title}</h1>
      {subtitle ? <p className="mt-2 max-w-xl text-[13px] text-mute">{subtitle}</p> : null}
      {typeof count === "number" ? <p className="label mt-2 text-mute sm:hidden">{count} productos</p> : null}
    </div>
  );
}
