import Link from "next/link";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";

const sections = [
  {
    href: "/dashboard",
    title: "Dashboard",
    description: "Owner-facing workspace for league status, roster context, standings, and operational workflows."
  },
  {
    href: "/league",
    title: "League Hub",
    description: "League-wide views for seasons, members, team ownership, and long-term historical reporting."
  }
];

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
        <section className="mt-14 grid gap-6 md:grid-cols-2">
          {sections.map((section) => (
            <Card key={section.href} className="border-border/70 bg-card/80 backdrop-blur">
              <CardHeader>
                <CardTitle>{section.title}</CardTitle>
                <CardDescription>{section.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <Link className={buttonVariants({ variant: "secondary" })} href={section.href}>
                  View section
                </Link>
              </CardContent>
            </Card>
          ))}
        </section>
      </div>
    </main>
  );
}
