import { revalidateTag } from "next/cache";
import { z } from "zod";
import { isAdmin } from "@/lib/admin-guard";
import { TAGS } from "@/lib/catalog";
import { importArticlePhotos, applyDrivePhoto } from "@/lib/drive-import";

export const maxDuration = 60;

const bodySchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("article"), article: z.string().regex(/^\d{4,6}$/), skip: z.array(z.string().max(100)).max(300).optional() }),
  z.object({ action: z.literal("use"), target: z.enum(["hero", "hero2", "look"]), driveId: z.string().min(10).max(100), codes: z.array(z.string()).max(10) }),
]);

export async function POST(request: Request) {
  if (!(await isAdmin())) return Response.json({ error: "No autorizado" }, { status: 401 });
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Datos inválidos" }, { status: 400 });
  const body = parsed.data;
  try {
    if (body.action === "article") {
      const result = await importArticlePhotos(body.article, 3, body.skip ?? []);
      if (result.imported) revalidateTag(TAGS.catalog, { expire: 0 });
      return Response.json(result);
    }
    const url = await applyDrivePhoto(body.target, body.driveId, body.codes);
    revalidateTag(TAGS.settings, { expire: 0 });
    revalidateTag(TAGS.catalog, { expire: 0 });
    return Response.json({ ok: true, url });
  } catch (error) {
    console.error("[drive-import]", error);
    return Response.json({ error: error instanceof Error ? error.message : "Error" }, { status: 500 });
  }
}
