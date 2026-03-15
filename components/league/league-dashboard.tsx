"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { OffseasonDraftPanel } from "@/components/league/offseason-draft-panel";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { DraftState, DraftStateResponse } from "@/types/draft";
import type {
  AddLeagueMemberResponse,
  LeagueBootstrapStateResponse,
  LeagueListItem,
  ListLeaguesResponse,
  RemoveLeagueMemberResponse
} from "@/types/league";
import type {
  CreateSeasonResponse,
  LockSeasonResponse,
  SeasonListResponse,
  UnlockSeasonResponse
} from "@/types/season";
import type {
  AssignTeamResponse,
  RemoveTeamOwnershipResponse,
  SeasonOwnershipResponse
} from "@/types/team-ownership";

interface LeagueDashboardProps {
  leagueId?: string;
}

const MOCK_COMMISSIONER_USER_ID = "mock-user-1";

async function parseJsonResponse<T>(response: Response): Promise<T> {
  const payload = (await response.json()) as T & { error?: string };

  if (!response.ok) {
    throw new Error(payload.error ?? "Request failed.");
  }

  return payload;
}

export function LeagueDashboard({ leagueId }: LeagueDashboardProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [leagueOptions, setLeagueOptions] = useState<LeagueListItem[]>([]);
  const [bootstrapState, setBootstrapState] = useState<LeagueBootstrapStateResponse["bootstrapState"] | null>(null);
  const [seasons, setSeasons] = useState<SeasonListResponse["seasons"]>([]);
  const [seasonOwnership, setSeasonOwnership] = useState<SeasonOwnershipResponse["ownership"] | null>(null);
  const [draftState, setDraftState] = useState<DraftState | null>(null);
  const [ownershipError, setOwnershipError] = useState<string | null>(null);
  const [seasonYear, setSeasonYear] = useState(new Date().getFullYear().toString());
  const [seasonName, setSeasonName] = useState("");
  const [memberDisplayName, setMemberDisplayName] = useState("");
  const [memberEmail, setMemberEmail] = useState("");
  const [memberMockUserKey, setMemberMockUserKey] = useState("");
  const [selectedOwnerId, setSelectedOwnerId] = useState("");
  const [selectedTeamId, setSelectedTeamId] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const activeSeason = bootstrapState?.activeSeason ?? null;
  const members = bootstrapState?.members ?? [];
  const ownershipOwners = seasonOwnership?.owners ?? [];
  const availableTeams = seasonOwnership?.availableTeams ?? [];

  const ownerSelectionOptions = useMemo(
    () => ownershipOwners.filter((owner) => owner.teamCount < 3),
    [ownershipOwners]
  );

  async function refreshLeagueDashboard(currentLeagueId: string) {
    setIsLoading(true);

    try {
      const [listResponse, bootstrapResponse, seasonsResponse] = await Promise.all([
        fetch("/api/league/list", { cache: "no-store" }),
        fetch(`/api/league/${currentLeagueId}/bootstrap-state`, { cache: "no-store" }),
        fetch(`/api/league/${currentLeagueId}/season/list`, { cache: "no-store" })
      ]);

      const [listData, bootstrapData, seasonsData] = await Promise.all([
        parseJsonResponse<ListLeaguesResponse>(listResponse),
        parseJsonResponse<LeagueBootstrapStateResponse>(bootstrapResponse),
        parseJsonResponse<SeasonListResponse>(seasonsResponse)
      ]);

      setLeagueOptions(listData.leagues);
      setBootstrapState(bootstrapData.bootstrapState);
      setSeasons(seasonsData.seasons);
      setOwnershipError(null);

      if (!bootstrapData.bootstrapState.activeSeason) {
        setSeasonOwnership(null);
        setDraftState(null);
        setOwnershipError(null);
        setSelectedOwnerId("");
        setSelectedTeamId("");
        return;
      }

      const seasonId = bootstrapData.bootstrapState.activeSeason.id;
      try {
        const ownershipResponse = await fetch(`/api/season/${seasonId}/ownership`, { cache: "no-store" });
        const ownershipData = await parseJsonResponse<SeasonOwnershipResponse>(ownershipResponse);

        setSeasonOwnership(ownershipData.ownership);
        setSelectedOwnerId((current) => {
          const validOwnerIds = ownershipData.ownership.owners
            .filter((owner) => owner.teamCount < 3)
            .map((owner) => owner.userId);

          return validOwnerIds.includes(current) ? current : validOwnerIds[0] ?? "";
        });
        setSelectedTeamId((current) =>
          ownershipData.ownership.availableTeams.some((team) => team.id === current)
            ? current
            : ownershipData.ownership.availableTeams[0]?.id ?? ""
        );
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Unable to load active-season ownership.";

        if (process.env.NODE_ENV !== "production") {
          console.error("Active-season ownership load failed:", message);
        }

        setSeasonOwnership(null);
        setOwnershipError(message);
        setSelectedOwnerId("");
        setSelectedTeamId("");
      }

      try {
        const draftResponse = await fetch(`/api/season/${seasonId}/draft`, { cache: "no-store" });
        const draftData = await parseJsonResponse<DraftStateResponse>(draftResponse);
        setDraftState(draftData.draft);
      } catch (error) {
        if (process.env.NODE_ENV !== "production") {
          console.error("Draft state load failed:", error);
        }

        setDraftState(null);
      }
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void (async () => {
      if (!leagueId) {
        try {
          setIsLoading(true);
          const listResponse = await fetch("/api/league/list", { cache: "no-store" });
          const listData = await parseJsonResponse<ListLeaguesResponse>(listResponse);
          setLeagueOptions(listData.leagues);
        } catch (error) {
          setErrorMessage(error instanceof Error ? error.message : "Unable to load leagues.");
        } finally {
          setIsLoading(false);
        }

        return;
      }

      try {
        await refreshLeagueDashboard(leagueId);
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : "Unable to load league.");
        setIsLoading(false);
      }
    })();
  }, [leagueId]);

  async function handleCreateSeason(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!leagueId) {
      return;
    }

    setErrorMessage(null);
    setSuccessMessage(null);
    setIsSubmitting(true);

    try {
      const response = await fetch(`/api/league/${leagueId}/season/create`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          year: Number(seasonYear),
          name: seasonName || undefined
        })
      });
      const data = await parseJsonResponse<CreateSeasonResponse>(response);

      setSeasonName("");
      setSuccessMessage(`Created season ${data.season.name ?? data.season.year}.`);
      await refreshLeagueDashboard(leagueId);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to create season.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleSetActiveSeason(seasonId: string) {
    if (!leagueId) {
      return;
    }

    setErrorMessage(null);
    setSuccessMessage(null);
    setIsSubmitting(true);

    try {
      const response = await fetch(`/api/league/${leagueId}/season/set-active`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ seasonId })
      });

      await parseJsonResponse(response);
      setSuccessMessage("Active season updated.");
      await refreshLeagueDashboard(leagueId);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to set active season.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleAddMember(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!leagueId) {
      return;
    }

    setErrorMessage(null);
    setSuccessMessage(null);
    setIsSubmitting(true);

    try {
      const response = await fetch(`/api/league/${leagueId}/members/add`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          displayName: memberDisplayName,
          email: memberEmail,
          mockUserKey: memberMockUserKey || undefined
        })
      });
      const data = await parseJsonResponse<AddLeagueMemberResponse>(response);

      setMemberDisplayName("");
      setMemberEmail("");
      setMemberMockUserKey("");
      setSuccessMessage(`Added ${data.member.displayName} to the league.`);
      await refreshLeagueDashboard(leagueId);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to add member.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleRemoveMember(leagueMemberId: string) {
    if (!leagueId) {
      return;
    }

    setErrorMessage(null);
    setSuccessMessage(null);
    setIsSubmitting(true);

    try {
      const response = await fetch(`/api/league/${leagueId}/members/remove`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ leagueMemberId })
      });
      const data = await parseJsonResponse<RemoveLeagueMemberResponse>(response);

      setSuccessMessage(`Removed member ${data.removedLeagueMemberId}.`);
      await refreshLeagueDashboard(leagueId);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to remove member.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleAssignTeam(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!activeSeason || !selectedOwnerId || !selectedTeamId) {
      setErrorMessage("Active season, member, and team are required.");
      return;
    }

    setErrorMessage(null);
    setSuccessMessage(null);
    setIsSubmitting(true);

    try {
      const response = await fetch(`/api/season/${activeSeason.id}/assign-team`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          userId: selectedOwnerId,
          nflTeamId: selectedTeamId
        })
      });
      const data = await parseJsonResponse<AssignTeamResponse>(response);

      setSuccessMessage(`Assigned ${data.ownership.team.name} to ${data.ownership.displayName}.`);
      await refreshLeagueDashboard(leagueId!);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to assign team.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleLockSeason() {
    if (!activeSeason) {
      return;
    }

    setErrorMessage(null);
    setSuccessMessage(null);
    setIsSubmitting(true);

    try {
      const response = await fetch(`/api/season/${activeSeason.id}/lock`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          actingUserId: MOCK_COMMISSIONER_USER_ID
        })
      });
      const data = await parseJsonResponse<LockSeasonResponse>(response);

      setSuccessMessage(`Locked ${data.season.name ?? data.season.year}.`);
      await refreshLeagueDashboard(leagueId!);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to lock season.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleUnlockSeason() {
    if (!activeSeason) {
      return;
    }

    setErrorMessage(null);
    setSuccessMessage(null);
    setIsSubmitting(true);

    try {
      const response = await fetch(`/api/season/${activeSeason.id}/unlock`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          actingUserId: MOCK_COMMISSIONER_USER_ID
        })
      });
      const data = await parseJsonResponse<UnlockSeasonResponse>(response);

      setSuccessMessage(`Unlocked ${data.season.name ?? data.season.year}. Fix setup issues, then relock the season.`);
      await refreshLeagueDashboard(leagueId!);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to unlock season.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleRemoveTeam(teamOwnershipId: string, teamName: string) {
    if (!activeSeason) {
      return;
    }

    setErrorMessage(null);
    setSuccessMessage(null);
    setIsSubmitting(true);

    try {
      const response = await fetch(`/api/season/${activeSeason.id}/remove-team`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          teamOwnershipId,
          actingUserId: MOCK_COMMISSIONER_USER_ID
        })
      });
      await parseJsonResponse<RemoveTeamOwnershipResponse>(response);

      setSuccessMessage(`Removed ${teamName} from its owner.`);
      await refreshLeagueDashboard(leagueId!);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to remove team.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (!leagueId) {
    return (
      <main className="container py-12">
        <div className="max-w-3xl space-y-4">
          <h1 className="text-3xl font-semibold tracking-tight">League Dashboard</h1>
          <p className="text-muted-foreground">Select a league to open the commissioner bootstrap console.</p>
        </div>
        <div className="mt-8 grid gap-4 md:grid-cols-2">
          {leagueOptions.length === 0 ? (
            <Card>
              <CardHeader>
                <CardTitle>No leagues available</CardTitle>
                <CardDescription>Create a league from the home page to get started.</CardDescription>
              </CardHeader>
            </Card>
          ) : (
            leagueOptions.map((option) => (
              <Card key={option.id}>
                <CardHeader>
                  <CardTitle>{option.name}</CardTitle>
                  <CardDescription>{option.description ?? "No description provided yet."}</CardDescription>
                </CardHeader>
                <CardContent>
                  <Link className={buttonVariants()} href={`/league?leagueId=${option.id}`}>
                    Open League
                  </Link>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </main>
    );
  }

  const hasActiveSeason = Boolean(activeSeason);
  const isLocked = Boolean(activeSeason?.isLocked);
  const lockState = bootstrapState?.lockReadiness.state ?? "NOT_READY";

  return (
    <main className="container py-12">
      <div className="max-w-6xl space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="space-y-2">
            <h1 className="text-3xl font-semibold tracking-tight">League Bootstrap Console</h1>
            <p className="text-muted-foreground">
              Set up the real current season from an already-completed offseason draft.
            </p>
          </div>
          <Link className={buttonVariants({ variant: "outline" })} href="/">
            Back to Home
          </Link>
        </div>

        {(errorMessage || successMessage) && (
          <Card className={errorMessage ? "bg-red-50" : "bg-emerald-50"}>
            <CardContent className="p-4 text-sm">{errorMessage ?? successMessage}</CardContent>
          </Card>
        )}

        {!bootstrapState && !errorMessage && (
          <Card>
            <CardContent className="p-6 text-sm text-muted-foreground">
              {isLoading ? "Loading bootstrap console..." : "League not found."}
            </CardContent>
          </Card>
        )}

        {bootstrapState && (
          <>
            <Card>
              <CardHeader>
                <CardTitle>League Details</CardTitle>
                <CardDescription>Core league information for the current bootstrap session.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3 text-sm text-muted-foreground md:grid-cols-4">
                <p>League: {bootstrapState.league.name}</p>
                <p>League ID: {bootstrapState.league.id}</p>
                <p>
                  Commissioner: {bootstrapState.league.commissioner?.displayName ?? MOCK_COMMISSIONER_USER_ID}
                </p>
                <p>Members: {bootstrapState.memberCount} / 10</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Bootstrap Summary</CardTitle>
                <CardDescription>
                  Current readiness for locking the active season after member and team entry.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3 text-sm text-muted-foreground md:grid-cols-3">
                <p>Active season: {activeSeason ? activeSeason.name ?? activeSeason.year : "None selected"}</p>
                <p>Assigned teams: {bootstrapState.assignedTeamCount} / 30</p>
                <p>Unassigned teams: {bootstrapState.unassignedTeamCount} / 2</p>
                <p>Every member has 3 teams: {bootstrapState.everyMemberHasExactlyThreeTeams ? "Yes" : "No"}</p>
                <p>
                  Ready to lock: {bootstrapState.lockReadiness.isReadyToLock ? "Yes" : "No"}
                </p>
                <p>
                  Status: {lockState === "LOCKED" ? "Locked" : lockState === "READY_TO_LOCK" ? "Ready to Lock" : "Not Ready"}
                </p>
                <p>Commissioner actions use mock identity: {MOCK_COMMISSIONER_USER_ID}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Season Management</CardTitle>
                <CardDescription>
                  Create seasons, pick the current active season, and keep bootstrap work focused on that season only.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
                <div className="space-y-4">
                  <form className="space-y-4" onSubmit={handleCreateSeason}>
                    <div className="space-y-2">
                      <label className="text-sm font-medium" htmlFor="season-year">
                        Create New Season
                      </label>
                      <Input
                        id="season-year"
                        inputMode="numeric"
                        onChange={(event) => setSeasonYear(event.target.value)}
                        placeholder="Season year"
                        value={seasonYear}
                      />
                      <Input
                        onChange={(event) => setSeasonName(event.target.value)}
                        placeholder="Optional season name"
                        value={seasonName}
                      />
                    </div>
                    <Button disabled={isSubmitting} type="submit">
                      Create Season
                    </Button>
                  </form>

                  <div className="rounded-lg border border-border p-4 text-sm text-muted-foreground">
                    {hasActiveSeason
                      ? `Active season: ${activeSeason?.name ?? activeSeason?.year} - ${isLocked ? "Locked" : "Open"}`
                      : "Create or activate a season first. All bootstrap actions run against the active season only."}
                  </div>
                  {hasActiveSeason && (
                    <div className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
                      Only the commissioner can lock or unlock the season in the current mock identity flow.
                    </div>
                  )}
                </div>

                <div className="space-y-3">
                  {seasons.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
                      No seasons exist yet.
                    </div>
                  ) : (
                    seasons.map((season) => (
                      <div
                        className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-4"
                        key={season.id}
                      >
                        <div>
                          <p className="font-medium text-foreground">{season.name ?? `${season.year} Season`}</p>
                          <p className="text-sm text-muted-foreground">
                            {season.status} - {season.isLocked ? "Locked" : "Open"}
                          </p>
                        </div>
                        <Button
                          disabled={isSubmitting || season.status === "ACTIVE"}
                          onClick={() => void handleSetActiveSeason(season.id)}
                          type="button"
                          variant={season.status === "ACTIVE" ? "secondary" : "outline"}
                        >
                          {season.status === "ACTIVE" ? "Active Season" : "Set Active"}
                        </Button>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>

            <OffseasonDraftPanel
              actingUserId={MOCK_COMMISSIONER_USER_ID}
              activeSeason={activeSeason}
              draftState={draftState}
              isSubmitting={isSubmitting}
              leagueId={leagueId}
              members={members}
              onEndSubmit={() => setIsSubmitting(false)}
              onError={(message) => setErrorMessage(message || null)}
              onRefresh={() => refreshLeagueDashboard(leagueId)}
              onStartSubmit={() => {
                setErrorMessage(null);
                setSuccessMessage(null);
                setIsSubmitting(true);
              }}
              onSuccess={(message) => setSuccessMessage(message || null)}
              seasons={seasons}
            />

            <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
              <Card>
                <CardHeader>
                  <CardTitle>Members Management</CardTitle>
                  <CardDescription>
                    Add league members manually, review their assignment counts, and remove only when safe.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <form className="grid gap-3 md:grid-cols-4" onSubmit={handleAddMember}>
                    <Input
                      onChange={(event) => setMemberDisplayName(event.target.value)}
                      placeholder="Display name"
                      value={memberDisplayName}
                    />
                    <Input
                      onChange={(event) => setMemberEmail(event.target.value)}
                      placeholder="Email"
                      type="email"
                      value={memberEmail}
                    />
                    <Input
                      onChange={(event) => setMemberMockUserKey(event.target.value)}
                      placeholder="Optional mock user key"
                      value={memberMockUserKey}
                    />
                    <Button
                      disabled={isSubmitting || !hasActiveSeason || isLocked || !memberDisplayName || !memberEmail}
                      type="submit"
                    >
                      Add Member
                    </Button>
                  </form>

                  {!hasActiveSeason && (
                    <div className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
                      Create or activate a season first. Member bootstrap is tied to the current active season.
                    </div>
                  )}

                  <div className="space-y-3">
                    {members.map((member) => (
                      <div
                        className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-4"
                        key={member.id}
                      >
                        <div>
                          <p className="font-medium text-foreground">{member.displayName}</p>
                          <p className="text-sm text-muted-foreground">
                            {member.email} - {member.role}
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="rounded-full bg-secondary px-3 py-1 text-sm text-secondary-foreground">
                            {member.assignmentCount}/3
                          </span>
                          <Button
                            disabled={isSubmitting || !member.canRemove}
                            onClick={() => void handleRemoveMember(member.id)}
                            type="button"
                            variant="outline"
                          >
                            Remove
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Team Assignment Workspace</CardTitle>
                  <CardDescription>
                    Assign available NFL teams to members for the active season.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {!hasActiveSeason ? (
                    <div className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
                      Create or activate a season first to assign NFL teams.
                    </div>
                  ) : (
                    <>
                      <form className="grid gap-3 md:grid-cols-3" onSubmit={handleAssignTeam}>
                        <select
                          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                          onChange={(event) => setSelectedOwnerId(event.target.value)}
                          value={selectedOwnerId}
                        >
                          <option value="">Select member</option>
                          {ownerSelectionOptions.map((owner) => (
                            <option key={owner.leagueMemberId} value={owner.userId}>
                              {owner.displayName} ({owner.teamCount}/3)
                            </option>
                          ))}
                        </select>
                        <select
                          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                          onChange={(event) => setSelectedTeamId(event.target.value)}
                          value={selectedTeamId}
                        >
                          <option value="">Select available NFL team</option>
                          {availableTeams.map((team) => (
                            <option key={team.id} value={team.id}>
                              {team.abbreviation} - {team.name}
                            </option>
                          ))}
                        </select>
                        <Button
                          disabled={isSubmitting || isLocked || !selectedOwnerId || !selectedTeamId}
                          type="submit"
                        >
                          Assign Team
                        </Button>
                      </form>

                      {isLocked && (
                        <div className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
                          Season Locked. Unlock the season to fix setup mistakes, then relock it.
                        </div>
                      )}
                    </>
                  )}
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
              <Card>
                <CardHeader>
                  <CardTitle>Ownership Table</CardTitle>
                  <CardDescription>Member-to-team ownership for the active season.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {!hasActiveSeason ? (
                    <p className="text-sm text-muted-foreground">No active season selected.</p>
                  ) : ownershipError ? (
                    <p className="text-sm text-red-600">{ownershipError}</p>
                  ) : !seasonOwnership ? (
                    <p className="text-sm text-muted-foreground">Unable to load active-season ownership.</p>
                  ) : (
                    ownershipOwners.map((owner) => (
                        <div className="rounded-lg border border-border p-4" key={owner.leagueMemberId}>
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                              <p className="font-medium text-foreground">{owner.displayName}</p>
                              <p className="text-sm text-muted-foreground">
                                {owner.role} - {owner.teamCount}/3 teams assigned
                              </p>
                            </div>
                            <p className="text-sm text-muted-foreground">{owner.email}</p>
                          </div>
                          <div className="mt-3 flex flex-wrap gap-2">
                            {owner.teams.length > 0 ? (
                              owner.teams.map((entry) => (
                                <div
                                  className="flex items-center gap-2 rounded-full bg-secondary px-3 py-1 text-sm text-secondary-foreground"
                                  key={entry.ownershipId}
                                >
                                  <span>{entry.team.abbreviation} - {entry.team.name}</span>
                                  <Button
                                    className="h-7 px-2"
                                    disabled={isSubmitting || isLocked}
                                    onClick={() => void handleRemoveTeam(entry.ownershipId, entry.team.name)}
                                    type="button"
                                    variant="ghost"
                                  >
                                    Remove Team
                                  </Button>
                                </div>
                              ))
                            ) : (
                              <span className="text-sm text-muted-foreground">No NFL teams assigned.</span>
                            )}
                          </div>
                        </div>
                      ))
                  )}
                </CardContent>
              </Card>

              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Unassigned Teams</CardTitle>
                    <CardDescription>
                      These are the two teams that should remain unused when setup is complete.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {!hasActiveSeason ? (
                      <p className="text-sm text-muted-foreground">No active season selected.</p>
                    ) : ownershipError ? (
                      <p className="text-sm text-red-600">{ownershipError}</p>
                    ) : !seasonOwnership ? (
                      <p className="text-sm text-muted-foreground">Unable to load active-season ownership.</p>
                    ) : availableTeams.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No unassigned teams remain.</p>
                    ) : (
                      availableTeams.map((team) => (
                        <div className="rounded-lg border border-border p-3 text-sm" key={team.id}>
                          {team.abbreviation} - {team.name}
                        </div>
                      ))
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Setup Validation Card</CardTitle>
                    <CardDescription>
                      Follow this checklist until the season is ready to lock.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    <p>Overall status: {lockState === "LOCKED" ? "Locked" : lockState === "READY_TO_LOCK" ? "Ready to Lock" : "Not Ready"}</p>
                    <p>Active season exists: {bootstrapState.lockReadiness.hasActiveSeason ? "Pass" : "Fail"}</p>
                    <p>10 members required: {bootstrapState.lockReadiness.hasExactlyTenMembers ? "Pass" : "Fail"}</p>
                    <p>30 assigned teams required: {bootstrapState.lockReadiness.hasThirtyAssignedTeams ? "Pass" : "Fail"}</p>
                    <p>2 unassigned teams required: {bootstrapState.lockReadiness.hasTwoUnassignedTeams ? "Pass" : "Fail"}</p>
                    <p>
                      Every member has exactly 3 teams: {bootstrapState.lockReadiness.everyMemberHasExactlyThreeTeams ? "Pass" : "Fail"}
                    </p>
                    <div className="rounded-lg border border-border p-3">
                      {members.map((member) => (
                        <p key={member.id}>
                          {member.displayName}: {member.assignmentCount}/3 {member.assignmentCount === 3 ? "Pass" : "Fail"}
                        </p>
                      ))}
                    </div>
                    <Button
                      disabled={isSubmitting || !bootstrapState.lockReadiness.isReadyToLock || isLocked}
                      onClick={() => void handleLockSeason()}
                      type="button"
                      variant="secondary"
                    >
                      {isLocked ? "Season Locked" : "Lock Season"}
                    </Button>
                    {isLocked && (
                      <Button
                        disabled={isSubmitting}
                        onClick={() => void handleUnlockSeason()}
                        type="button"
                        variant="outline"
                      >
                        Unlock Season
                      </Button>
                    )}
                    {!isLocked && (
                      <p className="text-muted-foreground">
                        This action is only available to the commissioner.
                      </p>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
