import Link from "next/link";

export default function ShopNotFound() {
  return (
    <div className="flex flex-col items-center px-6 py-28 text-center">
      <p className="label text-mute">Error 404</p>
      <h1 className="mt-3 text-[20px] font-light uppercase tracking-[0.12em]">No encontramos esta página</h1>
      <p className="mt-3 max-w-sm text-[14px] text-mute">Puede que el producto ya no esté disponible o que el link haya cambiado.</p>
      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <Link href="/productos" className="btn btn-primary">Ver colección</Link>
        <Link href="/" className="btn btn-secondary">Ir al inicio</Link>
      </div>
    </div>
  );
}
