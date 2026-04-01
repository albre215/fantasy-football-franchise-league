"use client";

import { useEffect, useState } from "react";

import { AnalyticsSectionError, AnalyticsSectionSkeleton } from "@/components/analytics/analytics-section-state";
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
type SectionStatus = "idle" | "loading" | "success" | "error";

interface SectionState<T> {
  status: SectionStatus;
  data: T | null;
  error: string | null;
}

type SectionStateMap = {
  "league-overview": SectionState<LeagueOverviewAnalyticsResponse["overview"]>;
  "franchise-analytics": SectionState<FranchiseAnalyticsResponse["franchiseAnalytics"]>;
  "owner-analytics": SectionState<OwnerAnalyticsResponse["ownerAnalytics"]>;
  "draft-analytics": SectionState<DraftAnalyticsResponse["draftAnalytics"]>;
};

const INITIAL_SECTION_STATES: SectionStateMap = {
  "league-overview": { status: "idle", data: null, error: null },
  "franchise-analytics": { status: "idle", data: null, error: null },
  "owner-analytics": { status: "idle", data: null, error: null },
  "draft-analytics": { status: "idle", data: null, error: null }
};

const SECTION_COPY: Record<AnalyticsSection, { title: string; description: string }> = {
  "league-overview": {
    title: "League Overview",
    description: "Preparing high-level league history and champion summaries."
  },
  "franchise-analytics": {
    title: "Franchise Analytics",
    description: "Preparing franchise ownership counts, streaks, and timelines."
  },
  "owner-analytics": {
    title: "Owner Analytics",
    description: "Preparing owner portfolio history and franchise diversity insights."
  },
  "draft-analytics": {
    title: "Draft Analytics",
    description: "Preparing draft and keeper history across offseason activity."
  }
};

async function parseJsonResponse<T>(response: Response): Promise<T> {
  const payload = (await response.json()) as T & { error?: string };

  if (!response.ok) {
    throw new Error(payload.error ?? "Request failed.");
  }

  return payload;
}

export function LeagueHistoryPanel({ leagueId }: LeagueHistoryPanelProps) {
  const [activeSection, setActiveSection] = useState<AnalyticsSection>("league-overview");
  const [sectionStates, setSectionStates] = useState<SectionStateMap>(INITIAL_SECTION_STATES);
  const [reloadToken, setReloadToken] = useState(0);
  const activeState = sectionStates[activeSection];

  useEffect(() => {
    setSectionStates(INITIAL_SECTION_STATES);
    setReloadToken(0);
  }, [leagueId]);

  useEffect(() => {
    if (activeState.status === "loading" || activeState.status === "success") {
      return;
    }

    const controller = new AbortController();

    async function loadSection(section: AnalyticsSection) {
      setSectionStates((current) => {
        const currentSectionState = current[section];

        if (currentSectionState.status === "loading" || currentSectionState.status === "success") {
          return current;
        }

        return {
          ...current,
          [section]: {
            ...currentSectionState,
            status: "loading",
            error: null
          }
        };
      });

      try {
        if (section === "league-overview") {
          const response = await fetch(`/api/league/${leagueId}/analytics/overview`, {
            cache: "no-store",
            signal: controller.signal
          });
          const payload = await parseJsonResponse<LeagueOverviewAnalyticsResponse>(response);

          if (!controller.signal.aborted) {
            setSectionStates((current) => ({
              ...current,
              [section]: {
                status: "success",
                data: payload.overview,
                error: null
              }
            }));
          }

          return;
        }

        if (section === "franchise-analytics") {
          const response = await fetch(`/api/league/${leagueId}/analytics/franchises`, {
            cache: "no-store",
            signal: controller.signal
          });
          const payload = await parseJsonResponse<FranchiseAnalyticsResponse>(response);

          if (!controller.signal.aborted) {
            setSectionStates((current) => ({
              ...current,
              [section]: {
                status: "success",
                data: payload.franchiseAnalytics,
                error: null
              }
            }));
          }

          return;
        }

        if (section === "owner-analytics") {
          const response = await fetch(`/api/league/${leagueId}/analytics/owners`, {
            cache: "no-store",
            signal: controller.signal
          });
          const payload = await parseJsonResponse<OwnerAnalyticsResponse>(response);

          if (!controller.signal.aborted) {
            setSectionStates((current) => ({
              ...current,
              [section]: {
                status: "success",
                data: payload.ownerAnalytics,
                error: null
              }
            }));
          }

          return;
        }

        const response = await fetch(`/api/league/${leagueId}/analytics/drafts`, {
          cache: "no-store",
          signal: controller.signal
        });
        const payload = await parseJsonResponse<DraftAnalyticsResponse>(response);

        if (!controller.signal.aborted) {
          setSectionStates((current) => ({
            ...current,
            [section]: {
              status: "success",
              data: payload.draftAnalytics,
              error: null
            }
          }));
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          setSectionStates((current) => ({
            ...current,
            [section]: {
              ...current[section],
              status: "error",
              error:
                error instanceof Error
                  ? error.message
                  : `Unable to load ${SECTION_COPY[section].title.toLowerCase()}.`
            }
          }));
        }
      }
    }

    void loadSection(activeSection);

    return () => {
      controller.abort();
    };
  }, [activeSection, leagueId, reloadToken]);

  const activeCopy = SECTION_COPY[activeSection];
  const overviewState = sectionStates["league-overview"];
  const franchiseState = sectionStates["franchise-analytics"];
  const ownerState = sectionStates["owner-analytics"];
  const draftState = sectionStates["draft-analytics"];

  function handleRetry() {
    setSectionStates((current) => ({
      ...current,
      [activeSection]: {
        ...current[activeSection],
        status: "idle",
        error: null
      }
    }));
    setReloadToken((current) => current + 1);
  }

  return (
    <section className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-2xl font-semibold tracking-tight">History & Analytics</h2>
        <p className="text-muted-foreground">
          Explore league history through clean visual summaries across champions, franchises, owners, and drafts.
        </p>
      </div>

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
              {sectionStates[section.id as AnalyticsSection].status === "loading" ? (
                <span className="ml-2 inline-flex h-2 w-2 rounded-full bg-current/70 align-middle" />
              ) : null}
            </button>
          ))}
        </CardContent>
      </Card>

      {activeState.status === "loading" || activeState.status === "idle" ? (
        <AnalyticsSectionSkeleton description={activeCopy.description} title={activeCopy.title} />
      ) : null}

      {activeState.status === "error" && activeState.error ? (
        <AnalyticsSectionError message={activeState.error} onRetry={handleRetry} />
      ) : null}

      {activeSection === "league-overview" && overviewState.status === "success" && overviewState.data ? (
        <LeagueOverviewPanel overview={overviewState.data} />
      ) : null}
      {activeSection === "franchise-analytics" && franchiseState.status === "success" && franchiseState.data ? (
        <FranchiseAnalyticsPanel analytics={franchiseState.data} />
      ) : null}
      {activeSection === "owner-analytics" && ownerState.status === "success" && ownerState.data ? (
        <OwnerAnalyticsPanel analytics={ownerState.data} />
      ) : null}
      {activeSection === "draft-analytics" && draftState.status === "success" && draftState.data ? (
        <DraftAnalyticsPanel analytics={draftState.data} />
      ) : null}
    </section>
  );
}
