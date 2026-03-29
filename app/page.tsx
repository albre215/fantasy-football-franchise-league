import Link from "next/link";

import { getServerAuthSession } from "@/auth";
import { AccountMenu } from "@/components/home/account-menu";
import { LeagueControlPanel } from "@/components/home/league-control-panel";

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
          <div className={`relative ${isAuthenticated ? "min-h-[72px]" : ""}`}>
            <div className={`space-y-6 ${isAuthenticated ? "mx-auto max-w-3xl text-center" : "text-center"}`}>
              {!isAuthenticated ? (
                <span className="inline-flex rounded-full bg-accent/15 px-3 py-1 text-sm font-medium text-foreground">
                  League Sign In
                </span>
              ) : null}
              <div className="space-y-3">
                <h1 className="text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
                  GM Fantasy
                </h1>
                {!isAuthenticated ? (
                  <p className="mx-auto max-w-lg text-lg text-muted-foreground">
                    Sign in to access your league tools, owner dashboard, and commissioner workflows in one place.
                  </p>
                ) : null}
              </div>
            </div>
            {isAuthenticated && session?.user ? (
              <div className="mt-6 flex justify-center lg:absolute lg:right-0 lg:top-0 lg:mt-0">
                <AccountMenu
                  displayName={session.user.displayName}
                  email={session.user.email ?? ""}
                  greetingName={greetingName}
                />
              </div>
            ) : null}
          </div>
        </div>
        <LeagueControlPanel />
      </div>
    </main>
  );
}
