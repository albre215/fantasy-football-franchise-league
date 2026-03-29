"use client";

import Link from "next/link";
import { CircleUserRound } from "lucide-react";
import { signOut } from "next-auth/react";
import { useEffect, useRef, useState } from "react";

import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function AccountMenu({
  greetingName,
  displayName,
  email
}: {
  greetingName: string;
  displayName: string;
  email: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    window.addEventListener("mousedown", handlePointerDown);
    return () => window.removeEventListener("mousedown", handlePointerDown);
  }, []);

  return (
    <div
      className="relative flex items-center gap-4 rounded-full border border-border/70 bg-white/80 px-4 py-2 shadow-sm backdrop-blur"
      ref={containerRef}
    >
      <div className="text-right" title="Account menu">
        <p className="text-base font-semibold text-foreground sm:text-lg">Welcome back, {greetingName}</p>
      </div>
      <Button
        aria-expanded={isOpen}
        aria-haspopup="menu"
        className="h-11 w-11 rounded-full px-0"
        onClick={() => setIsOpen((current) => !current)}
        title="Open account menu"
        type="button"
        variant="outline"
      >
        <CircleUserRound className="h-5.5 w-5.5" />
        <span className="sr-only">Open account menu</span>
      </Button>
      {isOpen ? (
        <div className="absolute right-0 top-full z-20 mt-2 w-72 rounded-xl border border-border bg-white p-4 shadow-lg">
          <div className="space-y-1 border-b border-border/70 pb-3">
            <p className="font-medium text-foreground">{displayName}</p>
            <p className="text-sm text-muted-foreground">{email}</p>
          </div>
          <div className="mt-3 flex flex-col gap-2">
            <Link
              className={cn(buttonVariants({ variant: "secondary" }), "justify-start")}
              href="/account"
              onClick={() => setIsOpen(false)}
            >
              Account Settings
            </Link>
            <Button
              className="justify-start"
              onClick={() => void signOut({ callbackUrl: "/" })}
              type="button"
              variant="outline"
            >
              Sign Out
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
