"use client";

import { useSearchParams } from "next/navigation";
import { useMemo } from "react";
import { PageTitle } from "@/components/page-title";
import { ProductListing } from "@/components/product/product-listing";
import { GridSkeleton } from "@/components/skeletons";
import { searchEntries } from "@/lib/search";
import { useSearchIndex } from "@/lib/use-search-index";

export function SearchResults() {
  const q = useSearchParams().get("q")?.trim() ?? "";
  const index = useSearchIndex(true);
  const results = useMemo(() => (index && q ? searchEntries(index, q, 200) : []), [index, q]);
  if (!index) return <GridSkeleton />;
  return (
    <>
      <PageTitle title={q ? `Resultados para “${q}”` : "Buscar"} count={results.length} />
      <ProductListing key={q} products={results} emptyText={q ? "No encontramos productos. Probá con otra palabra o consultanos por WhatsApp." : "Escribí qué estás buscando."} />
    </>
  );
}
