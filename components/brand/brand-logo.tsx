import Image from "next/image";
import Link from "next/link";

import { cn } from "@/lib/utils";

type BrandLogoSize = "hero" | "header" | "compact";

const layout: Record<BrandLogoSize, { wrapper: string; shield: string; gm: string; fantasy: string; gap: string; underline: string }> = {
  hero: {
    wrapper: "max-w-[48rem] gap-5",
    shield: "h-40 w-40 sm:h-48 sm:w-48",
    gm: "text-[6rem] sm:text-[7.5rem] leading-none",
    fantasy: "text-3xl sm:text-4xl tracking-[0.32em]",
    gap: "gap-1",
    underline: "h-[3px] w-full bg-amber-400"
  },
  header: {
    wrapper: "max-w-[22rem] gap-3",
    shield: "h-14 w-14",
    gm: "text-4xl leading-none",
    fantasy: "text-sm tracking-[0.28em]",
    gap: "gap-0.5",
    underline: "h-[2px] w-full bg-amber-400"
  },
  compact: {
    wrapper: "max-w-[15rem] gap-2",
    shield: "h-10 w-10",
    gm: "text-2xl leading-none",
    fantasy: "text-[0.7rem] tracking-[0.28em]",
    gap: "gap-0.5",
    underline: "h-[1.5px] w-full bg-amber-400"
  }
};

interface BrandLogoProps {
  size?: BrandLogoSize;
  href?: string;
  className?: string;
  priority?: boolean;
}

export function BrandLogo({ size = "header", href, className, priority = false }: BrandLogoProps) {
  const s = layout[size];
  const content = (
    <div className={cn("inline-flex items-center", s.wrapper, className)}>
      <div className={cn("relative shrink-0", s.shield)}>
        <Image
          alt="GM Fantasy shield"
          className="h-full w-full object-contain"
          fill
          priority={priority}
          sizes="(max-width: 640px) 160px, 192px"
          src="/brand/gm-fantasy-shield.png"
        />
      </div>
      <div className={cn("flex flex-col font-brand font-bold uppercase text-white", s.gap)}>
        <span className={s.gm}>GM</span>
        <span className={cn("font-semibold text-emerald-300", s.fantasy)}>Fantasy</span>
        <span className={s.underline} aria-hidden />
      </div>
    </div>
  );

  if (!href) {
    return content;
  }

  return (
    <Link aria-label="GM Fantasy home" className="inline-flex" href={href}>
      {content}
    </Link>
  );
}
