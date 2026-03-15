"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { LeagueDashboardResponse, LeagueListItem, ListLeaguesResponse } from "@/types/league";
import type {
  ActiveSeasonResponse,
  CreateSeasonResponse,
  LockSeasonResponse,
  SeasonListResponse,
  SeasonSetupStatusResponse
} from "@/types/season";
import type {
  AssignTeamResponse,
  NFLTeamsResponse,
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
  const [league, setLeague] = useState<LeagueDashboardResponse["league"] | null>(null);
  const [leagueOptions, setLeagueOptions] = useState<LeagueListItem[]>([]);
  const [activeSeason, setActiveSeason] = useState<ActiveSeasonResponse["season"] | null>(null);
  const [setupStatus, setSetupStatus] = useState<SeasonSetupStatusResponse["status"] | null>(null);
  const [seasonOwnership, setSeasonOwnership] = useState<SeasonOwnershipResponse["ownership"] | null>(null);
  const [unassignedTeams, setUnassignedTeams] = useState<NFLTeamsResponse["teams"]>([]);
  const [seasonYear, setSeasonYear] = useState(new Date().getFullYear().toString());
  const [seasonName, setSeasonName] = useState("");
  const [selectedSeasonId, setSelectedSeasonId] = useState("");
  const [selectedOwnerId, setSelectedOwnerId] = useState("");
  const [selectedTeamId, setSelectedTeamId] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const seasonOptions = league?.seasons ?? [];

  const ownerOptions = useMemo(() => seasonOwnership?.owners ?? [], [seasonOwnership]);

  async function refreshLeagueDashboard(currentLeagueId: string) {
    setIsLoading(true);

    try {
      const [listResponse, dashboardResponse, activeSeasonResponse] = await Promise.all([
        fetch("/api/league/list", { cache: "no-store" }),
        fetch(`/api/league/${currentLeagueId}`, { cache: "no-store" }),
        fetch(`/api/league/${currentLeagueId}/season/active`, { cache: "no-store" })
      ]);

      const [listData, dashboardData, activeSeasonData] = await Promise.all([
        parseJsonResponse<ListLeaguesResponse>(listResponse),
        parseJsonResponse<LeagueDashboardResponse>(dashboardResponse),
        parseJsonResponse<ActiveSeasonResponse>(activeSeasonResponse)
      ]);

      setLeagueOptions(listData.leagues);
      setLeague(dashboardData.league);
      setActiveSeason(activeSeasonData.season);

      const nextSelectedSeasonId =
        activeSeasonData.season?.id ??
        dashboardData.league.seasons.find((season) => season.id === selectedSeasonId)?.id ??
        dashboardData.league.seasons.find((season) => season.status === "ACTIVE")?.id ??
        dashboardData.league.seasons[0]?.id ??
        "";

      setSelectedSeasonId(nextSelectedSeasonId);

      const effectiveSeasonId = activeSeasonData.season?.id ?? nextSelectedSeasonId;

      if (!effectiveSeasonId) {
        setSetupStatus(null);
        setSeasonOwnership(null);
        setUnassignedTeams([]);
        return;
      }

      const [ownershipResponse, statusResponse, unassignedResponse] = await Promise.all([
        fetch(`/api/season/${effectiveSeasonId}/ownership`, { cache: "no-store" }),
        fetch(`/api/season/${effectiveSeasonId}/setup-status`, { cache: "no-store" }),
        fetch(`/api/season/${effectiveSeasonId}/unassigned-teams`, { cache: "no-store" })
      ]);

      const [ownershipData, statusData, unassignedData] = await Promise.all([
        parseJsonResponse<SeasonOwnershipResponse>(ownershipResponse),
        parseJsonResponse<SeasonSetupStatusResponse>(statusResponse),
        parseJsonResponse<NFLTeamsResponse>(unassignedResponse)
      ]);

      setSeasonOwnership(ownershipData.ownership);
      setSetupStatus(statusData.status);
      setUnassignedTeams(unassignedData.teams);
      setSelectedOwnerId((current) =>
        ownershipData.ownership.owners.some((owner) => owner.userId === current)
          ? current
          : ownershipData.ownership.owners[0]?.userId || ""
      );
      setSelectedTeamId((current) =>
        unassignedData.teams.some((team) => team.id === current) ? current : unassignedData.teams[0]?.id || ""
      );
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
      setSelectedSeasonId(data.season.id);
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
      setSelectedSeasonId(seasonId);
      setSuccessMessage("Active season updated.");
      await refreshLeagueDashboard(leagueId);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to set active season.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleAssignTeam(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!activeSeason || !selectedOwnerId || !selectedTeamId) {
      setErrorMessage("Active season, owner, and team are required.");
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
        method: "POST"
      });
      const data = await parseJsonResponse<LockSeasonResponse>(response);

      setSuccessMessage(`Locked ${data.season.name ?? data.season.year} for commissioner setup.`);
      await refreshLeagueDashboard(leagueId!);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to lock season.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (!leagueId) {
    return (
      <main className="container py-12">
        <div className="max-w-3xl space-y-4">
          <h1 className="text-3xl font-semibold tracking-tight">League Dashboard</h1>
          <p className="text-muted-foreground">Select a league to load its current members and season history.</p>
        </div>
        <div className="mt-8 grid gap-4 md:grid-cols-2">
          {leagueOptions.length === 0 ? (
            <Card>
              <CardHeader>
                <CardTitle>No leagues available</CardTitle>
                <CardDescription>Create a league from the home page to populate this dashboard.</CardDescription>
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

  const selectedSeason = seasonOptions.find((season) => season.id === selectedSeasonId) ?? activeSeason ?? null;

  return (
    <main className="container py-12">
      <div className="max-w-6xl space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="space-y-2">
            <h1 className="text-3xl font-semibold tracking-tight">League Dashboard</h1>
            <p className="text-muted-foreground">
              Commissioner-focused setup tools for preparing the current league year from a completed offseason draft.
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

        {!league && !errorMessage && (
          <Card>
            <CardContent className="p-6 text-sm text-muted-foreground">
              {isLoading ? "Loading league dashboard..." : "League not found."}
            </CardContent>
          </Card>
        )}

        {league && (
          <>
            <Card>
              <CardHeader>
                <CardTitle>{league.name}</CardTitle>
                <CardDescription>{league.description ?? "No description provided yet."}</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3 text-sm text-muted-foreground md:grid-cols-3">
                <p>League ID: {league.id}</p>
                <p>Members: {league.members.length} / 10</p>
                <p>Mock commissioner: {MOCK_COMMISSIONER_USER_ID}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Season Management</CardTitle>
                <CardDescription>
                  Create the current league year, activate it, assign legacy offseason results, then lock setup.
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

                  <div className="rounded-lg border border-border p-4">
                    <p className="text-sm font-medium text-foreground">Active Season</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {activeSeason
                        ? `${activeSeason.name ?? activeSeason.year} · ${activeSeason.isLocked ? "Locked" : "Open"}`
                        : "No active season set."}
                    </p>
                  </div>
                </div>

                <div className="space-y-3">
                  {seasonOptions.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
                      No seasons exist yet.
                    </div>
                  ) : (
                    seasonOptions.map((season) => (
                      <div
                        className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-4"
                        key={season.id}
                      >
                        <div>
                          <p className="font-medium text-foreground">{season.name ?? `${season.year} Season`}</p>
                          <p className="text-sm text-muted-foreground">
                            {season.status} · {season.isLocked ? "Locked" : "Open"}
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

            <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
              <Card>
                <CardHeader>
                  <CardTitle>Ownership Table</CardTitle>
                  <CardDescription>
                    Manual assignment workspace for the current active season.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {!activeSeason ? (
                    <div className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
                      Set an active season before assigning NFL teams.
                    </div>
                  ) : (
                    <>
                      <form className="grid gap-3 md:grid-cols-3" onSubmit={handleAssignTeam}>
                        <select
                          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                          onChange={(event) => setSelectedOwnerId(event.target.value)}
                          value={selectedOwnerId}
                        >
                          <option value="">Select owner</option>
                          {ownerOptions.map((owner) => (
                            <option key={owner.leagueMemberId} value={owner.userId}>
                              {owner.displayName}
                            </option>
                          ))}
                        </select>
                        <select
                          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                          onChange={(event) => setSelectedTeamId(event.target.value)}
                          value={selectedTeamId}
                        >
                          <option value="">Select NFL team</option>
                          {unassignedTeams.map((team) => (
                            <option key={team.id} value={team.id}>
                              {team.abbreviation} - {team.name}
                            </option>
                          ))}
                        </select>
                        <Button
                          disabled={isSubmitting || activeSeason.isLocked || !selectedOwnerId || !selectedTeamId}
                          type="submit"
                        >
                          Assign Team
                        </Button>
                      </form>

                      {seasonOwnership?.owners.map((owner) => (
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
                            {owner.teams.length === 0 ? (
                              <span className="text-sm text-muted-foreground">No NFL teams assigned.</span>
                            ) : (
                              owner.teams.map((entry) => (
                                <span
                                  className="rounded-full bg-secondary px-3 py-1 text-sm text-secondary-foreground"
                                  key={entry.ownershipId}
                                >
                                  {entry.team.abbreviation} - {entry.team.name}
                                </span>
                              ))
                            )}
                          </div>
                        </div>
                      ))}
                    </>
                  )}
                </CardContent>
              </Card>

              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Unassigned Teams</CardTitle>
                    <CardDescription>
                      Exactly two NFL teams should remain unassigned when setup is complete.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {!selectedSeason ? (
                      <p className="text-sm text-muted-foreground">No season selected.</p>
                    ) : unassignedTeams.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No unassigned teams available.</p>
                    ) : (
                      unassignedTeams.map((team) => (
                        <div className="rounded-lg border border-border p-3 text-sm" key={team.id}>
                          {team.abbreviation} - {team.name}
                        </div>
                      ))
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Setup Validation Status</CardTitle>
                    <CardDescription>
                      The season can only be locked after all legacy ownership data passes validation.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    {!setupStatus ? (
                      <p className="text-muted-foreground">No active season available for validation.</p>
                    ) : (
                      <>
                        <p>League members: {setupStatus.memberCount} / 10</p>
                        <p>Assigned teams: {setupStatus.assignedTeamCount} / 30</p>
                        <p>Unassigned teams: {setupStatus.unassignedTeamCount} / 2</p>
                        <p>Exactly 10 members: {setupStatus.hasExactlyTenMembers ? "Pass" : "Fail"}</p>
                        <p>Each member has 3 teams: {setupStatus.eachMemberHasThreeTeams ? "Pass" : "Fail"}</p>
                        <p>Exactly 30 teams assigned: {setupStatus.hasThirtyAssignedTeams ? "Pass" : "Fail"}</p>
                        <p>Exactly 2 teams unassigned: {setupStatus.hasTwoUnassignedTeams ? "Pass" : "Fail"}</p>
                        <div className="rounded-lg border border-border p-3">
                          {setupStatus.ownerStatuses.map((owner) => (
                            <p key={owner.leagueMemberId}>
                              {owner.displayName}: {owner.assignedTeamCount}/3 {owner.isValid ? "Pass" : "Fail"}
                            </p>
                          ))}
                        </div>
                        <Button
                          disabled={
                            isSubmitting || !activeSeason || activeSeason.isLocked || !setupStatus.isValid
                          }
                          onClick={() => void handleLockSeason()}
                          type="button"
                          variant="secondary"
                        >
                          {activeSeason?.isLocked ? "Season Locked" : "Lock Season"}
                        </Button>
                      </>
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
