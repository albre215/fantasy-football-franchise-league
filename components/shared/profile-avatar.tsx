"use client";

import { cn } from "@/lib/utils";

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);

  if (parts.length === 0) {
    return "?";
  }

  return parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function ProfileAvatar({
  name,
  imageUrl,
  className,
  imageClassName,
  fallbackClassName
}: {
  name: string;
  imageUrl?: string | null;
  className?: string;
  imageClassName?: string;
  fallbackClassName?: string;
}) {
  return (
    <div
      className={cn(
        "inline-flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/20 bg-white/12 text-sm font-semibold text-white",
        className
      )}
    >
      {imageUrl ? (
        <img
          alt={`${name} profile`}
          className={cn("h-full w-full object-cover", imageClassName)}
          src={imageUrl}
        />
      ) : (
        <span className={cn("select-none", fallbackClassName)}>{getInitials(name)}</span>
      )}
    </div>
  );
}
