import { revalidateTag } from "next/cache";
import { isAdmin } from "@/lib/admin-guard";
import { TAGS } from "@/lib/catalog";
import { prepareDatabase } from "@/lib/install";

export const maxDuration = 60;

export async function POST() {
  if (!(await isAdmin())) return Response.json({ error: "No autorizado" }, { status: 401 });
  try {
    const summary = await prepareDatabase();
    revalidateTag(TAGS.catalog, { expire: 0 });
    revalidateTag(TAGS.settings, { expire: 0 });
    return Response.json({ ok: true, summary });
  } catch (error) {
    console.error("[setup]", error);
    return Response.json({ error: error instanceof Error ? error.message : "Error" }, { status: 500 });
  }
}
