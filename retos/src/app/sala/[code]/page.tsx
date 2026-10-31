import { Game } from "@/components/Game";
import { normalizeCode } from "@/lib/engine";

export const metadata = { title: "Sala · Boca Abajo", robots: { index: false } };

export default async function SalaPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return <Game code={normalizeCode(code)} />;
}
