// Vista previa de la ruleta de humo para pruebas visuales. Solo existe con RETOS_TEST_MODE=1 (en producción da 404).
import { notFound } from "next/navigation";
import { Preview } from "./preview";

export const dynamic = "force-dynamic";

export default function Page() {
  if (process.env.RETOS_TEST_MODE !== "1") notFound();
  return <Preview />;
}
