import Link from "next/link";

import { LeagueControlPanel } from "@/components/home/league-control-panel";
import { buttonVariants } from "@/components/ui/button";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-100">
      <div className="container flex min-h-screen flex-col justify-center py-20">
        <div className="max-w-3xl space-y-6">
          <span className="inline-flex rounded-full bg-accent/15 px-3 py-1 text-sm font-medium text-foreground">
            Foundation Scaffold
          </span>
          <div className="space-y-3">
            <h1 className="text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
              Fantasy Franchise League
            </h1>
            <p className="max-w-2xl text-lg text-muted-foreground">
              A clean, production-oriented Next.js architecture for a multi-year NFL franchise fantasy platform.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link className={buttonVariants()} href="/dashboard">
              Open Dashboard
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
