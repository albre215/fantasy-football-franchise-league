"use client";

import { useEffect, useMemo, useState } from "react";

import { NFLTeamLabel } from "@/components/shared/nfl-team-label";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type {
  ImportSeasonNflResultsResponse,
  SeasonNflGameResult,
  SeasonNflOverviewResponse,
  SeasonNflResultPhase,
  SeasonWeekNflResultsResponse,
  UpsertSeasonWeekTeamResultResponse
} from "@/types/nfl-performance";
import type { SeasonSummary } from "@/types/season";
import type { SeasonOwnershipSummary } from "@/types/team-ownership";

interface SeasonNflPerformancePanelProps {
  activeSeason: SeasonSummary | null;
  canManageNfl: boolean;
  accessMessage: string | null;
  seasonOwnership: SeasonOwnershipSummary | null;
  onError: (message: string | null) => void;
  onSuccess: (message: string | null) => void;
}

async function parseJsonResponse<T>(response: Response): Promise<T> {
  const payload = (await response.json()) as T & { error?: string };

  if (!response.ok) {
    throw new Error(payload.error ?? "Request failed.");
  }

  return payload;
}

function formatRecord(wins: number, losses: number, ties: number) {
  return `${wins}-${losses}${ties > 0 ? `-${ties}` : ""}`;
}

function formatPhase(phase: string) {
  return phase
    .toLowerCase()
    .split("_")
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
}

function formatResult(result: SeasonNflGameResult) {
  switch (result) {
    case "WIN":
      return "Win";
    case "LOSS":
      return "Loss";
    case "TIE":
      return "Tie";
    default:
      return result;
  }
}

function describeCoverageStatus(
  importState: SeasonNflOverviewResponse["nfl"]["importState"],
  seasonYear: number
) {
  if (importState.coverageStatus === "EMPTY") {
    return `No NFL results have been imported for ${seasonYear} yet.`;
  }

  if (importState.coverageStatus === "FULL_SEASON_IMPORTED") {
    return `A full-season import has been completed for the ${seasonYear} NFL season.`;
  }

  return `This season is only partially imported right now. Imported regular-season weeks: ${importState.importedRegularSeasonWeekNumbers.join(", ") || "none yet"}. Imported playoff phases: ${importState.importedPlayoffPhases.map(formatPhase).join(", ") || "none yet"}.`;
}

function getInitialWeekKey(summary: SeasonNflOverviewResponse["nfl"]) {
  return summary.availableWeeks[0]?.key ?? "";
}

function getInitialWeekPhase(summary: SeasonNflOverviewResponse["nfl"]) {
  return summary.availableWeeks[0]?.phase ?? "REGULAR_SEASON";
}

