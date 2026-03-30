import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BrandMasthead } from "@/components/brand/brand-masthead";

const leagueDomains = [
  "Season timeline and configuration",
  "League membership and ownership assignments",
  "NFL team pools and historical snapshots",
  "Playoff and payout reporting surfaces"
];

export function LeagueShell() {
  return (
    <main className="container py-12">
      <BrandMasthead
        description="This route is prepared for league-wide administration, history, and ownership management."
        eyebrow="League Hub"
        title="League Hub"
      />
      <div className="mt-8 grid gap-6 md:grid-cols-2">
        {leagueDomains.map((item) => (
          <Card key={item}>
            <CardHeader>
              <CardTitle className="text-lg">{item}</CardTitle>
              <CardDescription>Structured for future expansion through isolated feature modules.</CardDescription>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              The current scaffold focuses on project architecture, not business rules or data workflows.
            </CardContent>
          </Card>
        ))}
      </div>
    </main>
  );
}
