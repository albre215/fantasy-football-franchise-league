"use client";

import { useEffect, useMemo, useState } from "react";

import { NFLTeamLabel } from "@/components/shared/nfl-team-label";
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
  leagueCode?: string | null;
  activeSeason: SeasonSummary | null;
  seasons: SeasonSummary[];
  members: LeagueBootstrapMember[];
  draftState: DraftState | null;
  isDraftStateLoading: boolean;
  isSubmitting: boolean;
  canManageDraft: boolean;
  accessMessage?: string | null;
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

async function preserveScrollPosition<T>(run: () => Promise<T>, anchorId?: string) {
  if (typeof window === "undefined") {
    return run();
  }

  const activeElement =
    document.activeElement instanceof HTMLElement ? document.activeElement : null;
  const activeAnchor = anchorId
    ? document.querySelector<HTMLElement>(`[data-scroll-anchor-id="${anchorId}"]`)
    : activeElement?.closest<HTMLElement>("[data-scroll-anchor-id]") ?? null;
  const anchorSnapshot = activeAnchor
    ? {
        id: activeAnchor.dataset.scrollAnchorId ?? "",
        top: activeAnchor.getBoundingClientRect().top
      }
    : null;
  const scrollX = window.scrollX;
  const scrollY = window.scrollY;
  let isFinished = false;
  let trailingFrames = 12;
  let animationFrameId = 0;
  let userInterrupted = false;

  activeElement?.blur();

  function restorePosition() {
    if (userInterrupted) {
      return;
    }

    const anchorTarget =
      anchorSnapshot?.id
        ? document.querySelector<HTMLElement>(`[data-scroll-anchor-id="${anchorSnapshot.id}"]`)
        : null;

    if (anchorSnapshot && anchorTarget) {
      const nextTop = anchorTarget.getBoundingClientRect().top;
      const delta = nextTop - anchorSnapshot.top;

      window.scrollTo({
        left: scrollX,
        top: scrollY + delta,
        behavior: "auto"
      });
    } else {
      window.scrollTo({
        left: scrollX,
        top: scrollY,
        behavior: "auto"
      });
    }

    if (!isFinished || trailingFrames > 0) {
      if (isFinished) {
        trailingFrames -= 1;
      }

      animationFrameId = requestAnimationFrame(restorePosition);
    }
  }

  function interruptPreservation() {
    userInterrupted = true;

    if (animationFrameId) {
      cancelAnimationFrame(animationFrameId);
      animationFrameId = 0;
    }
  }

  function handleUserScrollIntent(event: KeyboardEvent | WheelEvent | TouchEvent) {
    if (event instanceof KeyboardEvent) {
      if (!["ArrowUp", "ArrowDown", "PageUp", "PageDown", "Home", "End", " "].includes(event.key)) {
        return;
      }
    }

    interruptPreservation();
  }

  window.addEventListener("wheel", handleUserScrollIntent, { passive: true });
  window.addEventListener("touchmove", handleUserScrollIntent, { passive: true });
  window.addEventListener("keydown", handleUserScrollIntent);
  animationFrameId = requestAnimationFrame(restorePosition);

  try {
    return await run();
  } catch (error) {
    throw error;
  } finally {
    isFinished = true;

    const cleanup = () => {
      window.removeEventListener("wheel", handleUserScrollIntent);
      window.removeEventListener("touchmove", handleUserScrollIntent);
      window.removeEventListener("keydown", handleUserScrollIntent);
      if (!userInterrupted && animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
    };

    setTimeout(cleanup, 250);
  }
}

export function OffseasonDraftPanel({
  leagueId,
  leagueCode,
  activeSeason,
  seasons,
  members,
  draftState,
  isDraftStateLoading,
  isSubmitting,
  canManageDraft,
  accessMessage,
  onStartSubmit,
  onEndSubmit,
  onError,
  onSuccess,
  onRefresh
}: OffseasonDraftPanelProps) {
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
  const [isPreparingDraftWorkspace, setIsPreparingDraftWorkspace] = useState(false);
  const [hasAttemptedWorkspacePreparation, setHasAttemptedWorkspacePreparation] = useState(false);

  const previousSeason = useMemo(() => {
    if (!activeSeason) {
      return null;
    }

    return seasons.find((season) => season.id !== activeSeason.id && season.year === activeSeason.year - 1) ?? null;
  }, [activeSeason, seasons]);
  const setupSourceSeasonId = draftState?.draft.sourceSeasonId ?? previousSeason?.id ?? "";
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
      setDraftOrderLeagueMemberIds([]);
      setRecommendedOrder(null);
      setRecommendedOrderError(null);
      setKeeperSelectionsByOwner({});
      setDirtyKeeperOwners({});
      setSavingKeeperOwners({});
      setKeeperFeedbackByOwner({});
      setPendingSavedKeeperSelectionsByOwner({});
      setCurrentPickTeamId("");
      setIsPreparingDraftWorkspace(false);
      setHasAttemptedWorkspacePreparation(false);
      return;
    }

    if (draftState) {
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
      setIsPreparingDraftWorkspace(false);
      setHasAttemptedWorkspacePreparation(true);
      return;
    }

    setDraftOrderLeagueMemberIds(Array.from({ length: members.length }, () => ""));
    setRecommendedOrder(null);
    setRecommendedOrderError(null);
    setKeeperSelectionsByOwner({});
    setDirtyKeeperOwners({});
    setSavingKeeperOwners({});
    setKeeperFeedbackByOwner({});
    setPendingSavedKeeperSelectionsByOwner({});
    setCurrentPickTeamId("");
    setIsPreparingDraftWorkspace(false);
    setHasAttemptedWorkspacePreparation(false);
  }, [activeSeason, draftState, members, previousSeason]);

  useEffect(() => {
    if (!activeSeason || draftState || isDraftStateLoading || !setupSourceSeasonId) {
      if (!setupSourceSeasonId) {
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
          `/api/season/${activeSeason.id}/draft/recommended-order?sourceSeasonId=${setupSourceSeasonId}`,
          { cache: "no-store" }
        );
        const data = await parseJsonResponse<DraftOrderRecommendationResponse>(response);
        setRecommendedOrder(data.recommendation);
        setDraftOrderLeagueMemberIds((current) => {
          const currentHasValues = current.some(Boolean);
          const nextOrder = data.recommendation.entries.map((entry) => entry.targetLeagueMemberId ?? "");

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
            : "Source-season ledger totals are required before auto-generating draft order."
        );
        setDraftOrderLeagueMemberIds(Array.from({ length: members.length }, () => ""));
      } finally {
        setIsLoadingRecommendedOrder(false);
      }
    })();
  }, [activeSeason, draftState, isDraftStateLoading, members.length, setupSourceSeasonId]);

  useEffect(() => {
    if (
      !activeSeason ||
      draftState ||
      isDraftStateLoading ||
      !canManageDraft ||
      !setupSourceSeasonId ||
      !recommendedOrder ||
      !recommendedOrder.readiness.isReady ||
      isLoadingRecommendedOrder ||
      isPreparingDraftWorkspace ||
      hasAttemptedWorkspacePreparation
    ) {
      return;
    }

    void (async () => {
      setIsPreparingDraftWorkspace(true);
      setHasAttemptedWorkspacePreparation(true);
      onError("");
      onSuccess("");

      try {
        const response = await fetch(`/api/season/${activeSeason.id}/draft`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            sourceSeasonId: setupSourceSeasonId,
            orderLeagueMemberIds: recommendedOrder.entries
              .map((entry) => entry.targetLeagueMemberId)
              .filter((leagueMemberId): leagueMemberId is string => Boolean(leagueMemberId))
          })
        });

        await parseJsonResponse<InitializeDraftResponse>(response);
        onSuccess("Offseason draft workspace prepared. Save two keepers for each owner before starting the draft.");
        await onRefresh();
      } catch (error) {
        onError(error instanceof Error ? error.message : "Unable to prepare the offseason draft workspace.");
      } finally {
        setIsPreparingDraftWorkspace(false);
      }
    })();
  }, [
    activeSeason,
    canManageDraft,
    draftState,
    hasAttemptedWorkspacePreparation,
    isDraftStateLoading,
    isLoadingRecommendedOrder,
    isPreparingDraftWorkspace,
    onError,
    onRefresh,
    onSuccess,
    recommendedOrder,
    setupSourceSeasonId
  ]);

  const filledDraftSlots = draftOrderLeagueMemberIds.filter(Boolean).length;
  const uniqueDraftOwners = new Set(draftOrderLeagueMemberIds.filter(Boolean)).size;
  const includesEveryEligibleOwner =
    members.length > 0 && members.every((member) => draftOrderLeagueMemberIds.includes(member.id));
  const allDraftOwnersUnique = filledDraftSlots === uniqueDraftOwners;
  const draftOrderReady =
    filledDraftSlots === members.length &&
    allDraftOwnersUnique &&
    includesEveryEligibleOwner &&
    Boolean(setupSourceSeasonId) &&
    Boolean(recommendedOrder?.readiness.isReady);
  const matchesRecommendedOrder =
    Boolean(recommendedOrder) &&
    recommendedOrder!.entries.every((entry, index) => draftOrderLeagueMemberIds[index] === entry.targetLeagueMemberId);
  const hasUnsavedKeeperChanges = Object.values(dirtyKeeperOwners).some(Boolean);
  const isAnyKeeperSaveInFlight = Object.values(savingKeeperOwners).some(Boolean);
  const canStartDraftFromUi =
    Boolean(draftState?.canStart) && !hasUnsavedKeeperChanges && !isAnyKeeperSaveInFlight;
  const showPlanningDraftOrder = Boolean(
    draftState && (draftState.draft.status !== "PLANNING" || draftState.keeperProgress.isComplete)
  );

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
      await preserveScrollPosition(async () => {
        await run();
        onSuccess(successMessage);
        await onRefresh();
      }, "draft-controls");
    } catch (error) {
      onError(error instanceof Error ? error.message : "Request failed.");
    } finally {
      onEndSubmit();
    }
  }

  async function handleSaveKeepers(leagueMemberId: string) {
    if (!activeSeason || !draftState) {
      return;
    }

    try {
      setKeeperFeedbackByOwner((current) => ({
        ...current,
        [leagueMemberId]: undefined
      }));
      await preserveScrollPosition(
        async () => {
          setPendingSavedKeeperSelectionsByOwner((current) => ({
            ...current,
            [leagueMemberId]: keeperSelectionsByOwner[leagueMemberId] ?? []
          }));
          setSavingKeeperOwners((current) => ({
            ...current,
            [leagueMemberId]: true
          }));

          const response = await fetch(`/api/season/${activeSeason.id}/draft/keepers`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              draftId: draftState.draft.id,
              leagueMemberId,
              nflTeamIds: keeperSelectionsByOwner[leagueMemberId] ?? []
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
        },
        `keeper-${leagueMemberId}`
      );
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
            draftId: draftState.draft.id
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
            nflTeamId: currentPickTeamId
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
        ) : isDraftStateLoading ? (
          <div className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
            Loading offseason draft state for the active season...
          </div>
        ) : !draftState ? (
          <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Source Season</label>
                <div className="space-y-2">
                  <div className="flex h-10 items-center rounded-md border border-input bg-background px-3 text-sm">
                    {previousSeason ? formatSeasonLabel(previousSeason) : "Previous season not found"}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    The offseason draft always uses the immediately previous season as its source season.
                  </p>
                </div>
              </div>
              <div className="space-y-3">
                <p className="text-sm font-medium">Keeper Selection</p>
                <p className="text-sm text-muted-foreground">
                  Keeper selection is the first offseason step. Once the previous season is valid, the draft workspace
                  is prepared automatically and owners can start locking in their two keepers.
                </p>
                <div className="space-y-2 rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
                  {!canManageDraft ? (
                    <p>
                      {accessMessage ??
                        "Only the league commissioner can prepare keeper selections and manage the offseason draft."}
                    </p>
                  ) : isPreparingDraftWorkspace ? (
                    <>
                      <p className="font-medium text-foreground">Preparing keeper workspace</p>
                      <p>Creating the offseason planning draft from the previous season's ledger totals.</p>
                    </>
                  ) : isLoadingRecommendedOrder ? (
                    <p>Checking previous-season ledger totals before preparing the keeper workspace...</p>
                  ) : recommendedOrder ? (
                    <>
                      <p className="font-medium text-foreground">
                        {recommendedOrder.readiness.isReady
                          ? "Keeper workspace is ready to prepare"
                          : "Keeper workspace is not ready yet"}
                      </p>
                      <p>
                        Ledger totals were reviewed for{" "}
                        {formatSeasonLabel({
                          year: recommendedOrder.sourceSeasonYear,
                          name: recommendedOrder.sourceSeasonName
                        })}
                        .
                      </p>
                      <p>
                        Lowest total: {recommendedOrder.lowestTotalOwner?.displayName ?? "Not available"} - Highest total:{" "}
                        {recommendedOrder.highestTotalOwner?.displayName ?? "Not available"}
                      </p>
                      <p>
                        Lowest ledger total: ${recommendedOrder.lowestTotalOwner?.ledgerTotal.toFixed(2) ?? "0.00"} - Highest
                        ledger total: ${recommendedOrder.highestTotalOwner?.ledgerTotal.toFixed(2) ?? "0.00"}
                      </p>
                      <p>
                        Ledger coverage: {recommendedOrder.readiness.ledgerCoverageStatus} - Owners with entries:{" "}
                        {recommendedOrder.readiness.ownersWithLedgerEntries}/10
                      </p>
                      {recommendedOrder.warnings.map((warning) => (
                        <p className="text-destructive" key={warning}>
                          {warning}
                        </p>
                      ))}
                      <p>
                        {recommendedOrder.readiness.isReady
                          ? "The planning draft will be prepared automatically so keeper selection can begin first."
                          : "Resolve the readiness warnings before the planning draft can be prepared automatically."}
                      </p>
                    </>
                  ) : (
                    <p>
                      {recommendedOrderError ??
                        "Source-season ledger totals are required before generating draft order."}
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-4 rounded-lg border border-border p-4 text-sm text-muted-foreground">
              <p>League Code: {leagueCode ?? leagueId}</p>
              <p>Target season: {formatSeasonLabel(activeSeason)}</p>
              <p>Owners in draft: {members.length} / 10</p>
              <p>Expected keepers: 20 total</p>
              <p>Expected draft pool: 12 teams</p>
              <p>Expected draft picks: 10</p>
              <p>Commissioner access: {canManageDraft ? "Pass" : "Read-only"}</p>
              <p>Previous season found: {previousSeason ? "Pass" : "Fail"}</p>
              <p>Ledger-based recommendation ready: {recommendedOrder?.readiness.isReady ? "Pass" : "Fail"}</p>
              <p>Keeper workspace prepared: {draftState ? "Yes" : isPreparingDraftWorkspace ? "In progress" : "No"}</p>
              {recommendedOrder && recommendedOrder.warnings.length > 0 ? (
                <div className="rounded-lg border border-dashed border-border p-3">
                  {recommendedOrder.warnings.map((warning) => (
                    <p key={warning}>{warning}</p>
                  ))}
                </div>
              ) : null}
              {!recommendedOrder?.readiness.isReady && (
                <div className="rounded-lg border border-dashed border-border p-3">
                  {previousSeason
                    ? "Complete the previous season's ledger totals and target-season mappings before preparing keeper selections."
                    : "Create the immediately previous season before preparing the offseason draft workspace."}
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
                    {!canManageDraft ? (
                      <div className="rounded-lg border border-dashed border-border bg-secondary/30 p-4 text-sm text-muted-foreground">
                        <p className="font-medium text-foreground">Read-only offseason draft view</p>
                        <p>
                          {accessMessage ??
                            "Only the league commissioner can change keeper selections or control the draft for this league."}
                        </p>
                      </div>
                    ) : null}
                    {draftState.keeperEditing.isLocked ? (
                      <div className="rounded-lg border border-dashed border-border bg-secondary/30 p-4 text-sm text-muted-foreground">
                        <p className="font-medium text-foreground">Keeper selections are locked.</p>
                        <p>{draftState.keeperEditing.lockReason}</p>
                      </div>
                    ) : null}
                    {draftState.members.map((member) => {
                      const selectedKeepers = keeperSelectionsByOwner[member.leagueMemberId] ?? [];
                      const savedKeepers =
                        pendingSavedKeeperSelectionsByOwner[member.leagueMemberId] ??
                        savedKeeperSelectionsByOwner[member.leagueMemberId] ??
                        [];
                      const hasUnsavedChanges = Boolean(dirtyKeeperOwners[member.leagueMemberId]);
                      const isOwnerSaving = Boolean(savingKeeperOwners[member.leagueMemberId]);
                      const feedback = keeperFeedbackByOwner[member.leagueMemberId];
                      const canEdit = canManageDraft && draftState.keeperEditing.canEdit;
                      const canSaveKeepers = canEdit && !isOwnerSaving && selectedKeepers.length === 2 && hasUnsavedChanges;
                      const selectedCountLabel = `${selectedKeepers.length}/2 selected`;

                      let statusLabel = "Choose 2 keepers";

                      if (isOwnerSaving) {
                        statusLabel = "Saving...";
                      } else if (!canEdit && savedKeepers.length === 2) {
                        statusLabel = "Locked after draft start";
                      } else if (!canEdit) {
                        statusLabel = "Keeper editing unavailable";
                      } else if (hasUnsavedChanges) {
                        statusLabel = "Unsaved changes";
                      } else if (savedKeepers.length === 2) {
                        statusLabel = "Saved and up to date";
                      }

                      return (
                        <div
                          className="rounded-lg border border-border p-4"
                          data-scroll-anchor-id={`keeper-${member.leagueMemberId}`}
                          key={member.leagueMemberId}
                        >
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
                          {!canEdit ? (
                            <p className="mt-3 text-sm text-muted-foreground">
                              Keepers are locked after the draft starts. Keeper selections can only be changed before
                              the draft begins.
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
                                  <NFLTeamLabel size="compact" team={team} />
                                </button>
                              );
                            })}
                          </div>
                          {member.draftedTeam && (
                            <p className="mt-3 text-sm text-muted-foreground">
                              Drafted team added. Final roster complete.
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </CardContent>
                </Card>

                {showPlanningDraftOrder ? (
                  <Card>
                    <CardHeader>
                      <CardTitle>{draftState.draft.status === "PLANNING" ? "Generated Draft Order" : "Draft Board"}</CardTitle>
                      <CardDescription>
                        {draftState.draft.status === "PLANNING"
                          ? "Ledger-total order for the upcoming offseason draft."
                          : "Follow the full order and current pick."}
                      </CardDescription>
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
                              ? ""
                              : draftState.draft.status === "PLANNING"
                              ? "Waiting for draft start"
                              : "Waiting for selection"}
                          </p>
                          {pick.selectedNflTeam ? (
                            <div className="mt-2 text-muted-foreground">
                              <NFLTeamLabel size="default" team={pick.selectedNflTeam} />
                            </div>
                          ) : null}
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                ) : (
                  <Card>
                    <CardHeader>
                      <CardTitle>Draft Order</CardTitle>
                      <CardDescription>
                        Finish saving keeper selections for all 10 owners before the generated draft order is shown.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="text-sm text-muted-foreground">
                      The draft order will appear automatically once every owner has exactly two saved keepers.
                    </CardContent>
                  </Card>
                )}
              </div>

              <div className="space-y-6">
                <Card data-scroll-anchor-id="draft-controls">
                  <CardHeader>
                    <CardTitle>Draft Pool</CardTitle>
                    <CardDescription>Teams currently available to be drafted.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2 lg:min-h-[44rem]">
                    {draftState.draftPool.length === 0 ? (
                      <p className="text-sm text-muted-foreground">Draft pool is empty.</p>
                    ) : (
                      draftState.draftPool.map((team) => (
                        <div className="rounded-lg border border-border p-3 text-sm" key={team.id}>
                          <NFLTeamLabel size="default" team={team} />
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
                        {currentPickTeamId ? (
                          <div className="rounded-lg border border-border bg-background px-3 py-2 text-foreground">
                            <NFLTeamLabel
                              size="default"
                              team={draftState.draftPool.find((team) => team.id === currentPickTeamId)!}
                            />
                          </div>
                        ) : null}
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
                          disabled={isSubmitting || !canStartDraftFromUi || !canManageDraft}
                          onClick={() => void handleDraftAction("start", "Draft started.")}
                          type="button"
                          variant={canStartDraftFromUi && canManageDraft ? "default" : "secondary"}
                        >
                          Start Draft
                        </Button>
                      )}
                      {draftState.draft.status === "ACTIVE" && (
                        <Button
                          disabled={isSubmitting || !canManageDraft}
                          onClick={() => void handleDraftAction("pause", "Draft paused.")}
                          type="button"
                          variant="outline"
                        >
                          Pause Draft
                        </Button>
                      )}
                      {draftState.draft.status === "PAUSED" && (
                        <Button
                          disabled={isSubmitting || !canManageDraft}
                          onClick={() => void handleDraftAction("resume", "Draft resumed.")}
                          type="button"
                          variant="outline"
                        >
                          Resume Draft
                        </Button>
                      )}
                      <Button
                        disabled={isSubmitting || !draftState.canFinalize || !canManageDraft}
                        onClick={() => void handleDraftAction("finalize", "Draft finalized into season ownership.")}
                        type="button"
                        variant="secondary"
                      >
                        Finalize Draft
                      </Button>
                    </div>
                    <div className="rounded-lg border border-dashed border-border p-3">
                      {!canManageDraft
                        ? accessMessage ??
                          "You can review this offseason draft, but only the league commissioner can change keeper selections or run draft actions."
                        : draftState.draft.status === "COMPLETED"
                        ? "Draft completed. Team ownership for the target season has been created."
                        : draftState.draft.status === "PLANNING" && hasUnsavedKeeperChanges
                        ? "Save all keeper changes before starting the draft. Unsaved keeper edits are still on the screen."
                        : draftState.draft.status === "PLANNING" && isAnyKeeperSaveInFlight
                        ? "Wait for keeper saves to finish before starting the draft."
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
