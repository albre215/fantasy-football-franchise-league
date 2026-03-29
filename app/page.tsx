import Link from "next/link";

import { getServerAuthSession } from "@/auth";
import { AccountMenu } from "@/components/home/account-menu";
import { LeagueControlPanel } from "@/components/home/league-control-panel";
import { buttonVariants } from "@/components/ui/button";

function getGreetingName(displayName: string | null | undefined) {
  const trimmed = displayName?.trim();

  if (!trimmed) {
    return "there";
  }

  return trimmed.split(/\s+/)[0] ?? trimmed;
}

export default async function HomePage() {
  const session = await getServerAuthSession();
  const isAuthenticated = Boolean(session?.user?.id);
  const greetingName = getGreetingName(session?.user?.displayName);

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-100">
      <div className={`container flex min-h-screen flex-col ${isAuthenticated ? "justify-center py-20" : "items-center justify-center py-16"}`}>
        <div className={`space-y-6 ${isAuthenticated ? "w-full" : "w-full max-w-xl text-center"}`}>
          <div className={`flex gap-6 ${isAuthenticated ? "items-start justify-between" : "flex-col items-center"}`}>
            <div className={`space-y-6 ${isAuthenticated ? "max-w-3xl" : "text-center"}`}>
              {!isAuthenticated ? (
                <span className="inline-flex rounded-full bg-accent/15 px-3 py-1 text-sm font-medium text-foreground">
                  League Sign In
                </span>
              ) : null}
              <div className="space-y-3">
                <h1 className="text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
                  GM Fantasy
                </h1>
                <p className={`text-lg text-muted-foreground ${isAuthenticated ? "max-w-2xl" : "mx-auto max-w-lg"}`}>
                  {isAuthenticated
                    ? "Manage your leagues, launch commissioner workflows, and jump back into owner activity without digging through the full dashboard first."
                    : "Sign in to access your league tools, owner dashboard, and commissioner workflows in one place."}
                </p>
              </div>
              {isAuthenticated ? (
                <div className="flex flex-wrap gap-3">
                  <Link className={buttonVariants()} href="/dashboard">
                    Open Dashboard
                  </Link>
                  <Link className={buttonVariants({ variant: "secondary" })} href="/me">
                    My Dashboard
                  </Link>
                  <Link className={buttonVariants({ variant: "outline" })} href="/league">
                    Open League Hub
                  </Link>
                </div>
              ) : null}
            </div>
            {isAuthenticated && session?.user ? (
              <AccountMenu
                displayName={session.user.displayName}
                email={session.user.email ?? ""}
                greetingName={greetingName}
              />
            ) : null}
          </div>
        </div>
        <LeagueControlPanel />
      </div>
    </main>
  );
}
