"use client";

import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";

import { AccountMenu } from "@/components/home/account-menu";

export function GlobalAccountDock() {
  const pathname = usePathname();
  const { data: session, status } = useSession();
  const usesMastheadAccountSlot =
    pathname === "/league" || pathname === "/owner" || pathname === "/account" || pathname === "/dashboard";

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
        imageUrl={session.user.profileImageUrl ?? null}
      />
      </div>
    </div>
  );
}
