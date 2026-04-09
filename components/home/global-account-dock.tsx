"use client";

import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";

import { AccountMenu } from "@/components/home/account-menu";
import type { AccountProfileResponse } from "@/types/account";

export function GlobalAccountDock() {
  const pathname = usePathname();
  const { data: session, status } = useSession();
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const usesMastheadAccountSlot =
    pathname === "/league" || pathname === "/owner" || pathname === "/account" || pathname === "/dashboard";

  useEffect(() => {
    if (status !== "authenticated" || !session?.user || pathname === "/" || usesMastheadAccountSlot) {
      setImageUrl(null);
      return;
    }

    let isCancelled = false;

    async function loadAccountProfile() {
      try {
        const response = await fetch("/api/account", { cache: "no-store" });
        const data = (await response.json()) as AccountProfileResponse & { error?: string };

        if (!response.ok) {
          throw new Error(data.error ?? "Request failed.");
        }

        if (!isCancelled) {
          setImageUrl(data.account.profileImageUrl);
        }
      } catch {
        if (!isCancelled) {
          setImageUrl(null);
        }
      }
    }

    void loadAccountProfile();

    return () => {
      isCancelled = true;
    };
  }, [pathname, session?.user, status, usesMastheadAccountSlot]);

  if (status !== "authenticated" || !session?.user || pathname === "/" || usesMastheadAccountSlot) {
    return null;
  }

  return (
    <div className="pointer-events-none fixed right-5 top-5 z-50 sm:right-6 sm:top-6">
      <div className="pointer-events-auto">
        <AccountMenu
          displayGreeting={pathname === "/"}
          displayName={session.user.displayName}
          email={session.user.email ?? ""}
          greetingName={session.user.displayName.trim().split(/\s+/)[0] ?? session.user.displayName}
          imageUrl={imageUrl}
        />
      </div>
    </div>
  );
}
