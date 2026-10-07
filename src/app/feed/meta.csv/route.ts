import Papa from "papaparse";
import { getFeedItems } from "@/lib/feed";

export async function GET() {
  const items = await getFeedItems();
  const csv = Papa.unparse(items.map((i) => ({ ...i, additional_image_link: i.additional_image_link.join(",") })));
  return new Response(csv, { headers: { "Content-Type": "text/csv; charset=utf-8", "Cache-Control": "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400" } });
}
