import Link from "next/link";
import { AnnouncementTicker } from "@/components/layout/announcement-ticker";
import { getSettings } from "@/lib/catalog";

export async function AnnouncementBar() {
  const settings = await getSettings();
  const { enabled, text, href } = settings.announcement;
  if (!enabled || !text.trim()) return null;
  const content = <AnnouncementTicker text={text} />;
  return (
    <div className="flex h-8 items-center justify-center bg-ink text-paper" role="region" aria-label="Anuncio">
      {href ? (
        <Link href={href} className="w-full">
          {content}
        </Link>
      ) : (
        content
      )}
    </div>
  );
}
