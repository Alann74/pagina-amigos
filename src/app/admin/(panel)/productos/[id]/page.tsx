import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ProductEditor } from "@/components/admin/product-editor";
import { AdminLoading } from "@/components/admin/ui";
import { adminGate, getAdminProduct } from "@/lib/admin-data";
import { getSettings } from "@/lib/catalog";

export const metadata: Metadata = { title: "Editar producto" };

export default function EditProductPage(props: PageProps<"/admin/productos/[id]">) {
  return (
    <Suspense fallback={<AdminLoading />}>
      <Editor params={props.params} />
    </Suspense>
  );
}

async function Editor({ params }: { params: PageProps<"/admin/productos/[id]">["params"] }) {
  await adminGate();
  const { id } = await params;
  const [data, settings] = await Promise.all([/^\d+$/.test(id) ? getAdminProduct(Number(id)) : null, getSettings()]);
  if (!data) notFound();
  const { product } = data;
  return (
    <>
      <Link href="/admin/productos" className="nav-link text-mute hover:text-ink">
        ← Productos
      </Link>
      <div className="mb-8 mt-4 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[20px] font-light uppercase tracking-[0.14em]">{product.name}</h1>
          <p className="mt-1 text-[13px] text-mute">
            {product.articleCode ? `Artículo ${product.articleCode}` : "Sin número de artículo"} · {product.visible ? "Publicado" : "Oculto"}
          </p>
        </div>
        {product.visible ? (
          <Link href={`/producto/${product.slug}`} target="_blank" className="nav-link link-underline">
            Ver en la tienda ↗
          </Link>
        ) : null}
      </div>
      <ProductEditor
        key={product.id}
        product={product}
        variants={data.variants}
        images={data.images}
        categories={data.categories}
        colors={data.colors}
        sold={data.sold}
        discount={settings.promo.cashDiscountPercent}
      />
    </>
  );
}
