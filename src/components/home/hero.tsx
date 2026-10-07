import Image from "@/components/safe-image";
import Link from "next/link";
import type { SiteSettings } from "@/lib/site-config";

export function Hero({ hero, fallbackImages }: { hero: SiteSettings["hero"]; fallbackImages: string[] }) {
  const image = hero.imageUrl ?? fallbackImages[0] ?? null;
  const pair = hero.imageUrl ? (hero.secondaryImageUrl ? [hero.imageUrl, hero.secondaryImageUrl] : null) : fallbackImages.length >= 2 ? fallbackImages.slice(0, 2) : null;
  const split = !hero.videoUrl && pair !== null;
  const mobileImage = hero.mobileImageUrl ?? image;
  return (
    <section className="relative h-[calc(100svh-5.25rem)] min-h-[480px] w-full overflow-hidden bg-soft sm:h-[calc(100svh-6rem)] lg:max-h-[960px]" aria-label="Portada">
      {split ? (
        <div className="absolute inset-0 grid lg:grid-cols-2">
          <div className="relative">
            {mobileImage && mobileImage !== pair[0] ? (
              <>
                <Image src={mobileImage} alt="" fill priority sizes="100vw" className="object-cover lg:hidden" />
                <Image src={pair[0]} alt="" fill priority sizes="50vw" className="hidden object-cover lg:block" />
              </>
            ) : (
              <Image src={pair[0]} alt="" fill priority sizes="(min-width: 1024px) 50vw, 100vw" className="object-cover" />
            )}
          </div>
          <div className="relative hidden lg:block">
            <Image src={pair[1]} alt="" fill priority sizes="50vw" className="object-cover" />
          </div>
        </div>
      ) : hero.videoUrl ? (
        <video className="absolute inset-0 h-full w-full object-cover" src={hero.videoUrl} autoPlay muted loop playsInline poster={image ?? undefined} />
      ) : image ? (
        <>
          {mobileImage && mobileImage !== image ? (
            <Image src={mobileImage} alt="" fill priority sizes="100vw" className="object-cover sm:hidden" />
          ) : null}
          <Image src={image} alt="" fill priority sizes="100vw" className={`object-cover ${mobileImage && mobileImage !== image ? "hidden sm:block" : ""}`} />
        </>
      ) : null}
      <div className="absolute inset-0 bg-gradient-to-t from-ink/35 via-transparent to-transparent" aria-hidden />
      <div className="absolute inset-x-0 bottom-0 flex flex-col items-start gap-4 px-5 pb-10 text-paper sm:px-10 sm:pb-14">
        {hero.eyebrow ? <p className="label animate-slide-up">{hero.eyebrow}</p> : null}
        <h1 className="max-w-xl animate-slide-up text-[28px] font-light uppercase leading-[1.05] tracking-[0.06em] sm:text-[44px]">{hero.title}</h1>
        <Link href={hero.ctaHref} className="btn mt-2 animate-slide-up border border-paper bg-paper text-ink hover:bg-transparent hover:text-paper">
          {hero.ctaLabel}
        </Link>
      </div>
    </section>
  );
}
