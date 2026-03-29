import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const dashboardDomains = [
  "League operations and owner workflows",
  "Weekly scoring and standings ingestion",
  "Roster composition and franchise constraints",
  "Multi-season trend visibility"
];

export function DashboardShell() {
  return (
    <main className="container py-12">
      <div className="max-w-3xl space-y-4">
        <div className="flex flex-wrap gap-3">
          <Link className={buttonVariants({ variant: "outline" })} href="/">
            Back to Home
          </Link>
        </div>
        <h1 className="text-3xl font-semibold tracking-tight">Owner Workflows</h1>
        <p className="text-muted-foreground">
          This route is prepared for future owner-facing workflows and operational summaries.
        </p>
      </div>
      <div className="mt-8 grid gap-6 md:grid-cols-2">
        {dashboardDomains.map((item) => (
          <Card key={item}>
            <CardHeader>
              <CardTitle className="text-lg">{item}</CardTitle>
              <CardDescription>Scaffolded as a dedicated module boundary for future implementation.</CardDescription>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              Component structure is in place without introducing business logic or data access yet.
            </CardContent>
          </Card>
        ))}
      </div>
    </main>
  );
}
