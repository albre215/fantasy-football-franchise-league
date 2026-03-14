import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const leagueDomains = [
  "Season timeline and configuration",
  "League membership and ownership assignments",
  "NFL team pools and historical snapshots",
  "Playoff and payout reporting surfaces"
];

export function LeagueShell() {
  return (
    <main className="container py-12">
      <div className="max-w-3xl space-y-4">
        <h1 className="text-3xl font-semibold tracking-tight">League Hub</h1>
        <p className="text-muted-foreground">
          This route is prepared for league-wide administration, history, and ownership management.
        </p>
      </div>
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
