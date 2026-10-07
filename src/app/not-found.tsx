import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-6 text-center">
      <Link href="/" className="pl-[0.32em] text-[17px] font-semibold tracking-[0.32em]">INEDITA</Link>
      <p className="label mt-16 text-mute">Error 404</p>
      <h1 className="mt-3 text-[20px] font-light uppercase tracking-[0.12em]">No encontramos esta página</h1>
      <p className="mt-3 max-w-sm text-[14px] text-mute">Puede que el link haya cambiado. Seguí recorriendo la colección.</p>
      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <Link href="/productos" className="btn btn-primary">Ver colección</Link>
        <Link href="/" className="btn btn-secondary">Ir al inicio</Link>
      </div>
    </div>
  );
}
