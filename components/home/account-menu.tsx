"use client";

import Link from "next/link";
import { CircleUserRound } from "lucide-react";
import { signOut } from "next-auth/react";
import { useEffect, useRef, useState } from "react";

import { ProfileAvatar } from "@/components/shared/profile-avatar";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function AccountMenu({
  greetingName,
  displayName,
  email,
  imageUrl,
  displayGreeting = true
}: {
  greetingName: string;
  displayName: string;
  email: string;
  imageUrl?: string | null;
  displayGreeting?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [isGreetingVisible, setIsGreetingVisible] = useState(false);
  const [isGreetingMounted, setIsGreetingMounted] = useState(displayGreeting);
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

  useEffect(() => {
    if (!displayGreeting) {
      setIsGreetingMounted(false);
      setIsGreetingVisible(false);
      return;
    }

    setIsGreetingMounted(true);
    const revealTimer = window.setTimeout(() => {
      setIsGreetingVisible(true);
    }, 80);
    const hideTimer = window.setTimeout(() => {
      setIsGreetingVisible(false);
    }, 10080);
    const unmountTimer = window.setTimeout(() => {
      setIsGreetingMounted(false);
    }, 12180);

    return () => {
      window.clearTimeout(revealTimer);
      window.clearTimeout(hideTimer);
      window.clearTimeout(unmountTimer);
    };
  }, [displayGreeting]);

  return (
    <div className="relative flex items-center justify-end text-white" ref={containerRef}>
      {isGreetingMounted ? (
        <div
          aria-hidden={!isGreetingVisible}
          className={cn(
            "absolute right-5 overflow-hidden rounded-full bg-white/8 text-white shadow-[0_18px_44px_-28px_rgba(0,0,0,0.75)] backdrop-blur-md transition-all duration-[1700ms] ease-[cubic-bezier(0.16,1,0.3,1)]",
            isGreetingVisible
              ? "max-w-[320px] translate-x-0 scale-x-100 px-6 py-2 opacity-100"
              : "max-w-0 translate-x-8 scale-x-90 px-0 py-2 opacity-0"
          )}
          style={{ transformOrigin: "right center" }}
        >
          <div className="pr-12 text-right" title="Account greeting">
            <p className="whitespace-nowrap text-lg font-semibold text-white sm:text-xl">Welcome back, {greetingName}</p>
          </div>
        </div>
      ) : null}
      <Button
        aria-expanded={isOpen}
        aria-haspopup="menu"
        className="relative z-10 h-12 w-12 overflow-hidden rounded-full border-white/18 bg-white/12 px-0 text-white shadow-[0_12px_28px_-18px_rgba(0,0,0,0.8)] hover:bg-white/18 hover:text-white"
        onClick={() => setIsOpen((current) => !current)}
        title="Open account menu"
        type="button"
        variant="outline"
      >
        {imageUrl ? (
          <ProfileAvatar
            className="h-full w-full border-0 bg-transparent text-white"
            imageUrl={imageUrl}
            name={displayName}
          />
        ) : (
          <CircleUserRound className="h-6 w-6" />
        )}
        <span className="sr-only">Open account menu</span>
      </Button>
      {isOpen ? (
        <div className="absolute right-0 top-full z-20 mt-3 w-72 rounded-2xl border border-[#173925] bg-[#0b1c13]/95 p-4 text-white shadow-[0_26px_72px_-36px_rgba(0,0,0,0.9)] backdrop-blur-lg">
          <div className="flex items-center gap-3 border-b border-white/10 pb-3">
            <ProfileAvatar
              className="h-12 w-12 border-white/15 bg-white/12"
              fallbackClassName="text-sm"
              imageUrl={imageUrl}
              name={displayName}
            />
            <div className="space-y-1">
              <p className="font-medium text-white">{displayName}</p>
              <p className="text-sm text-white/68">{email}</p>
            </div>
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
