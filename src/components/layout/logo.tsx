import Link from "next/link";

export function Logo({ className = "" }: { className?: string }) {
  return (
    <Link href="/" aria-label="INEDITA — inicio" className={`inline-block select-none ${className}`}>
      <span className="block pl-[0.32em] text-[15px] font-semibold leading-none tracking-[0.32em] sm:text-[17px]">INEDITA</span>
    </Link>
  );
}
