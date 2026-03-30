"use client";

import { useEffect, useState } from "react";

import { DraftAnalyticsPanel } from "@/components/analytics/draft-analytics-panel";
import { FranchiseAnalyticsPanel } from "@/components/analytics/franchise-analytics-panel";
import { LeagueOverviewPanel } from "@/components/analytics/league-overview-panel";
import { OwnerAnalyticsPanel } from "@/components/analytics/owner-analytics-panel";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type {
  DraftAnalyticsResponse,
  FranchiseAnalyticsResponse,
  LeagueOverviewAnalyticsResponse,
  OwnerAnalyticsResponse
} from "@/types/analytics";

interface LeagueHistoryPanelProps {
  leagueId: string;
}

type AnalyticsSection = "league-overview" | "franchise-analytics" | "owner-analytics" | "draft-analytics";

async function parseJsonResponse<T>(response: Response): Promise<T> {
  const payload = (await response.json()) as T & { error?: string };

  if (!response.ok) {
    throw new Error(payload.error ?? "Request failed.");
  }

  return payload;
}

export function LeagueHistoryPanel({ leagueId }: LeagueHistoryPanelProps) {
  const [activeSection, setActiveSection] = useState<AnalyticsSection>("league-overview");
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [overview, setOverview] = useState<LeagueOverviewAnalyticsResponse["overview"] | null>(null);
  const [franchiseAnalytics, setFranchiseAnalytics] =
    useState<FranchiseAnalyticsResponse["franchiseAnalytics"] | null>(null);
  const [ownerAnalytics, setOwnerAnalytics] = useState<OwnerAnalyticsResponse["ownerAnalytics"] | null>(null);
  const [draftAnalytics, setDraftAnalytics] = useState<DraftAnalyticsResponse["draftAnalytics"] | null>(null);

  useEffect(() => {
    void (async () => {
      setIsLoading(true);
      setErrorMessage(null);

      try {
        const [overviewResponse, franchisesResponse, ownersResponse, draftsResponse] = await Promise.all([
          fetch(`/api/league/${leagueId}/analytics/overview`, { cache: "no-store" }),
          fetch(`/api/league/${leagueId}/analytics/franchises`, { cache: "no-store" }),
          fetch(`/api/league/${leagueId}/analytics/owners`, { cache: "no-store" }),
          fetch(`/api/league/${leagueId}/analytics/drafts`, { cache: "no-store" })
        ]);

        const [overviewData, franchiseData, ownerData, draftData] = await Promise.all([
          parseJsonResponse<LeagueOverviewAnalyticsResponse>(overviewResponse),
          parseJsonResponse<FranchiseAnalyticsResponse>(franchisesResponse),
          parseJsonResponse<OwnerAnalyticsResponse>(ownersResponse),
          parseJsonResponse<DraftAnalyticsResponse>(draftsResponse)
        ]);

        setOverview(overviewData.overview);
        setFranchiseAnalytics(franchiseData.franchiseAnalytics);
        setOwnerAnalytics(ownerData.ownerAnalytics);
        setDraftAnalytics(draftData.draftAnalytics);
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : "Unable to load analytics.");
      } finally {
        setIsLoading(false);
      }
    })();
  }, [leagueId]);

  return (
    <section className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-2xl font-semibold tracking-tight">History & Analytics</h2>
        <p className="text-muted-foreground">
          Explore league history through clean visual summaries across champions, franchises, owners, and drafts.
        </p>
      </div>

      {errorMessage ? (
        <Card className="brand-surface">
          <CardContent className="p-4 text-sm text-destructive">{errorMessage}</CardContent>
        </Card>
      ) : isLoading || !overview || !franchiseAnalytics || !ownerAnalytics || !draftAnalytics ? (
        <Card className="brand-surface">
          <CardContent className="p-6 text-sm text-muted-foreground">Loading analytics...</CardContent>
        </Card>
      ) : (
        <>
          <Card className="brand-surface">
            <CardHeader>
              <CardTitle className="text-xl">Analytics Views</CardTitle>
              <CardDescription>
                Move between high-level league insights and focused breakdowns for teams, owners, and draft behavior.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {[
                { id: "league-overview", label: "League Overview" },
                { id: "franchise-analytics", label: "Franchise Analytics" },
                { id: "owner-analytics", label: "Owner Analytics" },
                { id: "draft-analytics", label: "Draft Analytics" }
              ].map((section) => (
                <button
                  className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                    activeSection === section.id
                      ? "bg-primary text-primary-foreground"
                      : "border border-border bg-background text-muted-foreground hover:border-primary/30 hover:text-foreground"
                  }`}
                  key={section.id}
                  onClick={() => setActiveSection(section.id as AnalyticsSection)}
                  type="button"
                >
                  {section.label}
                </button>
              ))}
            </CardContent>
          </Card>

          {activeSection === "league-overview" ? <LeagueOverviewPanel overview={overview} /> : null}
          {activeSection === "franchise-analytics" ? (
            <FranchiseAnalyticsPanel analytics={franchiseAnalytics} />
          ) : null}
          {activeSection === "owner-analytics" ? <OwnerAnalyticsPanel analytics={ownerAnalytics} /> : null}
          {activeSection === "draft-analytics" ? <DraftAnalyticsPanel analytics={draftAnalytics} /> : null}
        </>
      )}
    </section>
  );
}
