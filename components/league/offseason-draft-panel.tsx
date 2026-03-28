"use client";

import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type {
  DraftOrderRecommendationResponse,
  DraftState,
  FinalizeDraftResponse,
  InitializeDraftResponse,
  MakeDraftPickResponse,
  PauseDraftResponse,
  ResumeDraftResponse,
  SaveKeepersResponse,
  StartDraftResponse
} from "@/types/draft";
import type { LeagueBootstrapMember } from "@/types/league";
import type { SeasonSummary } from "@/types/season";

interface OffseasonDraftPanelProps {
  leagueId: string;
  activeSeason: SeasonSummary | null;
  seasons: SeasonSummary[];
  members: LeagueBootstrapMember[];
  draftState: DraftState | null;
  isSubmitting: boolean;
  actingUserId: string;
  onStartSubmit: () => void;
  onEndSubmit: () => void;
  onError: (message: string) => void;
  onSuccess: (message: string) => void;
  onRefresh: () => Promise<void>;
}

async function parseJsonResponse<T>(response: Response): Promise<T> {
  const payload = (await response.json()) as T & { error?: string };

  if (!response.ok) {
    throw new Error(payload.error ?? "Request failed.");
  }

  return payload;
}

function formatSeasonLabel(season: { year: number; name: string | null }) {
  return season.name ?? `${season.year} Season`;
}

