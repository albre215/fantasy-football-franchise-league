"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type {
  SaveManualSeasonStandingsResponse,
  SeasonResultsResponse
} from "@/types/results";
import type { SeasonSummary } from "@/types/season";

interface SeasonResultsPanelProps {
  activeSeason: SeasonSummary | null;
  canManageStandings: boolean;
  accessMessage?: string | null;
}

async function parseJsonResponse<T>(response: Response): Promise<T> {
  const payload = (await response.json()) as T & { error?: string };

  if (!response.ok) {
    throw new Error(payload.error ?? "Request failed.");
  }

  return payload;
}

function seasonLabel(season: SeasonSummary | null) {
  if (!season) {
    return "No active season";
  }

  return season.name ?? `${season.year} Season`;
}

function formatPlacement(rank: number) {
  if (rank === 1) {
    return "1st Place";
  }

  if (rank === 2) {
    return "2nd Place";
  }

  if (rank === 3) {
    return "3rd Place";
  }

  return `${rank}th Place`;
}

export function SeasonResultsPanel({
  activeSeason,
  canManageStandings,
  accessMessage
}: SeasonResultsPanelProps) {
  const [results, setResults] = useState<SeasonResultsResponse["results"] | null>(null);
  const [orderedLeagueMemberIds, setOrderedLeagueMemberIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!activeSeason) {
      setResults(null);
      setOrderedLeagueMemberIds([]);
      setErrorMessage(null);
      setSuccessMessage(null);
      return;
    }

    void loadResults(activeSeason.id);
  }, [activeSeason]);

  async function loadResults(seasonId: string) {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const response = await fetch(`/api/season/${seasonId}/results`, { cache: "no-store" });
      const data = await parseJsonResponse<SeasonResultsResponse>(response);

      setResults(data.results);
      setOrderedLeagueMemberIds(
        data.results.seasonStandings.length > 0
          ? data.results.seasonStandings
              .sort((left, right) => (left.rank ?? 999) - (right.rank ?? 999))
              .map((standing) => standing.leagueMemberId)
          : Array.from({ length: data.results.eligibleMembers.length }, () => "")
      );
    } catch (error) {
      setResults(null);
      setOrderedLeagueMemberIds([]);
      setErrorMessage(error instanceof Error ? error.message : "Unable to load final standings.");
    } finally {
      setIsLoading(false);
    }
  }

  const eligibleMembers = results?.eligibleMembers ?? [];
  const totalPlacements = eligibleMembers.length;
  const filledPlacements = orderedLeagueMemberIds.filter(Boolean).length;
  const uniquePlacementCount = new Set(orderedLeagueMemberIds.filter(Boolean)).size;
  const hasAllPlacements = totalPlacements === 10 && filledPlacements === 10;
  const allOwnersUnique = filledPlacements === uniquePlacementCount;
  const includesEveryOwner =
    eligibleMembers.length === 10 &&
    eligibleMembers.every((member) => orderedLeagueMemberIds.includes(member.leagueMemberId));
  const standingsReady = hasAllPlacements && allOwnersUnique && includesEveryOwner;
  const recommendedReverseDraftOrder = results?.recommendedReverseDraftOrder ?? [];

  function updatePlacement(index: number, leagueMemberId: string) {
    setOrderedLeagueMemberIds((current) => {
      const next = [...current];
      next[index] = leagueMemberId;
      return next;
    });
  }

  async function handleSaveStandings() {
    if (!activeSeason || !standingsReady) {
      return;
    }

    setErrorMessage(null);
    setSuccessMessage(null);
    setIsSaving(true);

    try {
      const response = await fetch(`/api/season/${activeSeason.id}/results`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          orderedLeagueMemberIds
        })
      });
      const data = await parseJsonResponse<SaveManualSeasonStandingsResponse>(response);

      setResults(data.results);
      setOrderedLeagueMemberIds(data.results.seasonStandings.map((standing) => standing.leagueMemberId));
      setSuccessMessage("Final standings saved.");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to save final standings.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-2xl font-semibold tracking-tight">Final Standings</h2>
        <p className="text-muted-foreground">
          Manually record the 1st through 10th place finishers for {seasonLabel(activeSeason)}. These standings become the official source of truth for future draft order and long-term analytics.
        </p>
      </div>

      {!canManageStandings && activeSeason ? (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="p-4 text-sm text-amber-900">
            {accessMessage ??
              "Only the league commissioner can save final standings for this season. Sign in as the commissioner account to make changes."}
          </CardContent>
        </Card>
      ) : null}

      {!activeSeason ? (
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            Create or activate a season first. Final standings are season-scoped.
          </CardContent>
        </Card>
      ) : (
        <>
          {(errorMessage || successMessage) && (
            <Card className={errorMessage ? "bg-red-50" : "bg-emerald-50"}>
              <CardContent className="p-4 text-sm">{errorMessage ?? successMessage}</CardContent>
            </Card>
          )}

          <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
            <Card>
              <CardHeader>
                <CardTitle>Manual Final Standings Entry</CardTitle>
                <CardDescription>
                  Assign each finishing position to one unique owner. These can be edited later if corrections are needed.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {isLoading ? (
                  <p className="text-sm text-muted-foreground">Loading final standings...</p>
                ) : eligibleMembers.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No eligible league members were found for this season yet.
                  </p>
                ) : (
                  <>
                    <div className="grid gap-3 md:grid-cols-2">
                      {Array.from({ length: totalPlacements }).map((_, index) => (
                        <label className="space-y-1 text-sm" key={`placement-${index + 1}`}>
                          <span>{formatPlacement(index + 1)}</span>
                          <select
                            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                            onChange={(event) => updatePlacement(index, event.target.value)}
                            value={orderedLeagueMemberIds[index] ?? ""}
                          >
                            <option value="">Select owner</option>
                            {eligibleMembers
                              .filter(
                                (member) =>
                                  member.leagueMemberId === orderedLeagueMemberIds[index] ||
                                  !orderedLeagueMemberIds.includes(member.leagueMemberId)
                              )
                              .map((member) => (
                                <option key={member.leagueMemberId} value={member.leagueMemberId}>
                                  {member.displayName}
                                </option>
                              ))}
                          </select>
                        </label>
                      ))}
                    </div>

                    <div className="flex flex-wrap gap-3">
                      <Button
                        disabled={isSaving || !standingsReady || !canManageStandings}
                        onClick={() => void handleSaveStandings()}
                        type="button"
                      >
                        Save Final Standings
                      </Button>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Standings Readiness</CardTitle>
                <CardDescription>Use this checklist to confirm the standings are ready to save.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-muted-foreground">
                <p>10 placements filled: {hasAllPlacements ? `Pass (${filledPlacements}/10)` : `Fail (${filledPlacements}/10)`}</p>
                <p>All owners unique: {allOwnersUnique ? `Pass (${uniquePlacementCount}/10)` : "Fail"}</p>
                <p>All eligible owners included: {includesEveryOwner ? "Pass" : "Fail"}</p>
                <p>Standings ready to save: {standingsReady ? "Yes" : "No"}</p>
                <div className="rounded-lg border border-dashed border-border p-4">
                  {results?.availability.isReadyForDraftOrderAutomation
                    ? "Saved standings are complete and can support reverse-order draft automation later."
                    : "Save a complete 1st-through-10th order to prepare for Prompt 9 draft-order automation."}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
            <Card>
              <CardHeader>
                <CardTitle>Saved Final Standings</CardTitle>
                <CardDescription>The current official finishing order for this season.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {isLoading ? (
                  <p className="text-sm text-muted-foreground">Loading saved standings...</p>
                ) : !results || results.seasonStandings.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No final standings have been saved yet.</p>
                ) : (
                  results.seasonStandings.map((standing) => (
                    <div className="rounded-lg border border-border p-4 text-sm" key={standing.leagueMemberId}>
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="font-medium text-foreground">
                            {standing.rank ? `${formatPlacement(standing.rank)} - ` : ""}
                            {standing.displayName}
                          </p>
                          <p className="text-muted-foreground">{standing.email}</p>
                        </div>
                        {standing.isChampion ? (
                          <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-800">
                            Champion
                          </span>
                        ) : null}
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Prompt 9 Preview</CardTitle>
                <CardDescription>Reverse of the saved final standings for future offseason draft order automation.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {recommendedReverseDraftOrder.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Save final standings first to derive the reverse-order draft sequence.
                  </p>
                ) : (
                  recommendedReverseDraftOrder.map((member, index) => (
                    <div className="rounded-lg border border-border p-3 text-sm" key={member.leagueMemberId}>
                      Pick {index + 1}: {member.displayName}
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </section>
  );
}
