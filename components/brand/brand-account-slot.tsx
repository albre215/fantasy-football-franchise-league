"use client";

import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";

import { AccountMenu } from "@/components/home/account-menu";
import type { AccountProfileResponse } from "@/types/account";

export function BrandAccountSlot() {
  const pathname = usePathname();
  const { data: session, status } = useSession();
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  useEffect(() => {
    if (status !== "authenticated" || !session?.user || pathname === "/") {
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
  }, [pathname, session?.user, status]);

  if (status !== "authenticated" || !session?.user || pathname === "/") {
    return null;
  }

  return (
    <div className="absolute right-7 top-7 z-20 sm:right-9 sm:top-9">
      <AccountMenu
        displayGreeting={false}
        displayName={session.user.displayName}
        email={session.user.email ?? ""}
        greetingName={session.user.displayName.trim().split(/\s+/)[0] ?? session.user.displayName}
        imageUrl={imageUrl}
      />
    </div>
  );
}
