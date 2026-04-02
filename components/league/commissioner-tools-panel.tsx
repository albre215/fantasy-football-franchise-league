"use client";

import { useEffect, useMemo, useState } from "react";

import { NFLTeamLabel } from "@/components/shared/nfl-team-label";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type {
  DraftOrderRecommendationResponse,
  DraftState,
  OverrideDraftOrderResponse,
  ResetDraftResponse
} from "@/types/draft";
import type { LeagueBootstrapMember } from "@/types/league";
import type {
  FantasyPayoutConfigEntry,
  OverwriteManualSeasonStandingsResponse,
  SeasonResultsResponse
} from "@/types/results";
import type { SeasonSummary } from "@/types/season";
import type { SeasonPhaseContext } from "@/types/season";
import type {
  AssignTeamResponse,
  RemoveTeamOwnershipResponse,
  SeasonOwnershipSummary
} from "@/types/team-ownership";

interface CommissionerToolsPanelProps {
  activeSeason: SeasonSummary | null;
  seasons: SeasonSummary[];
  members: LeagueBootstrapMember[];
  seasonOwnership: SeasonOwnershipSummary | null;
  draftState: DraftState | null;
  phaseContext: SeasonPhaseContext | null;
  canManageLeague: boolean;
  accessMessage?: string | null;
  onError: (message: string) => void;
  onSuccess: (message: string) => void;
  onRefresh: () => Promise<void>;
  visibleSections?: Array<"state" | "standings" | "draftReset" | "draftOrder" | "ownership">;
  hideHeading?: boolean;
}

interface ConfirmationState {
  title: string;
  message: string;
  confirmLabel: string;
  confirmVariant?: "default" | "secondary" | "outline" | "ghost";
  onConfirm: () => Promise<void>;
}

async function parseJsonResponse<T>(response: Response): Promise<T> {
  const payload = (await response.json()) as T & { error?: string };

  if (!response.ok) {
    throw new Error(payload.error ?? "Request failed.");
  }

  return payload;
}

