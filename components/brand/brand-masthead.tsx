import type { ReactNode } from "react";

import { BrandLogo } from "@/components/brand/brand-logo";
import { cn } from "@/lib/utils";

interface BrandMastheadProps {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
  rightSlot?: ReactNode;
  logoSize?: "hero" | "header" | "compact";
  center?: boolean;
  className?: string;
}

export function BrandMasthead({
  eyebrow,
  title,
  description,
  actions,
  rightSlot,
  logoSize = "header",
  center = false,
  className
}: BrandMastheadProps) {
  return (
    <section
      className={cn(
        "relative overflow-hidden rounded-[2rem] border border-[#123222] bg-[radial-gradient(circle_at_top_left,rgba(113,255,104,0.22),transparent_28%),linear-gradient(135deg,#081a11_0%,#0d2919_52%,#143222_100%)] p-7 text-white shadow-[0_30px_90px_-42px_rgba(1,24,14,0.92)] sm:p-9",
        className
      )}
    >
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,transparent,rgba(255,204,92,0.06),transparent)] opacity-80" />
      <div className={cn("relative flex flex-col gap-8", rightSlot ? "lg:flex-row lg:items-start lg:justify-between" : "")}>
        <div className={cn("space-y-5", center ? "mx-auto max-w-3xl text-center" : "max-w-3xl")}>
          <BrandLogo priority={logoSize === "hero"} size={logoSize} />
          <div className="space-y-3">
            {eyebrow ? (
              <span className="inline-flex rounded-full border border-white/12 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-[#f2c55c]">
                {eyebrow}
              </span>
            ) : null}
            <h1 className="text-4xl font-semibold tracking-tight text-balance sm:text-5xl">{title}</h1>
            {description ? (
              <p className={cn("text-base text-white/78 sm:text-lg", center ? "mx-auto max-w-2xl" : "max-w-2xl")}>
                {description}
              </p>
            ) : null}
          </div>
          {actions ? <div className={cn("flex flex-wrap gap-3", center ? "justify-center" : "")}>{actions}</div> : null}
        </div>
        {rightSlot ? <div className="relative shrink-0">{rightSlot}</div> : null}
      </div>
    </section>
  );
}
