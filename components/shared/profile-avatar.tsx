"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

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
  fallbackClassName,
  expandOnClick = true
}: {
  name: string;
  imageUrl?: string | null;
  className?: string;
  imageClassName?: string;
  fallbackClassName?: string;
  expandOnClick?: boolean;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const isExpandable = expandOnClick && Boolean(imageUrl);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (!isExpanded) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsExpanded(false);
      }
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [isExpanded]);

  function closeExpandedView() {
    setIsExpanded(false);
  }

  return (
    <>
      <div
        aria-label={isExpandable ? `Expand ${name} profile picture` : undefined}
        className={cn(
          "inline-flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/20 bg-white/12 text-sm font-semibold text-white",
          isExpandable ? "cursor-pointer transition-transform hover:scale-[1.03]" : undefined,
          className
        )}
        onClick={isExpandable ? () => setIsExpanded(true) : undefined}
        onKeyDown={
          isExpandable
            ? (event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  setIsExpanded(true);
                }
              }
            : undefined
        }
        role={isExpandable ? "button" : undefined}
        tabIndex={isExpandable ? 0 : undefined}
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

      {isExpanded && imageUrl && isMounted
        ? createPortal(
            <div
              className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/92 px-5 py-8 backdrop-blur-md"
              onClick={closeExpandedView}
            >
              <div
                className="flex max-w-[28rem] flex-col items-center gap-4"
                onClick={(event) => event.stopPropagation()}
              >
                <img
                  alt={`${name} profile expanded`}
                  className="max-h-[70vh] w-auto max-w-full rounded-[1.75rem] border border-white/18 bg-white object-contain shadow-[0_28px_90px_-42px_rgba(0,0,0,0.88)]"
                  src={imageUrl}
                />
                <p className="text-center text-xl font-semibold tracking-tight text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.85)]">
                  {name}
                </p>
              </div>
            </div>,
            document.body
          )
        : null}
    </>
  );
}
