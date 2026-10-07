import type { Metadata } from "next";
import { WithdrawalForm } from "@/components/withdrawal-form";

export const metadata: Metadata = {
  title: "Botón de arrepentimiento",
  description: "Solicitá la revocación de tu compra dentro de los 10 días corridos (Ley 24.240, art. 34).",
  alternates: { canonical: "/arrepentimiento" },
};

export default function WithdrawalPage() {
  return (
    <div className="mx-auto max-w-[640px] px-5 pb-16 pt-10 sm:px-8 sm:pt-16">
      <h1 className="text-[13px] font-medium uppercase tracking-[0.24em] sm:text-sm">Botón de arrepentimiento</h1>
      <div className="prose-inedita mt-8">
        <p>
          Si compraste a distancia, podés revocar la compra dentro de los <strong>10 días corridos</strong> desde que recibiste el producto o desde la
          compra, lo último que ocurra, sin costo ni explicación (Ley 24.240, art. 34, y Resolución 424/2020).
        </p>
        <p>Completá el formulario y te damos un código de seguimiento. El producto tiene que estar sin uso y con sus etiquetas.</p>
      </div>
      <WithdrawalForm />
    </div>
  );
}