export function OffseasonDraftPanel({
  leagueId,
  activeSeason,
  seasons,
  members,
  draftState,
  isSubmitting,
  actingUserId,
  onStartSubmit,
  onEndSubmit,
  onError,
  onSuccess,
  onRefresh
}: OffseasonDraftPanelProps) {
  const [selectedSourceSeasonId, setSelectedSourceSeasonId] = useState("");
  const [draftOrderLeagueMemberIds, setDraftOrderLeagueMemberIds] = useState<string[]>([]);
  const [keeperSelectionsByOwner, setKeeperSelectionsByOwner] = useState<Record<string, string[]>>({});
  const [dirtyKeeperOwners, setDirtyKeeperOwners] = useState<Record<string, boolean>>({});
  const [savingKeeperOwners, setSavingKeeperOwners] = useState<Record<string, boolean>>({});
  const [keeperFeedbackByOwner, setKeeperFeedbackByOwner] = useState<
    Record<string, { type: "success" | "error"; message: string } | undefined>
  >({});
  const [pendingSavedKeeperSelectionsByOwner, setPendingSavedKeeperSelectionsByOwner] = useState<
    Record<string, string[] | undefined>
  >({});
  const [currentPickTeamId, setCurrentPickTeamId] = useState("");
  const [recommendedOrder, setRecommendedOrder] = useState<DraftOrderRecommendationResponse["recommendation"] | null>(null);
  const [isLoadingRecommendedOrder, setIsLoadingRecommendedOrder] = useState(false);
  const [recommendedOrderError, setRecommendedOrderError] = useState<string | null>(null);

  const sourceSeasonOptions = useMemo(
    () => seasons.filter((season) => season.id !== activeSeason?.id),
    [activeSeason?.id, seasons]
  );
  const savedKeeperSelectionsByOwner = useMemo(
    () =>
      Object.fromEntries(
        (draftState?.members ?? []).map((member) => [
          member.leagueMemberId,
          member.keepers.map((keeper) => keeper.nflTeam.id)
        ])
      ),
    [draftState]
  );

  useEffect(() => {
    if (!activeSeason) {
      setSelectedSourceSeasonId("");
      setDraftOrderLeagueMemberIds([]);
      setRecommendedOrder(null);
      setRecommendedOrderError(null);
      setKeeperSelectionsByOwner({});
      setDirtyKeeperOwners({});
      setSavingKeeperOwners({});
      setKeeperFeedbackByOwner({});
      setPendingSavedKeeperSelectionsByOwner({});
      setCurrentPickTeamId("");
      return;
    }

    if (draftState) {
      setSelectedSourceSeasonId(draftState.draft.sourceSeasonId);
      setDraftOrderLeagueMemberIds(draftState.picks.map((pick) => pick.selectingLeagueMemberId));
      setKeeperSelectionsByOwner((current) =>
        Object.fromEntries(
          draftState.members.map((member) => [
            member.leagueMemberId,
            pendingSavedKeeperSelectionsByOwner[member.leagueMemberId] &&
            member.keepers.map((keeper) => keeper.nflTeam.id).join("|") !==
              pendingSavedKeeperSelectionsByOwner[member.leagueMemberId]?.join("|")
              ? current[member.leagueMemberId] ??
                pendingSavedKeeperSelectionsByOwner[member.leagueMemberId] ??
                member.keepers.map((keeper) => keeper.nflTeam.id)
              : dirtyKeeperOwners[member.leagueMemberId]
              ? current[member.leagueMemberId] ?? member.keepers.map((keeper) => keeper.nflTeam.id)
              : pendingSavedKeeperSelectionsByOwner[member.leagueMemberId] ??
                member.keepers.map((keeper) => keeper.nflTeam.id)
          ])
        )
      );
      setPendingSavedKeeperSelectionsByOwner((current) =>
        Object.fromEntries(
          draftState.members.map((member) => {
            const savedKeepers = member.keepers.map((keeper) => keeper.nflTeam.id);
            const pendingKeepers = current[member.leagueMemberId];

            return [
              member.leagueMemberId,
              pendingKeepers && pendingKeepers.join("|") !== savedKeepers.join("|") ? pendingKeepers : undefined
            ];
          })
        )
      );
      setCurrentPickTeamId((current) =>
        draftState.draftPool.some((team) => team.id === current) ? current : draftState.draftPool[0]?.id ?? ""
      );
      return;
    }

    setSelectedSourceSeasonId((current) =>
      sourceSeasonOptions.some((season) => season.id === current) ? current : sourceSeasonOptions[0]?.id ?? ""
    );
    setDraftOrderLeagueMemberIds(Array.from({ length: members.length }, () => ""));
    setRecommendedOrder(null);
    setRecommendedOrderError(null);
    setKeeperSelectionsByOwner({});
    setDirtyKeeperOwners({});
    setSavingKeeperOwners({});
    setKeeperFeedbackByOwner({});
    setPendingSavedKeeperSelectionsByOwner({});
    setCurrentPickTeamId("");
  }, [activeSeason, dirtyKeeperOwners, draftState, members, pendingSavedKeeperSelectionsByOwner, sourceSeasonOptions]);

  useEffect(() => {
    if (!activeSeason || draftState || !selectedSourceSeasonId) {
      if (!selectedSourceSeasonId) {
        setRecommendedOrder(null);
        setRecommendedOrderError(null);
        setDraftOrderLeagueMemberIds((current) =>
          current.length === members.length ? current : Array.from({ length: members.length }, () => "")
        );
      }
      return;
    }

    void (async () => {
      setIsLoadingRecommendedOrder(true);
      setRecommendedOrderError(null);

      try {
        const response = await fetch(
          `/api/season/${activeSeason.id}/draft/recommended-order?sourceSeasonId=${selectedSourceSeasonId}`,
          { cache: "no-store" }
        );
        const data = await parseJsonResponse<DraftOrderRecommendationResponse>(response);
        setRecommendedOrder(data.recommendation);
        setDraftOrderLeagueMemberIds((current) => {
          const currentHasValues = current.some(Boolean);
          const nextOrder = data.recommendation.entries.map((entry) => entry.leagueMemberId);

          if (!currentHasValues) {
            return nextOrder;
          }

          return current;
        });
      } catch (error) {
        setRecommendedOrder(null);
        setRecommendedOrderError(
          error instanceof Error
            ? error.message
            : "Enter final standings for the source season before auto-generating draft order."
        );
        setDraftOrderLeagueMemberIds(Array.from({ length: members.length }, () => ""));
      } finally {
        setIsLoadingRecommendedOrder(false);
      }
    })();
  }, [activeSeason, draftState, members.length, selectedSourceSeasonId]);

  const filledDraftSlots = draftOrderLeagueMemberIds.filter(Boolean).length;
  const uniqueDraftOwners = new Set(draftOrderLeagueMemberIds.filter(Boolean)).size;
  const includesEveryEligibleOwner =
    members.length > 0 && members.every((member) => draftOrderLeagueMemberIds.includes(member.id));
  const allDraftOwnersUnique = filledDraftSlots === uniqueDraftOwners;
  const draftOrderReady =
    filledDraftSlots === members.length &&
    allDraftOwnersUnique &&
    includesEveryEligibleOwner &&
    Boolean(selectedSourceSeasonId) &&
    Boolean(recommendedOrder);
  const matchesRecommendedOrder =
    Boolean(recommendedOrder) &&
    recommendedOrder!.entries.every((entry, index) => draftOrderLeagueMemberIds[index] === entry.leagueMemberId);

  function toggleKeeperSelection(leagueMemberId: string, nflTeamId: string) {
    setKeeperSelectionsByOwner((current) => {
      const existing = current[leagueMemberId] ?? [];
      let nextSelection: string[];

      if (existing.includes(nflTeamId)) {
        nextSelection = existing.filter((id) => id !== nflTeamId);
      } else if (existing.length >= 2) {
        nextSelection = existing;
      } else {
        nextSelection = [...existing, nflTeamId];
      }

      setDirtyKeeperOwners((dirty) => ({
        ...dirty,
        [leagueMemberId]: true
      }));

      return {
        ...current,
        [leagueMemberId]: nextSelection
      };
    });
  }

  function resetKeeperSelection(leagueMemberId: string) {
    const hasSavedSelection = (savedKeeperSelectionsByOwner[leagueMemberId] ?? []).length > 0;

    setKeeperSelectionsByOwner((current) => ({
      ...current,
      [leagueMemberId]: []
    }));
    setDirtyKeeperOwners((current) => ({
      ...current,
      [leagueMemberId]: hasSavedSelection
    }));
    setKeeperFeedbackByOwner((current) => ({
      ...current,
      [leagueMemberId]: undefined
    }));
    setPendingSavedKeeperSelectionsByOwner((current) => ({
      ...current,
      [leagueMemberId]: undefined
    }));
  }

  async function withMutation<T>(run: () => Promise<T>, successMessage: string) {
    onError("");
    onSuccess("");
    onStartSubmit();

    try {
      await run();
      onSuccess(successMessage);
      await onRefresh();
    } catch (error) {
      onError(error instanceof Error ? error.message : "Request failed.");
    } finally {
      onEndSubmit();
    }
  }

  async function handleInitializeDraft() {
    if (!activeSeason) {
      return;
    }

    await withMutation(
      async () => {
        const response = await fetch(`/api/season/${activeSeason.id}/draft`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            sourceSeasonId: selectedSourceSeasonId,
            actingUserId,
            orderLeagueMemberIds: draftOrderLeagueMemberIds
          })
        });

        await parseJsonResponse<InitializeDraftResponse>(response);
      },
      "Offseason draft initialized. Save two keepers for each owner before starting the draft."
    );
  }

  async function handleSaveKeepers(leagueMemberId: string) {
    if (!activeSeason || !draftState) {
      return;
    }

    setKeeperFeedbackByOwner((current) => ({
      ...current,
      [leagueMemberId]: undefined
    }));
    setPendingSavedKeeperSelectionsByOwner((current) => ({
      ...current,
      [leagueMemberId]: keeperSelectionsByOwner[leagueMemberId] ?? []
    }));
    setSavingKeeperOwners((current) => ({
      ...current,
      [leagueMemberId]: true
    }));

    try {
      const response = await fetch(`/api/season/${activeSeason.id}/draft/keepers`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          draftId: draftState.draft.id,
          leagueMemberId,
          nflTeamIds: keeperSelectionsByOwner[leagueMemberId] ?? [],
          actingUserId
        })
      });

      await parseJsonResponse<SaveKeepersResponse>(response);
      setDirtyKeeperOwners((current) => ({
        ...current,
        [leagueMemberId]: false
      }));
      setKeeperFeedbackByOwner((current) => ({
        ...current,
        [leagueMemberId]: undefined
      }));
      await onRefresh();
    } catch (error) {
      setKeeperFeedbackByOwner((current) => ({
        ...current,
        [leagueMemberId]: {
          type: "error",
          message: error instanceof Error ? error.message : "Request failed."
        }
      }));
    } finally {
      setSavingKeeperOwners((current) => ({
        ...current,
        [leagueMemberId]: false
      }));
    }
  }

  async function handleDraftAction(
    endpoint: "start" | "pause" | "resume" | "finalize",
    successMessage: string
  ) {
    if (!activeSeason || !draftState) {
      return;
    }

    await withMutation(
      async () => {
        const response = await fetch(`/api/season/${activeSeason.id}/draft/${endpoint}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            draftId: draftState.draft.id,
            actingUserId
          })
        });

        if (endpoint === "start") {
          await parseJsonResponse<StartDraftResponse>(response);
        } else if (endpoint === "pause") {
          await parseJsonResponse<PauseDraftResponse>(response);
        } else if (endpoint === "resume") {
          await parseJsonResponse<ResumeDraftResponse>(response);
        } else {
          await parseJsonResponse<FinalizeDraftResponse>(response);
        }
      },
      successMessage
    );
  }

  async function handleMakePick() {
    if (!activeSeason || !draftState) {
      return;
    }

    await withMutation(
      async () => {
        const response = await fetch(`/api/season/${activeSeason.id}/draft/pick`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            draftId: draftState.draft.id,
            nflTeamId: currentPickTeamId,
            actingUserId
          })
        });

        await parseJsonResponse<MakeDraftPickResponse>(response);
      },
      "Draft pick recorded."
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Offseason Draft</CardTitle>
        <CardDescription>
          Initialize the annual slow draft, save keepers, record picks, and finalize the new season.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {!activeSeason ? (
          <div className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
            Create or activate a season first. The offseason draft always targets the current active season.
          </div>
        ) : !draftState ? (
          <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Source Season</label>
                <select
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  onChange={(event) => {
                    setSelectedSourceSeasonId(event.target.value);
                    setRecommendedOrder(null);
                    setRecommendedOrderError(null);
                    setDraftOrderLeagueMemberIds(Array.from({ length: members.length }, () => ""));
                  }}
                  value={selectedSourceSeasonId}
                >
                  <option value="">Select previous season</option>
                  {sourceSeasonOptions.map((season) => (
                    <option key={season.id} value={season.id}>
                      {formatSeasonLabel(season)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-3">
                <p className="text-sm font-medium">Draft Order</p>
                <p className="text-sm text-muted-foreground">
                  Enter the reverse standings order for the 10 owners. This draft is one offseason round.
                </p>
                <div className="grid gap-3 md:grid-cols-2">
                  {members.map((member, index) => (
                    <label className="space-y-1 text-sm" key={`${member.id}-slot`}>
                      <span>Pick {index + 1}</span>
                      <select
                        className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                        onChange={(event) =>
                          setDraftOrderLeagueMemberIds((current) => {
                            const next = [...current];
                            next[index] = event.target.value;
                            return next;
                          })
                        }
                        value={draftOrderLeagueMemberIds[index] ?? ""}
                      >
                        <option value="">Select owner</option>
                        {members
                          .filter(
                            (option) =>
                              option.id === draftOrderLeagueMemberIds[index] ||
                              !draftOrderLeagueMemberIds.includes(option.id)
                          )
                          .map((option) => (
                          <option key={option.id} value={option.id}>
                            {option.displayName}
                          </option>
                          ))}
                      </select>
                    </label>
                  ))}
                </div>
                <div className="space-y-2 rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
                  {isLoadingRecommendedOrder ? (
                    <p>Generating recommended reverse-standings order...</p>
                  ) : recommendedOrder ? (
                    <>
                      <p className="font-medium text-foreground">Generated from final standings</p>
                      <p>
                        Reverse of saved standings for{" "}
                        {formatSeasonLabel({
                          year: recommendedOrder.sourceSeasonYear,
                          name: recommendedOrder.sourceSeasonName
                        })}
                        .
                      </p>
                      <p>
                        Champion: {recommendedOrder.champion?.displayName ?? "Not available"} · Last place:{" "}
                        {recommendedOrder.lastPlace?.displayName ?? "Not available"}
                      </p>
                      <p>
                        {matchesRecommendedOrder
                          ? "Using recommended reverse-standings order."
                          : "Order has been manually adjusted."}
                      </p>
                    </>
                  ) : (
                    <p>{recommendedOrderError ?? "Select a source season to generate reverse-standings draft order."}</p>
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-4 rounded-lg border border-border p-4 text-sm text-muted-foreground">
              <p>League ID: {leagueId}</p>
              <p>Target season: {formatSeasonLabel(activeSeason)}</p>
              <p>Owners in draft: {members.length} / 10</p>
              <p>Expected keepers: 20 total</p>
              <p>Expected draft pool: 12 teams</p>
              <p>Expected draft picks: 10</p>
              <p>10 draft slots filled: {filledDraftSlots === members.length ? `Pass (${filledDraftSlots}/10)` : `Fail (${filledDraftSlots}/10)`}</p>
              <p>All owners unique: {allDraftOwnersUnique ? `Pass (${uniqueDraftOwners}/10)` : "Fail"}</p>
              <p>All eligible owners included: {includesEveryEligibleOwner ? "Pass" : "Fail"}</p>
              <p>Draft order ready: {draftOrderReady ? "Yes" : "No"}</p>
              <Button
                className="w-full"
                disabled={
                  isSubmitting ||
                  activeSeason.isLocked ||
                  !draftOrderReady
                }
                onClick={() => void handleInitializeDraft()}
                type="button"
              >
                Initialize Offseason Draft
              </Button>
              {!recommendedOrder && (
                <div className="rounded-lg border border-dashed border-border p-3">
                  Enter final standings for the source season before auto-generating draft order.
                </div>
              )}
            </div>
          </div>
        ) : (
          <>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded-lg border border-border p-4 text-sm text-muted-foreground">
                <p className="font-medium text-foreground">Draft Status</p>
                <p>{draftState.draft.status}</p>
                <p>
                  Target season:{" "}
                  {formatSeasonLabel({
                    year: draftState.draft.targetSeasonYear,
                    name: draftState.draft.targetSeasonName
                  })}
                </p>
                <p>
                  Source season:{" "}
                  {formatSeasonLabel({
                    year: draftState.draft.sourceSeasonYear,
                    name: draftState.draft.sourceSeasonName
                  })}
                </p>
              </div>
              <div className="rounded-lg border border-border p-4 text-sm text-muted-foreground">
                <p className="font-medium text-foreground">Keeper Progress</p>
                <p>
                  {draftState.keeperProgress.completeOwners} / {draftState.keeperProgress.totalOwners} owners complete
                </p>
                <p>Keepers saved: {draftState.draft.keeperCount} / 20</p>
                <p>Draft pool: {draftState.draftPool.length} teams</p>
              </div>
              <div className="rounded-lg border border-border p-4 text-sm text-muted-foreground">
                <p className="font-medium text-foreground">Draft Progress</p>
                <p>
                  Picks completed: {draftState.draft.picksCompleted} / {draftState.draft.totalPicks}
                </p>
                <p>Current pick: {draftState.currentPick?.overallPickNumber ?? "Complete"}</p>
                <p>{draftState.draft.isTargetSeasonLocked ? "Target season is locked." : "Target season is editable."}</p>
              </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Keeper Selection Workspace</CardTitle>
                    <CardDescription>
                      Each owner keeps exactly 2 teams from the source season. The third team enters the draft pool.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {draftState.members.map((member) => {
                      const selectedKeepers = keeperSelectionsByOwner[member.leagueMemberId] ?? [];
                      const savedKeepers =
                        pendingSavedKeeperSelectionsByOwner[member.leagueMemberId] ??
                        savedKeeperSelectionsByOwner[member.leagueMemberId] ??
                        [];
                      const hasUnsavedChanges = Boolean(dirtyKeeperOwners[member.leagueMemberId]);
                      const isOwnerSaving = Boolean(savingKeeperOwners[member.leagueMemberId]);
                      const feedback = keeperFeedbackByOwner[member.leagueMemberId];
                      const canEdit = draftState.draft.status === "PLANNING" && !draftState.draft.isTargetSeasonLocked;
                      const canSaveKeepers = canEdit && !isOwnerSaving && selectedKeepers.length === 2 && hasUnsavedChanges;
                      const selectedCountLabel = `${selectedKeepers.length}/2 selected`;

                      let statusLabel = "Choose 2 keepers";

                      if (isOwnerSaving) {
                        statusLabel = "Saving...";
                      } else if (hasUnsavedChanges) {
                        statusLabel = "Unsaved changes";
                      } else if (savedKeepers.length === 2) {
                        statusLabel = "Saved and up to date";
                      }

                      return (
                        <div className="rounded-lg border border-border p-4" key={member.leagueMemberId}>
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                              <p className="font-medium text-foreground">{member.displayName}</p>
                              <p className="text-sm text-muted-foreground">{selectedCountLabel}</p>
                              <p className="text-sm text-muted-foreground">{statusLabel}</p>
                            </div>
                            <div className="flex gap-2">
                              <Button
                                disabled={!canSaveKeepers}
                                onClick={() => void handleSaveKeepers(member.leagueMemberId)}
                                type="button"
                                variant={canSaveKeepers ? "default" : "secondary"}
                              >
                                Save Keepers
                              </Button>
                              <Button
                                disabled={isOwnerSaving || !canEdit || selectedKeepers.length === 0}
                                onClick={() => resetKeeperSelection(member.leagueMemberId)}
                                type="button"
                                variant="ghost"
                              >
                                Reset
                              </Button>
                            </div>
                          </div>
                          {feedback ? (
                            <p
                              className={`mt-3 text-sm ${
                                feedback.type === "success" ? "text-emerald-700" : "text-destructive"
                              }`}
                            >
                              {feedback.message}
                            </p>
                          ) : null}
                          <div className="mt-3 flex flex-wrap gap-2">
                            {member.previousSeasonTeams.map((team) => {
                              const isSelected = selectedKeepers.includes(team.id);
                              const isSaved = savedKeepers.includes(team.id);
                              const isSavedSelection = isSelected && isSaved && !hasUnsavedChanges;
                              const isWorkingSelection = isSelected && !isSavedSelection;

                              return (
                                <button
                                  className={`rounded-full border px-3 py-2 text-sm ${
                                    isSavedSelection
                                      ? "border-emerald-300 bg-emerald-50 text-emerald-900"
                                      : isWorkingSelection
                                      ? "border-foreground bg-secondary text-secondary-foreground"
                                      : "border-border text-muted-foreground"
                                  }`}
                                  disabled={!canEdit}
                                  key={team.id}
                                  onClick={() => toggleKeeperSelection(member.leagueMemberId, team.id)}
                                  type="button"
                                >
                                  {team.abbreviation} - {team.name}
                                </button>
                              );
                            })}
                          </div>
                          {member.draftedTeam && (
                            <p className="mt-3 text-sm text-muted-foreground">
                              Drafted team: {member.draftedTeam.abbreviation} - {member.draftedTeam.name}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Draft Board</CardTitle>
                    <CardDescription>Follow the full order and current pick.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {draftState.picks.map((pick) => (
                      <div
                        className={`rounded-lg border p-3 text-sm ${
                          draftState.currentPick?.id === pick.id ? "border-foreground bg-secondary/40" : "border-border"
                        }`}
                        key={pick.id}
                      >
                        <p className="font-medium text-foreground">
                          Pick {pick.overallPickNumber}: {pick.selectingDisplayName}
                        </p>
                        <p className="text-muted-foreground">
                          {pick.selectedNflTeam
                            ? `${pick.selectedNflTeam.abbreviation} - ${pick.selectedNflTeam.name}`
                            : "Waiting for selection"}
                        </p>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </div>

              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Draft Pool</CardTitle>
                    <CardDescription>Teams currently available to be drafted.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {draftState.draftPool.length === 0 ? (
                      <p className="text-sm text-muted-foreground">Draft pool is empty.</p>
                    ) : (
                      draftState.draftPool.map((team) => (
                        <div className="rounded-lg border border-border p-3 text-sm" key={team.id}>
                          {team.abbreviation} - {team.name}
                        </div>
                      ))
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Draft Controls</CardTitle>
                    <CardDescription>
                      Start, pause, resume, and finalize the slow draft from this panel.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4 text-sm text-muted-foreground">
                    <p>Status: {draftState.draft.status}</p>
                    <p>
                      Current pick:{" "}
                      {draftState.currentPick
                        ? `${draftState.currentPick.overallPickNumber} - ${draftState.currentPick.selectingDisplayName}`
                        : "No current pick"}
                    </p>
                    {draftState.draft.status === "ACTIVE" && draftState.currentPick && (
                      <div className="space-y-3">
                        <select
                          className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                          onChange={(event) => setCurrentPickTeamId(event.target.value)}
                          value={currentPickTeamId}
                        >
                          <option value="">Select draft team</option>
                          {draftState.draftPool.map((team) => (
                            <option key={team.id} value={team.id}>
                              {team.abbreviation} - {team.name}
                            </option>
                          ))}
                        </select>
                        <Button
                          className="w-full"
                          disabled={isSubmitting || !currentPickTeamId}
                          onClick={() => void handleMakePick()}
                          type="button"
                        >
                          Record Pick
                        </Button>
                      </div>
                    )}
                    <div className="flex flex-wrap gap-3">
                      {draftState.draft.status === "PLANNING" && (
                        <Button
                          disabled={isSubmitting || !draftState.canStart}
                          onClick={() => void handleDraftAction("start", "Draft started.")}
                          type="button"
                        >
                          Start Draft
                        </Button>
                      )}
                      {draftState.draft.status === "ACTIVE" && (
                        <Button
                          disabled={isSubmitting}
                          onClick={() => void handleDraftAction("pause", "Draft paused.")}
                          type="button"
                          variant="outline"
                        >
                          Pause Draft
                        </Button>
                      )}
                      {draftState.draft.status === "PAUSED" && (
                        <Button
                          disabled={isSubmitting}
                          onClick={() => void handleDraftAction("resume", "Draft resumed.")}
                          type="button"
                          variant="outline"
                        >
                          Resume Draft
                        </Button>
                      )}
                      <Button
                        disabled={isSubmitting || !draftState.canFinalize}
                        onClick={() => void handleDraftAction("finalize", "Draft finalized into season ownership.")}
                        type="button"
                        variant="secondary"
                      >
                        Finalize Draft
                      </Button>
                    </div>
                    <div className="rounded-lg border border-dashed border-border p-3">
                      {draftState.draft.status === "COMPLETED"
                        ? "Draft completed. Team ownership for the target season has been created."
                        : "Save two keepers for every owner, start the draft, record one pick per owner, then finalize."}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
