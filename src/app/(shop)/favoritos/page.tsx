import type { Metadata } from "next";
import { FavoritesView } from "@/components/favorites-view";

export const metadata: Metadata = { title: "Favoritos", robots: { index: false, follow: true } };

export default function FavoritesPage() {
  return <FavoritesView />;
}
