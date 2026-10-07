import { ProductCard } from "@/components/product/product-card";
import type { SearchEntry } from "@/lib/search";

export function ProductGrid({ products, testId }: { products: SearchEntry[]; testId?: string }) {
  return (
    <ul className="grid grid-cols-2 gap-x-1 gap-y-8 px-1 sm:gap-x-2 sm:px-2 lg:grid-cols-4 lg:gap-x-3 lg:gap-y-12 lg:px-3" data-testid={testId}>
      {products.map((p) => (
        <li key={p.id}>
          <ProductCard product={p} />
        </li>
      ))}
    </ul>
  );
}