function seasonLabel(season: { year: number; name: string | null } | null) {
  if (!season) {
    return "Not available";
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

function normalizePayoutInput(value: string) {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) {
    return 0;
  }

  return Number(numericValue.toFixed(2));
}

export function CommissionerToolsPanel({
  activeSeason,
  seasons,
  members,
  seasonOwnership,
  draftState,
  phaseContext,
  canManageLeague,
  accessMessage,
  onError,
  onSuccess,
  onRefresh,
  visibleSections,
  hideHeading = false
}: CommissionerToolsPanelProps) {
  const [results, setResults] = useState<SeasonResultsResponse["results"] | null>(null);
  const [orderedLeagueMemberIds, setOrderedLeagueMemberIds] = useState<string[]>([]);
  const [draftOrderLeagueMemberIds, setDraftOrderLeagueMemberIds] = useState<string[]>([]);
  const [recommendedOrder, setRecommendedOrder] = useState<DraftOrderRecommendationResponse["recommendation"] | null>(
    null
  );
  const [resultsError, setResultsError] = useState<string | null>(null);
  const [recommendedOrderError, setRecommendedOrderError] = useState<string | null>(null);
  const [isLoadingResults, setIsLoadingResults] = useState(false);
  const [isLoadingRecommendation, setIsLoadingRecommendation] = useState(false);
  const [isMutating, setIsMutating] = useState(false);
  const [selectedAssignUserId, setSelectedAssignUserId] = useState("");
  const [selectedAssignTeamId, setSelectedAssignTeamId] = useState("");
  const [confirmation, setConfirmation] = useState<ConfirmationState | null>(null);
  const [payoutConfig, setPayoutConfig] = useState<FantasyPayoutConfigEntry[]>([]);

  const previousSeason = useMemo(() => {
    if (!activeSeason) {
      return null;
    }

    return seasons.find((season) => season.id !== activeSeason.id && season.year === activeSeason.year - 1) ?? null;
  }, [activeSeason, seasons]);

  const ownershipOwners = seasonOwnership?.owners ?? [];
  const availableTeams = seasonOwnership?.availableTeams ?? [];
  const ownerSelectionOptions = ownershipOwners.filter((owner) => owner.teamCount < 3);
  const totalPlacements = results?.eligibleMembers.length ?? 0;
  const filledPlacements = orderedLeagueMemberIds.filter(Boolean).length;
  const uniquePlacementCount = new Set(orderedLeagueMemberIds.filter(Boolean)).size;
  const standingsReady =
    totalPlacements === 10 &&
    filledPlacements === 10 &&
    uniquePlacementCount === 10 &&
    (results?.eligibleMembers.every((member) => orderedLeagueMemberIds.includes(member.leagueMemberId)) ?? false);
  const currentDraftOrderDisplay =
    draftState?.picks.map((pick) => ({
      leagueMemberId: pick.selectingLeagueMemberId,
      displayName: pick.selectingDisplayName,
      draftSlot: pick.overallPickNumber
    })) ?? [];
  const recommendedDraftOrderDisplay = recommendedOrder?.entries ?? [];
  const overrideMatchesRecommended =
    Boolean(recommendedOrder) &&
    currentDraftOrderDisplay.length === recommendedDraftOrderDisplay.length &&
    currentDraftOrderDisplay.every(
      (entry, index) => entry.leagueMemberId === recommendedDraftOrderDisplay[index]?.targetLeagueMemberId
    );
  const assignedTeamCount = seasonOwnership
    ? seasonOwnership.owners.reduce((total, owner) => total + owner.teamCount, 0)
    : 0;
  const ownershipFinalized = activeSeason ? activeSeason.isLocked && assignedTeamCount === 30 : false;
  const visibleSectionSet = new Set(
    visibleSections ?? ["state", "standings", "draftReset", "draftOrder", "ownership"]
  );
  const showStateSection = visibleSectionSet.has("state");
  const showStandingsSection = visibleSectionSet.has("standings");
  const showDraftResetSection = visibleSectionSet.has("draftReset");
  const showDraftOrderSection = visibleSectionSet.has("draftOrder");
  const showOwnershipSection = visibleSectionSet.has("ownership");

  useEffect(() => {
    if (!activeSeason) {
      setResults(null);
      setPayoutConfig([]);
      setOrderedLeagueMemberIds([]);
      setResultsError(null);
      return;
    }

    void (async () => {
      setIsLoadingResults(true);
      setResultsError(null);

      try {
        const response = await fetch(`/api/season/${activeSeason.id}/results`, { cache: "no-store" });
        const data = await parseJsonResponse<SeasonResultsResponse>(response);
        setResults(data.results);
        setPayoutConfig(data.results.fantasyPayouts.config);
        setOrderedLeagueMemberIds(
          data.results.seasonStandings.length > 0
            ? data.results.seasonStandings
                .sort((left, right) => (left.rank ?? 999) - (right.rank ?? 999))
                .map((standing) => standing.leagueMemberId)
            : Array.from({ length: data.results.eligibleMembers.length }, () => "")
        );
      } catch (error) {
        setResults(null);
        setPayoutConfig([]);
        setOrderedLeagueMemberIds([]);
        setResultsError(error instanceof Error ? error.message : "Unable to load season standings.");
      } finally {
        setIsLoadingResults(false);
      }
    })();
  }, [activeSeason]);

  useEffect(() => {
    if (!activeSeason || !previousSeason) {
      setRecommendedOrder(null);
      setRecommendedOrderError(null);
      return;
    }

    void (async () => {
      setIsLoadingRecommendation(true);
      setRecommendedOrderError(null);

      try {
        const response = await fetch(
          `/api/season/${activeSeason.id}/draft/recommended-order?sourceSeasonId=${previousSeason.id}`,
          { cache: "no-store" }
        );
        const data = await parseJsonResponse<DraftOrderRecommendationResponse>(response);
        setRecommendedOrder(data.recommendation);
        setDraftOrderLeagueMemberIds(
          draftState?.picks.map((pick) => pick.selectingLeagueMemberId) ??
            data.recommendation.entries.map((entry) => entry.targetLeagueMemberId ?? "")
        );
      } catch (error) {
        setRecommendedOrder(null);
        setRecommendedOrderError(
          error instanceof Error ? error.message : "Unable to derive the ledger-based draft order."
        );
        setDraftOrderLeagueMemberIds(draftState?.picks.map((pick) => pick.selectingLeagueMemberId) ?? []);
      } finally {
        setIsLoadingRecommendation(false);
      }
    })();
  }, [activeSeason, previousSeason, draftState]);

  useEffect(() => {
    setSelectedAssignUserId((current) =>
      ownerSelectionOptions.some((owner) => owner.userId === current)
        ? current
        : ownerSelectionOptions[0]?.userId ?? ""
    );
    setSelectedAssignTeamId((current) =>
      availableTeams.some((team) => team.id === current) ? current : availableTeams[0]?.id ?? ""
    );
  }, [ownerSelectionOptions, availableTeams]);

  function updatePlacement(index: number, leagueMemberId: string) {
    setOrderedLeagueMemberIds((current) => {
      const next = [...current];
      next[index] = leagueMemberId;
      return next;
    });
  }

  function updatePayout(rank: number, value: string) {
    setPayoutConfig((current) =>
      current.map((entry) => (entry.rank === rank ? { ...entry, amount: normalizePayoutInput(value) } : entry))
    );
  }

  function updateDraftOrder(index: number, leagueMemberId: string) {
    setDraftOrderLeagueMemberIds((current) => {
      const next = [...current];
      next[index] = leagueMemberId;
      return next;
    });
  }

  function openConfirmation(config: ConfirmationState) {
    setConfirmation(config);
  }

  async function runMutation<T>(run: () => Promise<T>, successMessage: string) {
    setIsMutating(true);
    onError("");
    onSuccess("");

    try {
      await run();
      onSuccess(successMessage);
      await onRefresh();
    } catch (error) {
      onError(error instanceof Error ? error.message : "Request failed.");
    } finally {
      setIsMutating(false);
      setConfirmation(null);
    }
  }

  async function handleOverwriteStandings() {
    if (!activeSeason || !standingsReady) {
      return;
    }

    openConfirmation({
      title: results?.availability.hasFinalStandings ? "Overwrite final standings?" : "Save final standings?",
      message:
        "This will overwrite the recorded final standings for this season, regenerate fantasy payout ledger entries, and update future draft-order logic.",
      confirmLabel: results?.availability.hasFinalStandings ? "Overwrite Standings" : "Save Standings",
      onConfirm: async () =>
        runMutation(async () => {
          const response = await fetch(`/api/season/${activeSeason.id}/results/overwrite`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              orderedLeagueMemberIds,
              confirmOverwrite: true,
              payoutConfig
            })
          });

          const data = await parseJsonResponse<OverwriteManualSeasonStandingsResponse>(response);
          setResults(data.results);
          setPayoutConfig(data.results.fantasyPayouts.config);
          setOrderedLeagueMemberIds(data.results.seasonStandings.map((standing) => standing.leagueMemberId));
        }, results?.availability.hasFinalStandings ? "Final standings overwritten and fantasy payouts regenerated." : "Final standings saved and fantasy payouts published.")
    });
  }

  async function handleResetDraft(force: boolean) {
    if (!activeSeason || !draftState) {
      return;
    }

    openConfirmation({
      title: force ? "Force reset offseason draft?" : "Reset offseason draft?",
      message: force
        ? `This will permanently reset the offseason draft for ${seasonLabel(activeSeason)} and remove any target-season ownership created from it.`
        : `This will permanently reset the offseason draft for ${seasonLabel(activeSeason)}.`,
      confirmLabel: force ? "Force Reset Draft" : "Reset Draft",
      confirmVariant: force ? "secondary" : "outline",
      onConfirm: async () =>
        runMutation(async () => {
          const response = await fetch(`/api/season/${activeSeason.id}/draft/reset`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              force,
              confirmReset: true
            })
          });

          await parseJsonResponse<ResetDraftResponse>(response);
        }, force ? "Draft force reset completed." : "Draft reset completed.")
    });
  }

  async function handleOverrideDraftOrder() {
    if (!activeSeason || !draftState) {
      return;
    }

    openConfirmation({
      title: "Override draft order?",
      message: "This will save a commissioner override to the planning draft order for the active season.",
      confirmLabel: "Save Override",
      onConfirm: async () =>
        runMutation(async () => {
          const response = await fetch(`/api/season/${activeSeason.id}/draft/override-order`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              orderLeagueMemberIds: draftOrderLeagueMemberIds,
              confirmOverride: true
            })
          });

          const data = await parseJsonResponse<OverrideDraftOrderResponse>(response);
          setDraftOrderLeagueMemberIds(data.draft.picks.map((pick) => pick.selectingLeagueMemberId));
        }, "Draft order override saved.")
    });
  }

  async function handleAssignTeam() {
    if (!activeSeason || !selectedAssignUserId || !selectedAssignTeamId) {
      return;
    }

    const owner = ownerSelectionOptions.find((entry) => entry.userId === selectedAssignUserId);
    const team = availableTeams.find((entry) => entry.id === selectedAssignTeamId);

    if (!owner || !team) {
      return;
    }

    openConfirmation({
      title: "Assign team?",
      message: `Assign ${team.abbreviation} - ${team.name} to ${owner.displayName} for ${seasonLabel(activeSeason)}.`,
      confirmLabel: "Assign Team",
      onConfirm: async () =>
        runMutation(async () => {
          const response = await fetch(`/api/season/${activeSeason.id}/ownership/assign`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              userId: selectedAssignUserId,
              nflTeamId: selectedAssignTeamId
            })
          });

          await parseJsonResponse<AssignTeamResponse>(response);
        }, "Team assigned.")
    });
  }

  async function handleRemoveTeam(teamOwnershipId: string, teamLabel: string, ownerDisplayName: string) {
    if (!activeSeason) {
      return;
    }

    openConfirmation({
      title: "Remove team assignment?",
      message: `Remove ${teamLabel} from ${ownerDisplayName} in ${seasonLabel(activeSeason)}.`,
      confirmLabel: "Remove Team",
      confirmVariant: "outline",
      onConfirm: async () =>
        runMutation(async () => {
          const response = await fetch(`/api/season/${activeSeason.id}/ownership/remove`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              teamOwnershipId
            })
          });

          await parseJsonResponse<RemoveTeamOwnershipResponse>(response);
        }, "Team assignment removed.")
    });
  }

  return (
    <section className="space-y-6">
      {!hideHeading ? (
        <div className="space-y-2">
          <h2 className="text-2xl font-semibold tracking-tight">Commissioner Tools</h2>
          <p className="text-muted-foreground">
            Explicit correction and override tools for standings, draft state, ownership, and system visibility.
          </p>
        </div>
      ) : null}

      {!canManageLeague ? (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="p-4 text-sm text-amber-900">
            {accessMessage ?? "Only the league commissioner can use commissioner tools for this league."}
          </CardContent>
        </Card>
      ) : null}

      {showStateSection ? (
      <Card>
        <CardHeader>
          <CardTitle>Current State</CardTitle>
          <CardDescription>Single source of truth for the current operational state of the active season.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm text-muted-foreground md:grid-cols-2">
          <p>League phase: {phaseContext?.season.leaguePhase ?? "Unknown"}</p>
          <p>Assigned teams: {assignedTeamCount} / 30</p>
          <p>Final standings saved: {results?.availability.hasFinalStandings ? "Yes" : "No"}</p>
          <p>Fantasy payouts published: {results?.availability.hasFantasyPayoutsPublished ? "Yes" : "No"}</p>
          <p>Draft exists: {draftState ? "Yes" : "No"}</p>
          <p>Draft status: {draftState?.draft.status ?? "No draft"}</p>
          <p>Target season locked: {activeSeason?.isLocked ? "Yes" : "No"}</p>
          <p>Ownership finalized: {ownershipFinalized ? "Yes" : "No"}</p>
          <p>Ledger-based draft order ready: {results?.availability.isReadyForDraftOrderAutomation ? "Yes" : "No"}</p>
          <p>Ledger coverage: {results?.availability.draftOrderReadiness.ledgerCoverageStatus ?? "NONE"}</p>
          <p>
            Owners with ledger entries: {results?.availability.draftOrderReadiness.ownersWithLedgerEntries ?? 0} /{" "}
            {results?.eligibleMembers.length ?? 0}
          </p>
          {phaseContext?.warnings.length ? (
            <div className="md:col-span-2 rounded-lg border border-dashed border-border p-3">
              {phaseContext.warnings.join(" ")}
            </div>
          ) : null}
        </CardContent>
      </Card>
      ) : null}

      {showStandingsSection || showDraftResetSection ? (
      <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        {showStandingsSection ? (
        <Card>
          <CardHeader>
            <CardTitle>Final Standings & Fantasy Payouts</CardTitle>
            <CardDescription>
              Save or correct the recorded final standings for the active season and keep fantasy payout ledger entries in sync.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {resultsError ? (
              <p className="text-sm text-destructive">{resultsError}</p>
            ) : isLoadingResults ? (
              <p className="text-sm text-muted-foreground">Loading standings...</p>
            ) : !activeSeason ? (
              <p className="text-sm text-muted-foreground">Activate a season before correcting final standings.</p>
            ) : !results ? (
              <p className="text-sm text-muted-foreground">No standings data is available yet.</p>
            ) : (
              <>
                <div className="space-y-3 rounded-lg border border-dashed border-border p-4">
                  <div>
                    <p className="text-sm font-medium text-foreground">Fantasy payout mapping</p>
                    <p className="text-sm text-muted-foreground">
                      These season-scoped amounts will be posted to the ledger whenever final standings are saved or corrected.
                    </p>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    {payoutConfig.map((entry) => (
                      <label className="space-y-1 text-sm" key={`commissioner-payout-${entry.rank}`}>
                        <span>{formatPlacement(entry.rank)}</span>
                        <input
                          className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                          min="0"
                          onChange={(event) => updatePayout(entry.rank, event.target.value)}
                          step="0.01"
                          type="number"
                          value={entry.amount}
                        />
                      </label>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Config source:{" "}
                    {results.fantasyPayouts.configSource === "SEASON" ? "Season override" : "Default starting config"}
                  </p>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  {Array.from({ length: totalPlacements }).map((_, index) => (
                    <label className="space-y-1 text-sm" key={`commissioner-placement-${index + 1}`}>
                      <span>{formatPlacement(index + 1)}</span>
                      <select
                        className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                        onChange={(event) => updatePlacement(index, event.target.value)}
                        value={orderedLeagueMemberIds[index] ?? ""}
                      >
                        <option value="">Select owner</option>
                        {results.eligibleMembers
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

                <div className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
                  This will overwrite the recorded final standings for {seasonLabel(activeSeason)} and replace the season's fantasy payout ledger entries so balances reflect the latest standings.
                </div>

                <Button
                  disabled={isMutating || !standingsReady || !canManageLeague}
                  onClick={() => void handleOverwriteStandings()}
                  type="button"
                >
                  {results.availability.hasFinalStandings ? "Overwrite Final Standings" : "Save Final Standings"}
                </Button>

                <div className="rounded-lg border border-border bg-background/70 p-4 text-sm text-muted-foreground">
                  <p>Published fantasy payouts: {results.fantasyPayouts.publishedEntries.length > 0 ? "Yes" : "No"}</p>
                  <p>Total fantasy payouts: ${results.fantasyPayouts.totalPublishedAmount.toFixed(2)}</p>
                  <p>
                    Last published:{" "}
                    {results.fantasyPayouts.publishedAt
                      ? new Date(results.fantasyPayouts.publishedAt).toLocaleString()
                      : "Not published yet"}
                  </p>
                </div>
              </>
                )}
              </CardContent>
            </Card>
        ) : null}

        {showDraftResetSection ? (
        <Card>
          <CardHeader>
            <CardTitle>Offseason Draft Reset</CardTitle>
            <CardDescription>
              Permanently reset the offseason draft for the active season when setup or execution needs to be redone.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-muted-foreground">
            {!activeSeason ? (
              <p>Activate a season before using draft reset tools.</p>
            ) : !draftState ? (
              <p>No offseason draft exists for the active season.</p>
            ) : (
              <>
                <p>Draft status: {draftState.draft.status}</p>
                <p>Target season: {seasonLabel(activeSeason)}</p>
                <p>
                  Reset will remove the planning/active draft record, draft picks, and keeper selections for this target season.
                </p>
                <div className="flex flex-wrap gap-3">
                  <Button
                    disabled={isMutating || !canManageLeague}
                    onClick={() => void handleResetDraft(false)}
                    type="button"
                    variant="outline"
                  >
                    Reset Draft
                  </Button>
                  <Button
                    disabled={isMutating || !canManageLeague}
                    onClick={() => void handleResetDraft(true)}
                    type="button"
                    variant="secondary"
                  >
                    Force Reset Draft
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
        ) : null}
      </div>
      ) : null}

      {showDraftOrderSection || showOwnershipSection ? (
      <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        {showDraftOrderSection ? (
        <Card>
          <CardHeader>
            <CardTitle>Draft Order Override</CardTitle>
            <CardDescription>
              Compare the ledger-derived order with the currently saved planning draft order and save an explicit override.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!activeSeason ? (
              <p className="text-sm text-muted-foreground">Activate a season before overriding the draft order.</p>
            ) : recommendedOrderError ? (
              <p className="text-sm text-destructive">{recommendedOrderError}</p>
            ) : isLoadingRecommendation ? (
              <p className="text-sm text-muted-foreground">Loading ledger-derived draft order...</p>
            ) : phaseContext && !phaseContext.allowedActions.canEditDraft ? (
              <p className="text-sm text-muted-foreground">
                Draft order overrides are only available during DRAFT_PHASE. Current phase: {phaseContext.season.leaguePhase}.
              </p>
            ) : !draftState ? (
              <p className="text-sm text-muted-foreground">Prepare the offseason draft workspace before overriding the order.</p>
            ) : draftState.draft.status !== "PLANNING" ? (
              <p className="text-sm text-muted-foreground">
                Draft order overrides are only available while the offseason draft is still planning.
              </p>
            ) : (
              <>
                <div className="grid gap-6 lg:grid-cols-2">
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Ledger-based order</p>
                    {recommendedDraftOrderDisplay.map((entry) => (
                      <div className="rounded-lg border border-border p-3 text-sm" key={`recommended-${entry.sourceLeagueMemberId}`}>
                        <p className="font-medium text-foreground">Pick {entry.draftSlot}: {entry.displayName}</p>
                        <p className="text-muted-foreground">Ledger total: ${entry.ledgerTotal.toFixed(2)}</p>
                        <p className="text-muted-foreground">
                          Fantasy rank tie-break: {entry.sourceSeasonRank ? `#${entry.sourceSeasonRank}` : "Unavailable"}
                        </p>
                        <p className="text-muted-foreground">Ordering reason: {entry.tieBreakReason.replaceAll("_", " ")}</p>
                        <p className="text-muted-foreground">Mapping: {entry.mappingStatus.replaceAll("_", " ")}</p>
                        {entry.warnings.length > 0 ? (
                          <p className="mt-1 text-destructive">{entry.warnings[0]}</p>
                        ) : null}
                      </div>
                    ))}
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Saved draft order</p>
                    {draftOrderLeagueMemberIds.map((leagueMemberId, index) => (
                      <label className="space-y-1 text-sm" key={`override-${index + 1}`}>
                        <span>Pick {index + 1}</span>
                        <select
                          className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                          onChange={(event) => updateDraftOrder(index, event.target.value)}
                          value={leagueMemberId ?? ""}
                        >
                          <option value="">Select owner</option>
                          {members
                            .filter(
                              (member) =>
                                member.id === draftOrderLeagueMemberIds[index] ||
                                !draftOrderLeagueMemberIds.includes(member.id)
                            )
                            .map((member) => (
                              <option key={member.id} value={member.id}>
                                {member.displayName}
                              </option>
                            ))}
                        </select>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
                  {overrideMatchesRecommended
                    ? "The saved planning draft order currently matches the ledger-derived recommendation."
                    : "The saved planning draft order has been manually adjusted from the ledger-derived recommendation."}
                </div>

                {recommendedOrder && recommendedOrder.warnings.length > 0 ? (
                  <div className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
                    {recommendedOrder.warnings.map((warning) => (
                      <p key={warning}>{warning}</p>
                    ))}
                  </div>
                ) : null}

                <Button
                  disabled={
                    isMutating ||
                    !canManageLeague ||
                    Boolean(phaseContext && !phaseContext.allowedActions.canEditDraft) ||
                    draftOrderLeagueMemberIds.length !== 10 ||
                    new Set(draftOrderLeagueMemberIds.filter(Boolean)).size !== 10 ||
                    draftOrderLeagueMemberIds.some((id) => !id)
                  }
                  onClick={() => void handleOverrideDraftOrder()}
                  type="button"
                >
                  Save Draft Order Override
                </Button>
              </>
                )}
              </CardContent>
            </Card>
        ) : null}

        {showOwnershipSection ? (
        <Card>
          <CardHeader>
            <CardTitle>Ownership Correction</CardTitle>
            <CardDescription>
              Assign and remove active-season teams through the existing ownership rules with explicit confirmation.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!activeSeason ? (
              <p className="text-sm text-muted-foreground">Activate a season before making ownership corrections.</p>
            ) : !seasonOwnership ? (
              <p className="text-sm text-muted-foreground">Ownership data is not available for the active season.</p>
            ) : (
              <>
                <div className="grid gap-3 md:grid-cols-3">
                  <select
                    className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                    onChange={(event) => setSelectedAssignUserId(event.target.value)}
                    value={selectedAssignUserId}
                  >
                    <option value="">Select owner</option>
                    {ownerSelectionOptions.map((owner) => (
                      <option key={owner.leagueMemberId} value={owner.userId}>
                        {owner.displayName} ({owner.teamCount}/3)
                      </option>
                    ))}
                  </select>
                  <select
                    className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                    onChange={(event) => setSelectedAssignTeamId(event.target.value)}
                    value={selectedAssignTeamId}
                  >
                    <option value="">Select available team</option>
                    {availableTeams.map((team) => (
                      <option key={team.id} value={team.id}>
                        {team.abbreviation} - {team.name}
                      </option>
                    ))}
                  </select>
                  <Button
                    disabled={isMutating || !selectedAssignUserId || !selectedAssignTeamId || !canManageLeague}
                    onClick={() => void handleAssignTeam()}
                    type="button"
                  >
                    Confirm Assignment
                  </Button>
                </div>

                {selectedAssignTeamId ? (
                  <div className="rounded-lg border border-border bg-background px-3 py-2 text-foreground">
                    <NFLTeamLabel
                      size="default"
                      team={availableTeams.find((team) => team.id === selectedAssignTeamId)!}
                    />
                  </div>
                ) : null}

                <div className="space-y-3">
                  {ownershipOwners.map((owner) => (
                    <div className="rounded-lg border border-border p-4" key={owner.leagueMemberId}>
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="font-medium text-foreground">{owner.displayName}</p>
                          <p className="text-sm text-muted-foreground">
                            {owner.role} | {owner.teamCount}/3 teams assigned
                          </p>
                        </div>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {owner.teams.length > 0 ? (
                          owner.teams.map((entry) => (
                            <div
                              className="flex items-center gap-2 rounded-full bg-secondary px-3 py-1 text-sm text-secondary-foreground"
                              key={entry.ownershipId}
                            >
                              <NFLTeamLabel size="compact" team={entry.team} />
                              <Button
                                className="h-7 px-2"
                                disabled={isMutating || !canManageLeague}
                                onClick={() =>
                                  void handleRemoveTeam(
                                    entry.ownershipId,
                                    `${entry.team.abbreviation} - ${entry.team.name}`,
                                    owner.displayName
                                  )
                                }
                                type="button"
                                variant="ghost"
                              >
                                Remove
                              </Button>
                            </div>
                          ))
                        ) : (
                          <span className="text-sm text-muted-foreground">No teams assigned.</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>
        ) : null}
      </div>
      ) : null}

      {confirmation ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <Card className="w-full max-w-lg">
            <CardHeader>
              <CardTitle>{confirmation.title}</CardTitle>
              <CardDescription>{confirmation.message}</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap justify-end gap-3">
              <Button
                disabled={isMutating}
                onClick={() => setConfirmation(null)}
                type="button"
                variant="outline"
              >
                Cancel
              </Button>
              <Button
                disabled={isMutating}
                onClick={() => void confirmation.onConfirm()}
                type="button"
                variant={confirmation.confirmVariant ?? "default"}
              >
                {confirmation.confirmLabel}
              </Button>
            </CardContent>
          </Card>
        </div>
      ) : null}
    </section>
  );
}
