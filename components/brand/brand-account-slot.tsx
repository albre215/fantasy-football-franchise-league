"use client";

import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";

import { AccountMenu } from "@/components/home/account-menu";

export function BrandAccountSlot() {
  const pathname = usePathname();
  const { data: session, status } = useSession();

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
        imageUrl={session.user.profileImageUrl ?? null}
      />
    </div>
  );
}
