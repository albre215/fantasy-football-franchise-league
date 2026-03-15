"use client";

import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type {
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
  activeSeasonAssignedTeamCount: number;
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

function buildDefaultDraftOrder(memberIds: string[]) {
  return [...memberIds].reverse();
}

function updateDraftOrderSlot(order: string[], index: number, leagueMemberId: string) {
  const nextOrder = [...order];
  nextOrder[index] = leagueMemberId;
  return nextOrder;
}

function getDraftOrderSelectOptions(
  members: LeagueBootstrapMember[],
  draftOrder: string[],
  slotIndex: number
) {
  return members.filter((member) => {
    const selectedInOtherSlot = draftOrder.some(
      (selectedOwnerId, selectedIndex) => selectedIndex !== slotIndex && selectedOwnerId === member.id
    );

    return !selectedInOtherSlot || draftOrder[slotIndex] === member.id;
  });
}

function getDraftOrderReadiness(memberIds: string[], sourceSeasonId: string, draftOrder: string[]) {
  const filledSlots = draftOrder.filter(Boolean).length;
  const uniqueSelectedOwnerCount = new Set(draftOrder.filter(Boolean)).size;
  const hasSourceSeason = Boolean(sourceSeasonId);
  const hasAllSlotsFilled = filledSlots === memberIds.length;
  const hasAllUniqueOwners = filledSlots === uniqueSelectedOwnerCount;
  const includesAllOwners = memberIds.every((memberId) => draftOrder.includes(memberId));
  const isReady = hasSourceSeason && hasAllSlotsFilled && hasAllUniqueOwners && includesAllOwners;

  return {
    hasSourceSeason,
    filledSlots,
    hasAllSlotsFilled,
    uniqueSelectedOwnerCount,
    hasAllUniqueOwners,
    includesAllOwners,
    isReady
  };
}

function getDraftOrderValidationMessage(
  memberIds: string[],
  sourceSeasonId: string,
  draftOrder: string[],
  activeSeasonAssignedTeamCount: number
) {
  if (activeSeasonAssignedTeamCount > 0) {
    return "Cannot initialize offseason draft because the target season already has assigned teams.";
  }

  const readiness = getDraftOrderReadiness(memberIds, sourceSeasonId, draftOrder);

  if (!readiness.hasSourceSeason) {
    return "Select a previous season to initialize the offseason draft.";
  }

  if (!readiness.hasAllSlotsFilled) {
    return "Draft order must contain all 10 owners exactly once.";
  }

  if (!readiness.hasAllUniqueOwners) {
    return "Duplicate owners are not allowed.";
  }

  if (!readiness.includesAllOwners) {
    return "Each owner must appear exactly once in the draft order.";
  }

  return null;
}

export function OffseasonDraftPanel({
  leagueId,
  activeSeason,
  activeSeasonAssignedTeamCount,
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
  const [keeperSelections, setKeeperSelections] = useState<Record<string, string[]>>({});
  const [currentPickTeamId, setCurrentPickTeamId] = useState("");

  const sourceSeasonOptions = useMemo(
    () => seasons.filter((season) => season.id !== activeSeason?.id),
    [activeSeason?.id, seasons]
  );
  const orderedMemberIds = useMemo(() => members.map((member) => member.id), [members]);
  const draftOrderReadiness = useMemo(
    () => getDraftOrderReadiness(orderedMemberIds, selectedSourceSeasonId, draftOrderLeagueMemberIds),
    [draftOrderLeagueMemberIds, orderedMemberIds, selectedSourceSeasonId]
  );
  const draftOrderValidationMessage = useMemo(
    () =>
      getDraftOrderValidationMessage(
        orderedMemberIds,
        selectedSourceSeasonId,
        draftOrderLeagueMemberIds,
        activeSeasonAssignedTeamCount
      ),
    [activeSeasonAssignedTeamCount, draftOrderLeagueMemberIds, orderedMemberIds, selectedSourceSeasonId]
  );
  const remainingOwners = useMemo(
    () => members.filter((member) => !draftOrderLeagueMemberIds.includes(member.id)),
    [draftOrderLeagueMemberIds, members]
  );

  useEffect(() => {
    if (!activeSeason) {
      setSelectedSourceSeasonId("");
      setDraftOrderLeagueMemberIds([]);
      setKeeperSelections({});
      setCurrentPickTeamId("");
      return;
    }

    if (draftState) {
      setSelectedSourceSeasonId(draftState.draft.sourceSeasonId);
      setDraftOrderLeagueMemberIds(draftState.picks.map((pick) => pick.selectingLeagueMemberId));
      setKeeperSelections(
        Object.fromEntries(
          draftState.members.map((member) => [
            member.leagueMemberId,
            member.keepers.map((keeper) => keeper.nflTeam.id)
          ])
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
    setDraftOrderLeagueMemberIds(buildDefaultDraftOrder(orderedMemberIds));
    setKeeperSelections({});
    setCurrentPickTeamId("");
  }, [activeSeason, draftState, orderedMemberIds, sourceSeasonOptions]);

  function toggleKeeperSelection(leagueMemberId: string, nflTeamId: string) {
    setKeeperSelections((current) => {
      const existing = current[leagueMemberId] ?? [];

      if (existing.includes(nflTeamId)) {
        return {
          ...current,
          [leagueMemberId]: existing.filter((id) => id !== nflTeamId)
        };
      }

      if (existing.length >= 2) {
        return current;
      }

      return {
        ...current,
        [leagueMemberId]: [...existing, nflTeamId]
      };
    });
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

    await withMutation(
      async () => {
        const response = await fetch(`/api/season/${activeSeason.id}/draft/keepers`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            draftId: draftState.draft.id,
            leagueMemberId,
            nflTeamIds: keeperSelections[leagueMemberId] ?? [],
            actingUserId
          })
        });

        await parseJsonResponse<SaveKeepersResponse>(response);
      },
      "Keepers saved."
    );
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
                  onChange={(event) => setSelectedSourceSeasonId(event.target.value)}
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
                          setDraftOrderLeagueMemberIds((current) => updateDraftOrderSlot(current, index, event.target.value))
                        }
                        value={draftOrderLeagueMemberIds[index] ?? ""}
                      >
                        <option value="">Select owner</option>
                        {getDraftOrderSelectOptions(members, draftOrderLeagueMemberIds, index).map((option) => (
                          <option key={option.id} value={option.id}>
                            {option.displayName}
                          </option>
                        ))}
                      </select>
                    </label>
                  ))}
                </div>
                {draftOrderValidationMessage && (
                  <p className="text-sm text-red-600">{draftOrderValidationMessage}</p>
                )}
                <div className="rounded-lg border border-dashed border-border p-3 text-sm text-muted-foreground">
                  {remainingOwners.length === 0
                    ? "All owners are assigned to a draft slot."
                    : `Remaining owners: ${remainingOwners.map((member) => member.displayName).join(", ")}`}
                </div>
              </div>
            </div>

            <div className="space-y-4 rounded-lg border border-border p-4 text-sm text-muted-foreground">
              <p>League ID: {leagueId}</p>
              <p>Target season: {formatSeasonLabel(activeSeason)}</p>
              <p>Owners in draft: {members.length} / 10</p>
              <p>Target season assigned teams: {activeSeasonAssignedTeamCount} / 0 required</p>
              <p>Expected keepers: 20 total</p>
              <p>Expected draft pool: 12 teams</p>
              <p>Expected draft picks: 10</p>
              <div className="space-y-1 rounded-lg border border-border p-3">
                <p>Target season has no ownership assignments: {activeSeasonAssignedTeamCount === 0 ? "Pass" : "Fail"}</p>
                <p>Source season selected: {draftOrderReadiness.hasSourceSeason ? "Pass" : "Fail"}</p>
                <p>
                  10 draft slots filled: {draftOrderReadiness.hasAllSlotsFilled ? "Pass" : "Fail"} (
                  {draftOrderReadiness.filledSlots}/{members.length})
                </p>
                <p>
                  All owners unique: {draftOrderReadiness.hasAllUniqueOwners ? "Pass" : "Fail"} (
                  {draftOrderReadiness.uniqueSelectedOwnerCount}/{members.length})
                </p>
                <p>All eligible owners included: {draftOrderReadiness.includesAllOwners ? "Pass" : "Fail"}</p>
                <p>Draft order ready: {draftOrderReadiness.isReady ? "Yes" : "No"}</p>
              </div>
              <Button
                className="w-full"
                disabled={
                  isSubmitting ||
                  activeSeason.isLocked ||
                  activeSeasonAssignedTeamCount > 0 ||
                  !draftOrderReadiness.isReady
                }
                onClick={() => void handleInitializeDraft()}
                type="button"
              >
                Initialize Offseason Draft
              </Button>
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
                      const selectedKeepers = keeperSelections[member.leagueMemberId] ?? [];
                      const canEdit = draftState.draft.status === "PLANNING" && !draftState.draft.isTargetSeasonLocked;

                      return (
                        <div className="rounded-lg border border-border p-4" key={member.leagueMemberId}>
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                              <p className="font-medium text-foreground">{member.displayName}</p>
                              <p className="text-sm text-muted-foreground">Keepers {member.keeperCount}/2</p>
                            </div>
                            <Button
                              disabled={isSubmitting || !canEdit || selectedKeepers.length !== 2}
                              onClick={() => void handleSaveKeepers(member.leagueMemberId)}
                              type="button"
                              variant="outline"
                            >
                              Save Keepers
                            </Button>
                          </div>
                          <div className="mt-3 flex flex-wrap gap-2">
                            {member.previousSeasonTeams.map((team) => {
                              const isSelected = selectedKeepers.includes(team.id);

                              return (
                                <button
                                  className={`rounded-full border px-3 py-2 text-sm ${
                                    isSelected
                                      ? "border-foreground bg-secondary text-secondary-foreground"
                                      : "border-border text-muted-foreground"
                                  }`}
                                  disabled={!canEdit}
                                  key={team.id}
                                  onClick={() => toggleKeeperSelection(member.leagueMemberId, team.id)}
                                  type="button"
                                >
                                  {team.abbreviation} - {team.name} {isSelected ? "(Keeper)" : ""}
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
