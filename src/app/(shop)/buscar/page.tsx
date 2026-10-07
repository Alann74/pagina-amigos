import type { Metadata } from "next";
import { Suspense } from "react";
import { SearchResults } from "@/components/search-results";
import { GridSkeleton } from "@/components/skeletons";

export const metadata: Metadata = { title: "Buscar", robots: { index: false, follow: true } };

export default function SearchPage() {
  return (
    <Suspense fallback={<GridSkeleton />}>
      <SearchResults />
    </Suspense>
  );
}
