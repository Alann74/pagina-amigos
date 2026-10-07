import type { Metadata } from "next";
import { Checkout } from "@/components/cart/checkout";

export const metadata: Metadata = { title: "Tu bolsa", robots: { index: false, follow: false } };

export default function CartPage() {
  return <Checkout />;
}
