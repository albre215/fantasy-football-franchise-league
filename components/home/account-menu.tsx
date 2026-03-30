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
      className="relative flex items-center gap-4 rounded-full border border-white/12 bg-white/8 px-4 py-2 text-white shadow-[0_18px_44px_-28px_rgba(0,0,0,0.75)] backdrop-blur-md"
      ref={containerRef}
    >
      <div className="text-right" title="Account menu">
        <p className="text-base font-semibold text-white sm:text-lg">Welcome back, {greetingName}</p>
      </div>
      <Button
        aria-expanded={isOpen}
        aria-haspopup="menu"
        className="h-11 w-11 rounded-full border-white/18 bg-white/12 px-0 text-white hover:bg-white/18 hover:text-white"
        onClick={() => setIsOpen((current) => !current)}
        title="Open account menu"
        type="button"
        variant="outline"
      >
        <CircleUserRound className="h-5.5 w-5.5" />
        <span className="sr-only">Open account menu</span>
      </Button>
      {isOpen ? (
        <div className="absolute right-0 top-full z-20 mt-3 w-72 rounded-2xl border border-[#173925] bg-[#0b1c13]/95 p-4 text-white shadow-[0_26px_72px_-36px_rgba(0,0,0,0.9)] backdrop-blur-lg">
          <div className="space-y-1 border-b border-white/10 pb-3">
            <p className="font-medium text-white">{displayName}</p>
            <p className="text-sm text-white/68">{email}</p>
          </div>
          <div className="mt-3 flex flex-col gap-2">
            <Link
              className={cn(buttonVariants({ variant: "secondary" }), "justify-start border border-white/10 bg-white/10 text-white hover:bg-white/16 hover:text-white")}
              href="/account"
              onClick={() => setIsOpen(false)}
            >
              Account Settings
            </Link>
            <Button
              className="justify-start border-white/10 bg-transparent text-white hover:bg-white/10 hover:text-white"
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
