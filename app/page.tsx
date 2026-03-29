import Link from "next/link";

import { getServerAuthSession } from "@/auth";
import { LeagueControlPanel } from "@/components/home/league-control-panel";
import { buttonVariants } from "@/components/ui/button";

export default async function HomePage() {
  const session = await getServerAuthSession();
  const isAuthenticated = Boolean(session?.user?.id);

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-100">
      <div className={`container flex min-h-screen flex-col ${isAuthenticated ? "justify-center py-20" : "items-center justify-center py-16"}`}>
        <div className={`space-y-6 ${isAuthenticated ? "max-w-3xl" : "w-full max-w-xl text-center"}`}>
          <span className="inline-flex rounded-full bg-accent/15 px-3 py-1 text-sm font-medium text-foreground">
            {isAuthenticated ? "Commissioner Workspace" : "League Sign In"}
          </span>
          <div className="space-y-3">
            <h1 className="text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
              GM Fantasy
            </h1>
            <p className={`text-lg text-muted-foreground ${isAuthenticated ? "max-w-2xl" : "mx-auto max-w-lg"}`}>
              {isAuthenticated
                ? "Sign in to manage long-term franchise ownership, season standings, offseason keeper decisions, and the slow draft lifecycle for your league."
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
        <LeagueControlPanel />
      </div>
    </main>
  );
}
