import Link from "next/link";

import { LeagueControlPanel } from "@/components/home/league-control-panel";
import { buttonVariants } from "@/components/ui/button";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-100">
      <div className="container flex min-h-screen flex-col justify-center py-20">
        <div className="max-w-3xl space-y-6">
          <span className="inline-flex rounded-full bg-accent/15 px-3 py-1 text-sm font-medium text-foreground">
            Commissioner Workspace
          </span>
          <div className="space-y-3">
            <h1 className="text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
              Fantasy Franchise League
            </h1>
            <p className="max-w-2xl text-lg text-muted-foreground">
              Sign in to manage long-term franchise ownership, season standings, offseason keeper decisions, and the
              slow draft lifecycle for your league.
            </p>
          </div>
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
        </div>
        <LeagueControlPanel />
      </div>
    </main>
  );
}