export function SeasonNflPerformancePanel({
  activeSeason,
  canManageNfl,
  accessMessage,
  seasonOwnership,
  onError,
  onSuccess
}: SeasonNflPerformancePanelProps) {
  const [summary, setSummary] = useState<SeasonNflOverviewResponse["nfl"] | null>(null);
  const [weekDetails, setWeekDetails] = useState<SeasonWeekNflResultsResponse["nfl"] | null>(null);
  const [selectedWeekKey, setSelectedWeekKey] = useState<string>("");
  const [formTeamId, setFormTeamId] = useState("");
  const [formOpponentId, setFormOpponentId] = useState("");
  const [formPhase, setFormPhase] = useState<SeasonNflResultPhase>("REGULAR_SEASON");
  const [formResult, setFormResult] = useState<SeasonNflGameResult>("WIN");
  const [formPointsFor, setFormPointsFor] = useState("");
  const [formPointsAgainst, setFormPointsAgainst] = useState("");
  const [isLoadingSummary, setIsLoadingSummary] = useState(false);
  const [isLoadingWeek, setIsLoadingWeek] = useState(false);
  const [isImportingSeason, setIsImportingSeason] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [weekError, setWeekError] = useState<string | null>(null);
  const [autoImportSeasonId, setAutoImportSeasonId] = useState<string | null>(null);

  const teamOptions = useMemo(() => {
    if (!seasonOwnership) {
      return [];
    }

    return [
      ...seasonOwnership.owners.flatMap((owner) => owner.teams.map((team) => team.team)),
      ...seasonOwnership.availableTeams
    ].sort((left, right) => left.name.localeCompare(right.name));
  }, [seasonOwnership]);

  const currentSelectedWeekOption = useMemo(
    () => summary?.availableWeeks.find((week) => week.key === selectedWeekKey) ?? null,
    [selectedWeekKey, summary]
  );

  useEffect(() => {
    setSummary(null);
    setWeekDetails(null);
    setSelectedWeekKey("");
    setSummaryError(null);
    setWeekError(null);
    setFormTeamId(teamOptions[0]?.id ?? "");
    setFormOpponentId("");
    setFormPhase("REGULAR_SEASON");
    setAutoImportSeasonId(null);

    if (!activeSeason) {
      return;
    }

    const seasonId = activeSeason.id;
    const controller = new AbortController();

    async function loadSummary() {
      setIsLoadingSummary(true);

      try {
        const response = await fetch(`/api/season/${seasonId}/nfl`, {
          cache: "no-store",
          signal: controller.signal
        });
        const data = await parseJsonResponse<SeasonNflOverviewResponse>(response);
        setSummary(data.nfl);
        setSelectedWeekKey(getInitialWeekKey(data.nfl));
        setFormPhase(getInitialWeekPhase(data.nfl));
        setSummaryError(null);
        onError(null);
      } catch (error) {
        if ((error as Error).name === "AbortError") {
          return;
        }

        setSummary(null);
        setSummaryError(error instanceof Error ? error.message : "Unable to load NFL performance.");
      } finally {
        setIsLoadingSummary(false);
      }
    }

    void loadSummary();

    return () => controller.abort();
  }, [activeSeason, teamOptions]);

  useEffect(() => {
    if (currentSelectedWeekOption) {
      setFormPhase(currentSelectedWeekOption.phase);
    }
  }, [currentSelectedWeekOption]);

  useEffect(() => {
    if (!activeSeason || !selectedWeekKey) {
      setWeekDetails(null);
      return;
    }

    const seasonId = activeSeason.id;
    const controller = new AbortController();
    const selectedOption = currentSelectedWeekOption;

    if (!selectedOption) {
      setWeekDetails(null);
      return;
    }
    const selectedWeekNumber = selectedOption.weekNumber;
    const selectedPhase = selectedOption.phase;

    async function loadWeek() {
      setIsLoadingWeek(true);

      try {
        const response = await fetch(`/api/season/${seasonId}/nfl/week/${selectedWeekNumber}?phase=${selectedPhase}`, {
          cache: "no-store",
          signal: controller.signal
        });
        const data = await parseJsonResponse<SeasonWeekNflResultsResponse>(response);
        setWeekDetails(data.nfl);
        setWeekError(null);
      } catch (error) {
        if ((error as Error).name === "AbortError") {
          return;
        }

        setWeekDetails(null);
        setWeekError(error instanceof Error ? error.message : "Unable to load weekly NFL results.");
      } finally {
        setIsLoadingWeek(false);
      }
    }

    void loadWeek();

    return () => controller.abort();
  }, [activeSeason, selectedWeekKey, summary]);

  async function refreshSummaryAndWeek(nextWeekKey?: string) {
    if (!activeSeason) {
      return;
    }

    const seasonId = activeSeason.id;
    const requestedWeek = summary?.availableWeeks.find((week) => week.key === nextWeekKey) ?? null;
    const [summaryResponse, weekResponse] = await Promise.all([
      fetch(`/api/season/${seasonId}/nfl`, { cache: "no-store" }),
      requestedWeek
        ? fetch(`/api/season/${seasonId}/nfl/week/${requestedWeek.weekNumber}?phase=${requestedWeek.phase}`, {
            cache: "no-store"
          })
        : Promise.resolve(null)
    ]);

    const summaryData = await parseJsonResponse<SeasonNflOverviewResponse>(summaryResponse);
    setSummary(summaryData.nfl);
    onError(null);

    const resolvedWeek = nextWeekKey
      ? summaryData.nfl.availableWeeks.find((week) => week.key === nextWeekKey) ?? null
      : summaryData.nfl.availableWeeks[0] ?? null;
    setSelectedWeekKey(resolvedWeek?.key ?? "");

    if (weekResponse) {
      const weekData = await parseJsonResponse<SeasonWeekNflResultsResponse>(weekResponse);
      setWeekDetails(weekData.nfl);
    } else if (resolvedWeek) {
      const weekData = await parseJsonResponse<SeasonWeekNflResultsResponse>(
        await fetch(`/api/season/${seasonId}/nfl/week/${resolvedWeek.weekNumber}?phase=${resolvedWeek.phase}`, {
          cache: "no-store"
        })
      );
      setWeekDetails(weekData.nfl);
    } else {
      setWeekDetails(null);
    }
  }

  async function runAutomaticSeasonImport() {
    if (!activeSeason) {
      return;
    }

    const seasonId = activeSeason.id;
    const seasonYear = activeSeason.year;
    onError(null);
    onSuccess(null);
    setIsImportingSeason(true);

    try {
      const response = await fetch(`/api/season/${seasonId}/nfl/import`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({})
      });
      const data = await parseJsonResponse<ImportSeasonNflResultsResponse>(response);
      setSummary(data.nfl);
      const nextWeek = data.nfl.availableWeeks[0] ?? null;
      setSelectedWeekKey(nextWeek?.key ?? "");
      onSuccess(`Imported NFL results for the ${seasonYear} season.`);

      if (nextWeek !== null) {
        const weekResponse = await fetch(`/api/season/${seasonId}/nfl/week/${nextWeek.weekNumber}?phase=${nextWeek.phase}`, {
          cache: "no-store"
        });
        const weekData = await parseJsonResponse<SeasonWeekNflResultsResponse>(weekResponse);
        setWeekDetails(weekData.nfl);
      } else {
        setWeekDetails(null);
      }
    } catch (error) {
      onError(error instanceof Error ? error.message : "Unable to import the NFL season.");
    } finally {
      setIsImportingSeason(false);
    }
  }

  useEffect(() => {
    if (!activeSeason || !summary || !canManageNfl || isImportingSeason) {
      return;
    }

    if (activeSeason.status !== "ACTIVE" || summary.importState.hasImportedResults) {
      return;
    }

    if (autoImportSeasonId === activeSeason.id) {
      return;
    }

    setAutoImportSeasonId(activeSeason.id);
    void runAutomaticSeasonImport();
  }, [activeSeason, autoImportSeasonId, canManageNfl, isImportingSeason, summary]);

  async function handleManualSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!activeSeason || !selectedWeekKey) {
      return;
    }

    const seasonId = activeSeason.id;
    const selectedOption = currentSelectedWeekOption;

    if (!selectedOption) {
      return;
    }
    onError(null);
    onSuccess(null);
    setIsSubmitting(true);

    try {
      const response = await fetch(`/api/season/${seasonId}/nfl/week/${selectedOption.weekNumber}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nflTeamId: formTeamId,
          opponentNflTeamId: formOpponentId || null,
          phase: formPhase,
          result: formResult,
          pointsFor: formPointsFor === "" ? null : Number(formPointsFor),
          pointsAgainst: formPointsAgainst === "" ? null : Number(formPointsAgainst)
        })
      });

      const data = await parseJsonResponse<UpsertSeasonWeekTeamResultResponse>(response);
      setWeekDetails(data.nfl);
      await refreshSummaryAndWeek(selectedOption.key);
      onSuccess("Saved the weekly NFL team result.");
    } catch (error) {
      onError(error instanceof Error ? error.message : "Unable to save the weekly NFL team result.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (!activeSeason) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>NFL Performance</CardTitle>
          <CardDescription>Create or activate a season first to import and review NFL team results.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <section className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-2xl font-semibold tracking-tight">NFL Performance</h2>
        <p className="text-muted-foreground">
          Track real NFL team outcomes for the {activeSeason.year} season and roll those results up to each owner.
        </p>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <CardHeader>
            <CardTitle>Season Import & Status</CardTitle>
            <CardDescription>
              {canManageNfl
                ? `NFL results for ${activeSeason.year} import automatically when this season becomes active. In-progress seasons load completed games automatically as results become available in the source data.`
                : "You can review imported NFL results here once the commissioner loads them."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {isLoadingSummary ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, index) => (
                  <div className="h-20 animate-pulse rounded-lg border border-border bg-secondary/20" key={index} />
                ))}
              </div>
            ) : summaryError ? (
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
                {summaryError}
              </div>
                ) : summary ? (
              <>
                <div className="rounded-lg border border-border bg-background p-4 text-sm text-muted-foreground">
                  {describeCoverageStatus(summary.importState, activeSeason.year)}
                </div>

                <div className="grid gap-3 md:grid-cols-4">
                  <div className="rounded-lg border border-border bg-background p-4">
                    <p className="text-sm text-muted-foreground">Results Imported</p>
                    <p className="mt-1 text-2xl font-semibold">{summary.importState.totalImportedResults}</p>
                  </div>
                  <div className="rounded-lg border border-border bg-background p-4">
                    <p className="text-sm text-muted-foreground">Tracked Weeks</p>
                    <p className="mt-1 text-2xl font-semibold">{summary.importState.importedWeekCount}</p>
                  </div>
                  <div className="rounded-lg border border-border bg-background p-4">
                    <p className="text-sm text-muted-foreground">Regular Weeks</p>
                    <p className="mt-1 text-2xl font-semibold">{summary.importState.importedRegularSeasonWeeks}</p>
                  </div>
                  <div className="rounded-lg border border-border bg-background p-4">
                    <p className="text-sm text-muted-foreground">Playoff Weeks</p>
                    <p className="mt-1 text-2xl font-semibold">{summary.importState.importedPlayoffWeeks}</p>
                  </div>
                </div>

                {summary.importState.latestCompletedImport ? (
                  <div className="rounded-lg border border-border bg-background p-4 text-sm">
                    <p className="font-medium text-foreground">Latest import</p>
                    <p className="mt-1 text-muted-foreground">
                      {summary.importState.latestCompletedImport.provider} -{" "}
                      {summary.importState.latestCompletedImport.mode === "SINGLE_WEEK"
                        ? `Week ${summary.importState.latestCompletedImport.weekNumber}`
                        : "Full season"}{" "}
                      - imported {summary.importState.latestCompletedImport.importedResultCount} team results
                    </p>
                  </div>
                ) : (
                  <div className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
                    No NFL results have been imported yet for this season.
                  </div>
                )}

                {summary.playoffHighlights.length > 0 ? (
                  <div className="space-y-3">
                    <p className="text-sm font-medium text-foreground">Playoff highlights</p>
                    <div className="grid gap-3 md:grid-cols-2">
                      {summary.playoffHighlights.slice(0, 4).map((highlight) => (
                        <div className="rounded-lg border border-border bg-background p-3" key={`${highlight.team.nflTeamId}-${highlight.phase}`}>
                          <NFLTeamLabel size="default" team={{ abbreviation: highlight.team.abbreviation, name: highlight.team.name }} />
                          <p className="mt-2 text-sm text-muted-foreground">
                            {formatPhase(highlight.phase)} - {formatResult(highlight.result)}
                            {highlight.owner ? ` - ${highlight.owner.displayName}` : ""}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </>
            ) : null}

            {canManageNfl ? (
              <div className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
                NFL import runs automatically for the active season. Use commissioner review below only if a weekly team result needs correction.
              </div>
            ) : accessMessage ? (
              <p className="text-sm text-muted-foreground">{accessMessage}</p>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Owner NFL Standings</CardTitle>
            <CardDescription>Combined real-world record for each owner’s current NFL teams.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {isLoadingSummary ? (
              Array.from({ length: 5 }).map((_, index) => (
                <div className="h-16 animate-pulse rounded-lg border border-border bg-secondary/20" key={index} />
              ))
            ) : summary?.ownerStandings.length ? (
              summary.ownerStandings.map((owner, index) => (
                <div className="rounded-lg border border-border bg-background p-4" key={owner.leagueMemberId}>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-medium text-foreground">
                        {index + 1}. {owner.displayName}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Record {formatRecord(owner.wins, owner.losses, owner.ties)} - Regular Wins {owner.regularSeasonWins}
                        {" - "}Playoff Wins {owner.playoffWins}
                      </p>
                    </div>
                    <div className="text-right text-sm text-muted-foreground">
                      <p>PF {owner.pointsFor}</p>
                      <p>PA {owner.pointsAgainst}</p>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
                NFL standings will appear here after results are imported for {activeSeason.year}.
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <Card>
          <CardHeader>
            <CardTitle>Week-by-Week Results</CardTitle>
            <CardDescription>Review team outcomes and owner rollups for the selected NFL week or playoff stage.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <label className="text-sm font-medium text-foreground" htmlFor="nfl-week-select">
                Week
              </label>
              <select
                className="h-10 min-w-[220px] rounded-md border border-border bg-background px-3 text-sm"
                id="nfl-week-select"
                onChange={(event) => setSelectedWeekKey(event.target.value)}
                value={selectedWeekKey}
              >
                <option value="">Select a week</option>
                {summary?.availableWeeks.map((week) => (
                  <option key={week.key} value={week.key}>
                    {week.label}
                  </option>
                ))}
              </select>
            </div>

            {isLoadingWeek ? (
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, index) => (
                  <div className="h-20 animate-pulse rounded-lg border border-border bg-secondary/20" key={index} />
                ))}
              </div>
            ) : weekError ? (
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
                {weekError}
              </div>
            ) : weekDetails?.allTeamResults.length ? (
              <div className="space-y-4">
                <div className="grid gap-3">
                  {weekDetails.ownerResults.map((owner) => (
                    <div className="rounded-lg border border-border bg-background p-4" key={owner.leagueMemberId}>
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="font-medium text-foreground">{owner.displayName}</p>
                          <p className="text-sm text-muted-foreground">
                            {weekDetails.selectedWeek?.label ?? "Selected week"} - {formatRecord(owner.wins, owner.losses, owner.ties)}
                          </p>
                        </div>
                        <div className="text-right text-sm text-muted-foreground">
                          <p>PF {owner.pointsFor}</p>
                          <p>PA {owner.pointsAgainst}</p>
                        </div>
                      </div>
                      <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                        {owner.teams.map((teamResult) => (
                          <div className="rounded-lg border border-border/70 bg-background/80 p-3" key={teamResult.id}>
                            <NFLTeamLabel size="default" team={{ abbreviation: teamResult.team.abbreviation, name: teamResult.team.name }} />
                            <p className="mt-2 text-sm text-muted-foreground">
                              {formatResult(teamResult.result)}
                              {teamResult.opponent ? ` vs ${teamResult.opponent.name}` : ""}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {teamResult.pointsFor ?? "-"} - {teamResult.pointsAgainst ?? "-"}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                {weekDetails.unassignedTeamResults.length > 0 ? (
                  <div className="rounded-lg border border-dashed border-border p-4">
                    <p className="text-sm font-medium text-foreground">Unassigned teams</p>
                    <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                      {weekDetails.unassignedTeamResults.map((teamResult) => (
                        <div className="rounded-lg border border-border bg-background p-3" key={teamResult.id}>
                          <NFLTeamLabel size="default" team={{ abbreviation: teamResult.team.abbreviation, name: teamResult.team.name }} />
                          <p className="mt-2 text-sm text-muted-foreground">
                            {formatResult(teamResult.result)}
                            {teamResult.opponent ? ` vs ${teamResult.opponent.name}` : ""}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
                Weekly owner rollups and team-by-team outcomes will appear here as NFL results are imported automatically.
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Commissioner Review</CardTitle>
            <CardDescription>
              Correct or add a weekly team result if the imported record needs review. Changes stay scoped to this league season.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!canManageNfl ? (
              <div className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
                {accessMessage ?? "Only the commissioner can review or correct NFL results."}
              </div>
            ) : !selectedWeekKey ? (
              <div className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
                Select a week first, then you can correct a team result for that week.
              </div>
            ) : (
              <form className="space-y-4" onSubmit={handleManualSave}>
                <div className="grid gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground" htmlFor="nfl-team-id">
                      Team
                    </label>
                    <select
                      className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
                      id="nfl-team-id"
                      onChange={(event) => setFormTeamId(event.target.value)}
                      value={formTeamId}
                    >
                      <option value="">Select a team</option>
                      {teamOptions.map((team) => (
                        <option key={team.id} value={team.id}>
                          {team.abbreviation} - {team.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground" htmlFor="nfl-opponent-id">
                      Opponent
                    </label>
                    <select
                      className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
                      id="nfl-opponent-id"
                      onChange={(event) => setFormOpponentId(event.target.value)}
                      value={formOpponentId}
                    >
                      <option value="">Optional opponent</option>
                      {teamOptions
                        .filter((team) => team.id !== formTeamId)
                        .map((team) => (
                          <option key={team.id} value={team.id}>
                            {team.abbreviation} - {team.name}
                          </option>
                        ))}
                    </select>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-foreground" htmlFor="nfl-phase">
                        Phase
                      </label>
                      <select
                        className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
                        id="nfl-phase"
                        onChange={(event) => setFormPhase(event.target.value as SeasonNflResultPhase)}
                        value={formPhase}
                      >
                        <option value={currentSelectedWeekOption?.phase ?? formPhase}>
                          {formatPhase(currentSelectedWeekOption?.phase ?? formPhase)}
                        </option>
                      </select>
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium text-foreground" htmlFor="nfl-result">
                        Result
                      </label>
                      <select
                        className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
                        id="nfl-result"
                        onChange={(event) => setFormResult(event.target.value as SeasonNflGameResult)}
                        value={formResult}
                      >
                        {["WIN", "LOSS", "TIE"].map((result) => (
                          <option key={result} value={result}>
                            {formatResult(result as SeasonNflGameResult)}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-foreground" htmlFor="nfl-points-for">
                        Points For
                      </label>
                      <Input
                        id="nfl-points-for"
                        inputMode="numeric"
                        onChange={(event) => setFormPointsFor(event.target.value)}
                        placeholder="Optional"
                        value={formPointsFor}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-foreground" htmlFor="nfl-points-against">
                        Points Against
                      </label>
                      <Input
                        id="nfl-points-against"
                        inputMode="numeric"
                        onChange={(event) => setFormPointsAgainst(event.target.value)}
                        placeholder="Optional"
                        value={formPointsAgainst}
                      />
                    </div>
                  </div>
                </div>

                <Button disabled={isSubmitting || !formTeamId} type="submit">
                  {isSubmitting ? "Saving Result..." : `Save ${weekDetails?.selectedWeek?.label ?? "Selected Week"} Result`}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
