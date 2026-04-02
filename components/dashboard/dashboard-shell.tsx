import Link from "next/link";

import { BrandMasthead } from "@/components/brand/brand-masthead";
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
      <BrandMasthead
        actions={
          <Link className={buttonVariants({ variant: "outline" })} href="/">
            Back to Home
          </Link>
        }
        description="This route is prepared for future owner-facing workflows and operational summaries."
        eyebrow="Utility Workspace"
        title="Owner Workflows"
      />
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
