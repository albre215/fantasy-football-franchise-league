"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { useEffect, useMemo, useState } from "react";

import { BrandMasthead } from "@/components/brand/brand-masthead";
import { CommissionerToolsPanel } from "@/components/league/commissioner-tools-panel";
import { LeagueHistoryPanel } from "@/components/league/league-history-panel";
import { OffseasonDraftPanel } from "@/components/league/offseason-draft-panel";
import { SeasonNflPerformancePanel } from "@/components/league/season-nfl-performance-panel";
import { SeasonLedgerPanel } from "@/components/league/season-ledger-panel";
import { NFLTeamLabel } from "@/components/shared/nfl-team-label";
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
import type { SeasonResultsResponse } from "@/types/results";
import type {
  CreateSeasonResponse,
  LockSeasonResponse,
  SetActiveSeasonResponse,
  SeasonListResponse,
  UpdateSeasonYearResponse,
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

type DashboardTab =
  | "overview"
  | "seasons"
  | "members"
  | "ownership"
  | "results-draft"
  | "nfl-performance"
  | "ledger"
  | "history-analytics";
type ResultsDraftTab = "final-standings" | "offseason-draft" | "commissioner-overrides";

async function parseJsonResponse<T>(response: Response): Promise<T> {
  const payload = (await response.json()) as T & { error?: string };

  if (!response.ok) {
    throw new Error(payload.error ?? "Request failed.");
  }

  return payload;
}

export function LeagueDashboard({ leagueId }: LeagueDashboardProps) {
  const { data: session, status: sessionStatus } = useSession();
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [leagueOptions, setLeagueOptions] = useState<LeagueListItem[]>([]);
  const [bootstrapState, setBootstrapState] = useState<LeagueBootstrapStateResponse["bootstrapState"] | null>(null);
  const [seasons, setSeasons] = useState<SeasonListResponse["seasons"]>([]);
  const [seasonOwnership, setSeasonOwnership] = useState<SeasonOwnershipResponse["ownership"] | null>(null);
  const [draftState, setDraftState] = useState<DraftState | null>(null);
  const [resultsAvailability, setResultsAvailability] = useState<SeasonResultsResponse["results"]["availability"] | null>(null);
  const [ownershipError, setOwnershipError] = useState<string | null>(null);
  const [seasonYear, setSeasonYear] = useState(new Date().getFullYear().toString());
  const [seasonName, setSeasonName] = useState("");
  const [editingSeasonId, setEditingSeasonId] = useState<string | null>(null);
  const [editingSeasonYear, setEditingSeasonYear] = useState("");
  const [memberDisplayName, setMemberDisplayName] = useState("");
  const [memberEmail, setMemberEmail] = useState("");
  const [selectedOwnerId, setSelectedOwnerId] = useState("");
  const [selectedTeamId, setSelectedTeamId] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<DashboardTab>("overview");
  const [activeResultsDraftTab, setActiveResultsDraftTab] = useState<ResultsDraftTab>("offseason-draft");

  const activeSeason = bootstrapState?.activeSeason ?? null;
  const members = bootstrapState?.members ?? [];
  const ownershipOwners = seasonOwnership?.owners ?? [];
  const availableTeams = seasonOwnership?.availableTeams ?? [];
  const actingUserId = session?.user?.id ?? "";
  const currentUserMembership = members.find((member) => member.userId === actingUserId) ?? null;
  const currentUserRole = currentUserMembership?.role ?? null;
  const canManageLeague = currentUserRole === "COMMISSIONER";
  const commissionerAccessMessage = currentUserMembership
    ? currentUserRole === "COMMISSIONER"
      ? null
      : `You are signed in as ${session?.user?.displayName ?? session?.user?.email ?? "this user"}, but only the commissioner can change this league. Sign in as ${bootstrapState?.league.commissioner?.displayName ?? "the commissioner"} to make updates.`
    : `You are signed in as ${session?.user?.displayName ?? session?.user?.email ?? "this user"}, but this account is not a member of the current league. Commissioner-only actions are unavailable.`;

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
        setResultsAvailability(null);
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
          const ownerIds = ownershipData.ownership.owners.map((owner) => owner.userId);
          const assignableOwnerId =
            ownershipData.ownership.owners.find((owner) => owner.teamCount < 3)?.userId ?? ownershipData.ownership.owners[0]?.userId ?? "";

          return ownerIds.includes(current) ? current : assignableOwnerId;
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

      try {
        const resultsResponse = await fetch(`/api/season/${seasonId}/results`, { cache: "no-store" });
        const resultsData = await parseJsonResponse<SeasonResultsResponse>(resultsResponse);
        setResultsAvailability(resultsData.results.availability);
      } catch (error) {
        if (process.env.NODE_ENV !== "production") {
          console.error("Season results availability load failed:", error);
        }

        setResultsAvailability(null);
      }
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void (async () => {
      if (sessionStatus === "loading") {
        return;
      }

      if (sessionStatus !== "authenticated") {
        setIsLoading(false);
        setBootstrapState(null);
        setSeasons([]);
        setSeasonOwnership(null);
        setDraftState(null);
        setOwnershipError(null);
        setErrorMessage("Sign in to access the league dashboard.");
        return;
      }

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
  }, [leagueId, sessionStatus]);

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

      const data = await parseJsonResponse<SetActiveSeasonResponse>(response);

      if (data.nflImport?.status === "FAILED") {
        setSuccessMessage("Active season updated.");
        setErrorMessage(
          `Active season updated, but automatic NFL import failed. ${data.nflImport.message ?? ""}`.trim()
        );
      } else if (data.nflImport?.status === "COMPLETED") {
        setSuccessMessage(`Active season updated. ${data.nflImport.message ?? ""}`.trim());
      } else {
        setSuccessMessage("Active season updated.");
      }

      await refreshLeagueDashboard(leagueId);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to set active season.");
    } finally {
      setIsSubmitting(false);
    }
  }

  function startSeasonYearEdit(seasonId: string, year: number) {
    setEditingSeasonId(seasonId);
    setEditingSeasonYear(year.toString());
  }

  function cancelSeasonYearEdit() {
    setEditingSeasonId(null);
    setEditingSeasonYear("");
  }

  async function handleUpdateSeasonYear(seasonId: string) {
    if (!leagueId) {
      return;
    }

    const nextYear = Number(editingSeasonYear);

    if (!Number.isInteger(nextYear)) {
      setErrorMessage("Enter a valid season year before saving.");
      return;
    }

    if (
      !window.confirm(
        `Change this season's year to ${nextYear}? This updates how the season is labeled and how adjacent-season draft logic relates to it.`
      )
    ) {
      return;
    }

    setErrorMessage(null);
    setSuccessMessage(null);
    setIsSubmitting(true);

    try {
      const response = await fetch(`/api/season/${seasonId}/year`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          year: nextYear
        })
      });
      const data = await parseJsonResponse<UpdateSeasonYearResponse>(response);

      setSuccessMessage(`Updated season year to ${data.season.year}.`);
      cancelSeasonYearEdit();
      await refreshLeagueDashboard(leagueId);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to update season year.");
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
          email: memberEmail
        })
      });
      const data = await parseJsonResponse<AddLeagueMemberResponse>(response);

      setMemberDisplayName("");
      setMemberEmail("");
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

    const selectedOwner = ownershipOwners.find((owner) => owner.userId === selectedOwnerId);
    const selectedTeam = availableTeams.find((team) => team.id === selectedTeamId);

    if (
      selectedOwner &&
      selectedTeam &&
      !window.confirm(
        `Assign ${selectedTeam.abbreviation} - ${selectedTeam.name} to ${selectedOwner.displayName} for ${activeSeason.name ?? activeSeason.year}?`
      )
    ) {
      return;
    }

    setErrorMessage(null);
    setSuccessMessage(null);
    setIsSubmitting(true);

    try {
      const response = await fetch(`/api/season/${activeSeason.id}/ownership/assign`, {
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

    if (!window.confirm(`Remove ${teamName} from its owner in ${activeSeason.name ?? activeSeason.year}?`)) {
      return;
    }

    setErrorMessage(null);
    setSuccessMessage(null);
    setIsSubmitting(true);

    try {
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
        <BrandMasthead
          className="mb-8"
          description="Select a league to open the commissioner bootstrap console."
          eyebrow="Commissioner Console"
          title="League Dashboard"
        />
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
  const assignedTeamsCount = bootstrapState?.assignedTeamCount ?? 0;
  const standingsSaved = resultsAvailability?.hasFinalStandings ?? false;
  const draftExists = Boolean(draftState);
  const draftStatus = draftState?.draft.status ?? "No draft";
  const ownershipFinalized = isLocked && assignedTeamsCount === 30;
  const recommendedDraftOrderReady = resultsAvailability?.isReadyForDraftOrderAutomation ?? false;

  const primaryNextAction = !hasActiveSeason
    ? "Create or activate a season to begin commissioner workflows."
    : commissionerAccessMessage
    ? commissionerAccessMessage
    : !bootstrapState?.lockReadiness.hasExactlyTenMembers
    ? "Add league members until the league has all 10 owners."
    : !bootstrapState.lockReadiness.hasThirtyAssignedTeams
    ? "Finish assigning active-season NFL teams before moving on."
    : !standingsSaved
    ? "Save final standings to unlock next season's draft-order logic."
    : draftState?.draft.status === "PLANNING"
    ? "Complete keeper selections and start the offseason draft when the order looks right."
    : draftState?.draft.status === "ACTIVE"
    ? "Record the remaining draft picks until the offseason draft is complete."
    : draftState?.draft.status === "COMPLETED" && !isLocked
    ? "Review finalized ownership and lock the target season when corrections are complete."
    : bootstrapState?.lockReadiness.isReadyToLock && !isLocked
    ? "Lock the active season when setup corrections are complete."
    : "Use the tabs below to manage the league's current operational state.";

  const secondaryNextSteps = [
    !bootstrapState?.lockReadiness.hasExactlyTenMembers
      ? "League setup is still blocked until there are exactly 10 members."
      : null,
    !bootstrapState?.lockReadiness.hasThirtyAssignedTeams
      ? "Active-season ownership still needs 30 assigned NFL teams with two teams left unassigned."
      : null,
    hasActiveSeason && !standingsSaved
      ? "Final standings are still missing for the active season."
      : null,
    draftState?.draft.status === "PLANNING"
      ? "Save two keepers for each owner before starting the draft."
      : null,
    draftState?.draft.status === "COMPLETED" && !isLocked
      ? "Completed drafts should be followed by a quick ownership review and season lock."
      : null
  ].filter((step): step is string => Boolean(step)).slice(0, 2);

  return (
    <main className="container py-12">
      <div className="max-w-6xl space-y-6">
        <BrandMasthead
          actions={
            <Link className={buttonVariants({ variant: "outline" })} href="/">
              Back to Home
            </Link>
          }
          description="Set up the real current season from an already-completed offseason draft."
          eyebrow="Commissioner Console"
          title="League Bootstrap Console"
        />

        {(errorMessage || successMessage) && (
          <div className="pointer-events-none fixed right-6 top-6 z-50 w-full max-w-md">
            <Card className={errorMessage ? "border-red-200 bg-red-50 shadow-lg" : "border-emerald-200 bg-emerald-50 shadow-lg"}>
              <CardContent className="p-4 text-sm">{errorMessage ?? successMessage}</CardContent>
            </Card>
          </div>
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
            {commissionerAccessMessage ? (
              <Card className="border-amber-200 bg-amber-50">
                <CardContent className="p-4 text-sm text-amber-900">
                  {commissionerAccessMessage}
                </CardContent>
              </Card>
            ) : null}

            <div className="relative z-10 flex flex-wrap gap-2 rounded-2xl border border-border bg-white/90 p-2 shadow-[0_14px_28px_-24px_rgba(6,32,18,0.2),0_0_0_1px_rgba(24,54,33,0.08)] backdrop-blur-sm">
              {[
                { id: "overview", label: "Overview" },
                { id: "seasons", label: "Seasons" },
                { id: "members", label: "Members" },
                { id: "ownership", label: "Ownership" },
                { id: "results-draft", label: "Results & Draft" },
                { id: "nfl-performance", label: "NFL Performance" },
                { id: "ledger", label: "Ledger" },
                { id: "history-analytics", label: "History & Analytics" }
              ].map((tab) => (
                <Button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as DashboardTab)}
                  type="button"
                  variant={activeTab === tab.id ? "default" : "outline"}
                >
                  {tab.label}
                </Button>
              ))}
            </div>

            {activeTab === "overview" ? (
              <div className="grid gap-6 xl:grid-cols-3">
                <Card>
                  <CardHeader>
                    <CardTitle>League Snapshot</CardTitle>
                    <CardDescription>Structural identity for the league you are currently managing.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm text-muted-foreground">
                    <p>League: {bootstrapState.league.name}</p>
                    <p>Commissioner: {bootstrapState.league.commissioner?.displayName ?? "Not assigned"}</p>
                    <p>Active season: {activeSeason ? activeSeason.name ?? activeSeason.year : "None selected"}</p>
                    <p>Members: {bootstrapState.memberCount} / 10</p>
                  </CardContent>
                </Card>

                <CommissionerToolsPanel
                  activeSeason={activeSeason}
                  accessMessage={commissionerAccessMessage}
                  canManageLeague={canManageLeague}
                  draftState={draftState}
                  hideHeading
                  members={members}
                  onError={(message) => setErrorMessage(message || null)}
                  onRefresh={() => refreshLeagueDashboard(leagueId)}
                  onSuccess={(message) => setSuccessMessage(message || null)}
                  seasonOwnership={seasonOwnership}
                  seasons={seasons}
                  visibleSections={["state"]}
                />

                <Card>
                  <CardHeader>
                    <CardTitle>Next Action & Blockers</CardTitle>
                    <CardDescription>The operational guidance card for what to do next.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4 text-sm text-muted-foreground">
                    <div className="rounded-lg border border-dashed border-border p-4">
                      <p className="font-medium text-foreground">Primary recommendation</p>
                      <p className="mt-1">{primaryNextAction}</p>
                    </div>
                    {secondaryNextSteps.length > 0 ? (
                      <div className="space-y-2">
                        <p className="font-medium text-foreground">Secondary blockers</p>
                        <ul className="space-y-2">
                          {secondaryNextSteps.map((step) => (
                            <li className="rounded-lg border border-border p-3" key={step}>
                              {step}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : (
                      <p>No blocking issues are currently surfaced. Use the tabs below for the next operational step.</p>
                    )}
                  </CardContent>
                </Card>
              </div>
            ) : null}

            {activeTab === "seasons" ? (
              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Season Management</CardTitle>
                    <CardDescription>
                      Create seasons, pick the current active season, and keep structural season setup focused here.
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
                        <Button disabled={isSubmitting || !canManageLeague} type="submit">
                          Create Season
                        </Button>
                      </form>

                      <div className="rounded-lg border border-border p-4 text-sm text-muted-foreground">
                        {hasActiveSeason
                          ? `Active season: ${activeSeason?.name ?? activeSeason?.year} - ${isLocked ? "Locked" : "Open"}`
                          : "Create or activate a season first. All season-scoped workflows use the active season."}
                      </div>
                      {hasActiveSeason ? (
                        <div className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
                          Only the commissioner can lock or unlock the season under the authenticated workflow.
                        </div>
                      ) : null}
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
                              {editingSeasonId === season.id ? (
                                <div className="mt-3 flex flex-wrap items-center gap-2">
                                  <Input
                                    className="w-32"
                                    inputMode="numeric"
                                    onChange={(event) => setEditingSeasonYear(event.target.value)}
                                    value={editingSeasonYear}
                                  />
                                  <Button
                                    disabled={isSubmitting || !canManageLeague || !editingSeasonYear.trim()}
                                    onClick={() => void handleUpdateSeasonYear(season.id)}
                                    type="button"
                                  >
                                    Save Year
                                  </Button>
                                  <Button
                                    disabled={isSubmitting}
                                    onClick={cancelSeasonYearEdit}
                                    type="button"
                                    variant="outline"
                                  >
                                    Cancel
                                  </Button>
                                </div>
                              ) : (
                                <p className="mt-2 text-xs text-muted-foreground">
                                  Need to correct the season year? Use Edit Year before relying on standings or draft order.
                                </p>
                              )}
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                              {editingSeasonId !== season.id ? (
                                <Button
                                  disabled={isSubmitting || !canManageLeague}
                                  onClick={() => startSeasonYearEdit(season.id, season.year)}
                                  type="button"
                                  variant="outline"
                                >
                                  Edit Year
                                </Button>
                              ) : null}
                              <Button
                                disabled={isSubmitting || season.status === "ACTIVE" || !canManageLeague}
                                onClick={() => void handleSetActiveSeason(season.id)}
                                type="button"
                                variant={season.status === "ACTIVE" ? "secondary" : "outline"}
                              >
                                {season.status === "ACTIVE" ? "Active Season" : "Set Active"}
                              </Button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </CardContent>
                </Card>

                <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
                  <Card>
                    <CardHeader>
                      <CardTitle>Season Setup & Readiness</CardTitle>
                      <CardDescription>
                        Use this checklist to get the active season structurally ready before locking it.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3 text-sm">
                      <p>
                        Overall status:{" "}
                        {lockState === "LOCKED"
                          ? "Locked"
                          : lockState === "READY_TO_LOCK"
                          ? "Ready to Lock"
                          : "Not Ready"}
                      </p>
                      <p>Active season exists: {bootstrapState.lockReadiness.hasActiveSeason ? "Pass" : "Fail"}</p>
                      <p>10 members required: {bootstrapState.lockReadiness.hasExactlyTenMembers ? "Pass" : "Fail"}</p>
                      <p>
                        30 assigned teams required: {bootstrapState.lockReadiness.hasThirtyAssignedTeams ? "Pass" : "Fail"}
                      </p>
                      <p>2 unassigned teams required: {bootstrapState.lockReadiness.hasTwoUnassignedTeams ? "Pass" : "Fail"}</p>
                      <p>
                        Every member has exactly 3 teams:{" "}
                        {bootstrapState.lockReadiness.everyMemberHasExactlyThreeTeams ? "Pass" : "Fail"}
                      </p>
                      <div className="rounded-lg border border-border p-3">
                        {members.map((member) => (
                          <p key={member.id}>
                            {member.displayName}: {member.assignmentCount}/3 {member.assignmentCount === 3 ? "Pass" : "Fail"}
                          </p>
                        ))}
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>Season Controls</CardTitle>
                      <CardDescription>
                        Lock and unlock the active season once setup is correct or when a correction is needed.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4 text-sm text-muted-foreground">
                      <p>
                        Active season: {activeSeason ? activeSeason.name ?? activeSeason.year : "None selected"}
                      </p>
                      <p>Current lock state: {isLocked ? "Locked" : "Open"}</p>
                      <p>
                        Commissioner-only action. Lock once members and ownership are complete, unlock only to correct mistakes.
                      </p>
                      <div className="flex flex-wrap gap-3">
                        <Button
                          disabled={isSubmitting || !bootstrapState.lockReadiness.isReadyToLock || isLocked || !canManageLeague}
                          onClick={() => void handleLockSeason()}
                          type="button"
                          variant="secondary"
                        >
                          {isLocked ? "Season Locked" : "Lock Season"}
                        </Button>
                        <Button
                          disabled={isSubmitting || !isLocked || !canManageLeague}
                          onClick={() => void handleUnlockSeason()}
                          type="button"
                          variant="outline"
                        >
                          Unlock Season
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            ) : null}

            {activeTab === "members" ? (
              <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
                <Card>
                  <CardHeader>
                    <CardTitle>Members Management</CardTitle>
                    <CardDescription>
                      Add league members, review roles, and remove members only when it is safe to do so.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <form className="grid gap-3 md:grid-cols-3" onSubmit={handleAddMember}>
                      <Input onChange={(event) => setMemberDisplayName(event.target.value)} placeholder="Display name" value={memberDisplayName} />
                      <Input onChange={(event) => setMemberEmail(event.target.value)} placeholder="Email" type="email" value={memberEmail} />
                      <Button
                        disabled={isSubmitting || !hasActiveSeason || isLocked || !memberDisplayName || !memberEmail || !canManageLeague}
                        type="submit"
                      >
                        Add Member
                      </Button>
                    </form>

                    {!hasActiveSeason ? (
                      <div className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
                        Create or activate a season first. Member management is tied to the active season workflow.
                      </div>
                    ) : null}

                    <div className="space-y-3">
                      {members.map((member) => (
                        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-4" key={member.id}>
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
                              disabled={isSubmitting || !member.canRemove || !canManageLeague}
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
                    <CardTitle>Membership Notes</CardTitle>
                    <CardDescription>Keep league people management separate from season operations.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm text-muted-foreground">
                    <p>Commissioner: {bootstrapState.league.commissioner?.displayName ?? "Not assigned"}</p>
                    <p>Current signed-in role: {currentUserRole ?? "Not a league member"}</p>
                    <p>League membership count: {bootstrapState.memberCount} / 10</p>
                    <div className="rounded-lg border border-dashed border-border p-4">
                      Add and remove members here before relying on season ownership, standings, or offseason draft workflows.
                    </div>
                  </CardContent>
                </Card>
              </div>
            ) : null}

            {activeTab === "ownership" ? (
              <div className="space-y-6">
                <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
                  <Card>
                    <CardHeader>
                      <CardTitle>Ownership Workspace</CardTitle>
                      <CardDescription>
                        Use one editing surface to assign teams, review the selected owner's roster, and make removals.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {!hasActiveSeason ? (
                        <div className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
                          Create or activate a season first to manage ownership.
                        </div>
                      ) : ownershipError ? (
                        <p className="text-sm text-red-600">{ownershipError}</p>
                      ) : !seasonOwnership ? (
                        <p className="text-sm text-muted-foreground">Unable to load active-season ownership.</p>
                      ) : (
                        <form className="space-y-4" onSubmit={handleAssignTeam}>
                          <div className="grid gap-3 md:grid-cols-3">
                            <select
                              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                              onChange={(event) => setSelectedOwnerId(event.target.value)}
                              value={selectedOwnerId}
                            >
                              <option value="">Select owner</option>
                              {ownershipOwners.map((owner) => (
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
                              disabled={isSubmitting || isLocked || !selectedOwnerId || !selectedTeamId || !canManageLeague}
                              type="submit"
                            >
                              Assign Team
                            </Button>
                          </div>

                          {(() => {
                            const selectedOwner =
                              ownershipOwners.find((owner) => owner.userId === selectedOwnerId) ?? null;

                            return (
                              <div className="space-y-4 rounded-lg border border-border p-4 text-sm text-muted-foreground">
                                <div className="space-y-1">
                                  <p className="font-medium text-foreground">
                                    {selectedOwner ? selectedOwner.displayName : "Select an owner to edit"}
                                  </p>
                                  <p>
                                    Current team count: {selectedOwner?.teamCount ?? 0}/3
                                  </p>
                                  <p>
                                  {isLocked
                                      ? "Season is locked. Unlock it before making ownership corrections."
                                      : !selectedOwnerId
                                      ? "Choose an owner to assign or remove teams."
                                      : selectedOwner?.teamCount === 3
                                      ? "This owner already has 3 teams. Remove one before assigning another."
                                      : !selectedTeamId
                                      ? "Select an available NFL team before assigning."
                                      : "Ready to assign the selected NFL team."}
                                  </p>
                                </div>

                                {selectedTeamId ? (
                                  <div className="rounded-lg border border-border bg-background px-3 py-2 text-foreground">
                                    <NFLTeamLabel
                                      size="default"
                                      team={availableTeams.find((team) => team.id === selectedTeamId)!}
                                    />
                                  </div>
                                ) : null}

                                <div className="space-y-2">
                                  <p className="font-medium text-foreground">Selected owner's teams</p>
                                  {selectedOwner?.teams.length ? (
                                    <div className="flex flex-wrap gap-2">
                                      {selectedOwner.teams.map((entry) => (
                                        <div
                                          className="flex items-center gap-2 rounded-full bg-secondary px-3 py-1 text-sm text-secondary-foreground"
                                          key={entry.ownershipId}
                                        >
                                          <NFLTeamLabel size="compact" team={entry.team} />
                                          <Button
                                            className="h-7 px-2"
                                            disabled={isSubmitting || isLocked || !canManageLeague}
                                            onClick={() => void handleRemoveTeam(entry.ownershipId, entry.team.name)}
                                            type="button"
                                            variant="ghost"
                                          >
                                            Remove
                                          </Button>
                                        </div>
                                      ))}
                                    </div>
                                  ) : (
                                    <p>No NFL teams assigned to the selected owner yet.</p>
                                  )}
                                </div>

                                <div className="space-y-2">
                                  <p className="font-medium text-foreground">Available teams</p>
                                  {availableTeams.length === 0 ? (
                                    <p>No unassigned teams remain.</p>
                                  ) : (
                                    <div className="flex flex-wrap gap-2">
                                      {availableTeams.map((team) => (
                                        <button
                                          className={`rounded-full border px-3 py-2 text-sm ${
                                            selectedTeamId === team.id
                                              ? "border-foreground bg-secondary text-secondary-foreground"
                                              : "border-border text-muted-foreground"
                                          }`}
                                          key={team.id}
                                          onClick={() => setSelectedTeamId(team.id)}
                                          type="button"
                                        >
                                          <NFLTeamLabel size="compact" team={team} />
                                        </button>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })()}
                        </form>
                      )}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>Ownership Table</CardTitle>
                      <CardDescription>
                        League-wide ownership view. Select an owner here to load them into the editing workspace.
                      </CardDescription>
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
                          <button
                            className={`w-full rounded-lg border p-4 text-left ${
                              selectedOwnerId === owner.userId ? "border-foreground bg-secondary/30" : "border-border"
                            }`}
                            key={owner.leagueMemberId}
                            onClick={() => setSelectedOwnerId(owner.userId)}
                            type="button"
                          >
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
                                  <span
                                    className="rounded-full bg-secondary px-3 py-1 text-sm text-secondary-foreground"
                                    key={entry.ownershipId}
                                  >
                                    <NFLTeamLabel size="compact" team={entry.team} />
                                  </span>
                                ))
                              ) : (
                                <span className="text-sm text-muted-foreground">No NFL teams assigned.</span>
                              )}
                            </div>
                          </button>
                        ))
                      )}
                    </CardContent>
                  </Card>
                </div>
              </div>
            ) : null}

            {activeTab === "results-draft" ? (
              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Results & Draft Workflow</CardTitle>
                    <CardDescription>
                      Move through the annual sequence from final standings to draft order to the offseason draft.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="flex flex-wrap gap-2">
                    {[
                      { id: "final-standings", label: "Final Standings" },
                      { id: "offseason-draft", label: "Offseason Draft" },
                      { id: "commissioner-overrides", label: "Commissioner Overrides" }
                    ].map((tab) => (
                      <Button
                        key={tab.id}
                        onClick={() => setActiveResultsDraftTab(tab.id as ResultsDraftTab)}
                        type="button"
                        variant={activeResultsDraftTab === tab.id ? "default" : "outline"}
                      >
                        {tab.label}
                      </Button>
                    ))}
                  </CardContent>
                </Card>

                {activeResultsDraftTab === "final-standings" ? (
                  <CommissionerToolsPanel
                    activeSeason={activeSeason}
                    accessMessage={commissionerAccessMessage}
                    canManageLeague={canManageLeague}
                    draftState={draftState}
                    hideHeading
                    members={members}
                    onError={(message) => setErrorMessage(message || null)}
                    onRefresh={() => refreshLeagueDashboard(leagueId)}
                    onSuccess={(message) => setSuccessMessage(message || null)}
                    seasonOwnership={seasonOwnership}
                    seasons={seasons}
                    visibleSections={["standings"]}
                  />
                ) : null}

                {activeResultsDraftTab === "offseason-draft" ? (
                  <OffseasonDraftPanel
                    leagueId={leagueId}
                    leagueCode={bootstrapState?.league.leagueCode ?? null}
                    activeSeason={activeSeason}
                    accessMessage={commissionerAccessMessage}
                    canManageDraft={canManageLeague}
                    draftState={draftState}
                    isDraftStateLoading={isLoading && hasActiveSeason && !draftState}
                    isSubmitting={isSubmitting}
                    members={members}
                    onEndSubmit={() => setIsSubmitting(false)}
                    onError={(message) => setErrorMessage(message || null)}
                    onRefresh={() => refreshLeagueDashboard(leagueId)}
                    onStartSubmit={() => setIsSubmitting(true)}
                    onSuccess={(message) => setSuccessMessage(message || null)}
                    seasons={seasons}
                  />
                ) : null}

                {activeResultsDraftTab === "commissioner-overrides" ? (
                  <CommissionerToolsPanel
                    activeSeason={activeSeason}
                    accessMessage={commissionerAccessMessage}
                    canManageLeague={canManageLeague}
                    draftState={draftState}
                    hideHeading
                    members={members}
                    onError={(message) => setErrorMessage(message || null)}
                    onRefresh={() => refreshLeagueDashboard(leagueId)}
                    onSuccess={(message) => setSuccessMessage(message || null)}
                    seasonOwnership={seasonOwnership}
                    seasons={seasons}
                    visibleSections={["draftReset", "draftOrder"]}
                  />
                ) : null}
              </div>
            ) : null}

            {activeTab === "nfl-performance" ? (
              <SeasonNflPerformancePanel
                accessMessage={commissionerAccessMessage}
                activeSeason={activeSeason}
                canManageNfl={canManageLeague}
                onError={(message) => setErrorMessage(message || null)}
                onSuccess={(message) => setSuccessMessage(message || null)}
                seasonOwnership={seasonOwnership}
              />
            ) : null}

            {activeTab === "ledger" ? (
              <SeasonLedgerPanel
                accessMessage={commissionerAccessMessage}
                activeSeason={activeSeason}
                canManageLedger={canManageLeague}
                members={members}
                onError={(message) => setErrorMessage(message || null)}
                onSuccess={(message) => setSuccessMessage(message || null)}
              />
            ) : null}

            {activeTab === "history-analytics" ? <LeagueHistoryPanel leagueId={leagueId} /> : null}
          </>
        )}
      </div>
    </main>
  );
}
