import Image from "next/image";
import Link from "next/link";

import { cn } from "@/lib/utils";

type BrandLogoSize = "hero" | "header" | "compact";

const sizeClasses: Record<BrandLogoSize, string> = {
  hero: "w-full max-w-[48rem]",
  header: "w-full max-w-[22rem]",
  compact: "w-full max-w-[15rem]"
};

interface BrandLogoProps {
  size?: BrandLogoSize;
  href?: string;
  className?: string;
  priority?: boolean;
}

export function BrandLogo({ size = "header", href, className, priority = false }: BrandLogoProps) {
  const image = (
    <div className={cn(sizeClasses[size], className)}>
      <Image
        alt="GM Fantasy logo"
        className="h-auto w-full object-contain"
        height={768}
        priority={priority}
        src="/brand/gm-fantasy-logo.png"
        width={1152}
      />
    </div>
  );

  if (!href) {
    return image;
  }

  return (
    <Link aria-label="GM Fantasy home" className="inline-flex" href={href}>
      {image}
    </Link>
  );
}
