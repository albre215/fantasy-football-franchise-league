"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import Link from "next/link";
import { Check, Lock, LockOpen, XCircle } from "lucide-react";
import { useSession } from "next-auth/react";
import { useEffect, useMemo, useState } from "react";

import { BrandAccountSlot } from "@/components/brand/brand-account-slot";
import { BrandLogo } from "@/components/brand/brand-logo";
import { BrandMasthead } from "@/components/brand/brand-masthead";
import { LeagueOwnerPanel } from "@/components/league/league-owner-panel";
import { ProfileAvatar } from "@/components/shared/profile-avatar";
import { NFLTeamLabel } from "@/components/shared/nfl-team-label";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { getCurrentGmFantasySeasonYear } from "@/lib/gm-season";
import { cn } from "@/lib/utils";
import type { DraftState, DraftStateResponse } from "@/types/draft";
import type {
  AddLeagueMemberResponse,
  LeagueBootstrapStateResponse,
  LeagueListItem,
  ListLeaguesResponse,
  ReplaceLeagueMemberResponse
} from "@/types/league";
import type { SeasonResultsResponse } from "@/types/results";
import type {
  SeasonNflLedgerPostingPreviewResponse,
  SeasonNflOverviewResponse
} from "@/types/nfl-performance";
import type {
  CreateSeasonResponse,
  LockSeasonResponse,
  SetActiveSeasonResponse,
  SeasonPhaseContextResponse,
  SeasonListResponse,
  UpdateSeasonLeaguePhaseResponse,
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
  initialIsAuthenticated?: boolean;
  initialLeagueOptions?: LeagueListItem[];
  initialBootstrapState?: LeagueBootstrapStateResponse["bootstrapState"] | null;
  initialSeasons?: SeasonListResponse["seasons"];
  initialErrorMessage?: string | null;
}

type DashboardTab =
  | "overview"
  | "seasons"
  | "members"
  | "ownership"
  | "results-draft"
  | "fantasy"
  | "nfl-performance"
  | "ledger"
  | "history-analytics";
type ResultsDraftTab = "offseason-draft" | "commissioner-overrides";
type DashboardViewMode = "commissioner" | "owner";

function getRegularSeasonWeekLimit(seasonYear: number) {
  return seasonYear >= 2021 ? 18 : 17;
}

function getFallbackPhaseTransitions(currentPhase: SeasonPhaseContextResponse["phase"]["season"]["leaguePhase"] | null) {
  switch (currentPhase) {
    case "IN_SEASON":
      return [{ phase: "POST_SEASON" as const, isAvailable: true, warnings: [] as string[] }];
    case "POST_SEASON":
      return [{ phase: "DROP_PHASE" as const, isAvailable: true, warnings: [] as string[] }];
    case "DROP_PHASE":
      return [{ phase: "DRAFT_PHASE" as const, isAvailable: true, warnings: [] as string[] }];
    default:
      return [];
  }
}

function TabPanelSkeleton({ title, description }: { title: string; description: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <div className="h-20 animate-pulse rounded-lg border border-border bg-secondary/20" key={index} />
        ))}
      </CardContent>
    </Card>
  );
}

function ChecklistStatusItem({
  label,
  value,
  passed
}: {
  label: string;
  value: string;
  passed: boolean;
}) {
  return (
    <div className="flex items-start gap-3 text-sm">
      {passed ? (
        <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
      ) : (
        <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" />
      )}
      <p>
        <span className="font-semibold text-foreground">{label}:</span>{" "}
        <span className={passed ? "text-foreground" : "text-rose-700"}>{value}</span>
      </p>
    </div>
  );
}

const CommissionerToolsPanel = dynamic(
  () => import("@/components/league/commissioner-tools-panel").then((mod) => mod.CommissionerToolsPanel),
  {
    loading: () => (
      <TabPanelSkeleton
        description="Loading commissioner controls."
        title="Commissioner Tools"
      />
    )
  }
);

const LeagueHistoryPanel = dynamic(
  () => import("@/components/league/league-history-panel").then((mod) => mod.LeagueHistoryPanel),
  {
    loading: () => (
      <TabPanelSkeleton
        description="Loading history and analytics."
        title="History & Analytics"
      />
    )
  }
);

const OffseasonDraftPanel = dynamic(
  () => import("@/components/league/offseason-draft-panel").then((mod) => mod.OffseasonDraftPanel),
  {
    loading: () => (
      <TabPanelSkeleton
        description="Loading offseason draft workspace."
        title="Offseason Draft"
      />
    )
  }
);

const InauguralAuctionPanel = dynamic(
  () => import("@/components/league/inaugural-auction-panel").then((mod) => mod.InauguralAuctionPanel),
  {
    loading: () => (
      <TabPanelSkeleton
        description="Loading inaugural auction room."
        title="Inaugural Auction"
      />
    )
  }
);

const DraftScheduler = dynamic(
  () => import("@/components/league/draft-scheduler").then((mod) => mod.DraftScheduler),
  { ssr: false }
);

const SeasonNflPerformancePanel = dynamic(
  () => import("@/components/league/season-nfl-performance-panel").then((mod) => mod.SeasonNflPerformancePanel),
  {
    loading: () => (
      <TabPanelSkeleton
        description="Loading NFL performance."
        title="NFL Performance"
      />
    )
  }
);

const SeasonLedgerPanel = dynamic(
  () => import("@/components/league/season-ledger-panel").then((mod) => mod.SeasonLedgerPanel),
  {
    loading: () => (
      <TabPanelSkeleton
        description="Loading season ledger."
        title="Season Ledger"
      />
    )
  }
);

async function parseJsonResponse<T>(response: Response): Promise<T> {
  const payload = (await response.json()) as T & { error?: string };

  if (!response.ok) {
    throw new Error(payload.error ?? "Request failed.");
  }

  return payload;
}

export function LeagueDashboard({
  leagueId,
  initialIsAuthenticated = false,
  initialLeagueOptions = [],
  initialBootstrapState = null,
  initialSeasons = [],
  initialErrorMessage = null
}: LeagueDashboardProps) {
  const { data: session, status: sessionStatus } = useSession();
  const [isLoading, setIsLoading] = useState(!initialIsAuthenticated && sessionStatus === "loading");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pendingActionId, setPendingActionId] = useState<string | null>(null);
  const [leagueOptions, setLeagueOptions] = useState<LeagueListItem[]>(initialLeagueOptions);
  const [bootstrapState, setBootstrapState] = useState<LeagueBootstrapStateResponse["bootstrapState"] | null>(
    initialBootstrapState
  );
  const [seasons, setSeasons] = useState<SeasonListResponse["seasons"]>(initialSeasons);
  const [seasonOwnership, setSeasonOwnership] = useState<SeasonOwnershipResponse["ownership"] | null>(null);
  const [draftState, setDraftState] = useState<DraftState | null>(null);
  const [resultsAvailability, setResultsAvailability] = useState<SeasonResultsResponse["results"]["availability"] | null>(null);
  const [seasonPhaseContext, setSeasonPhaseContext] = useState<SeasonPhaseContextResponse["phase"] | null>(null);
  const [seasonNflOverview, setSeasonNflOverview] = useState<SeasonNflOverviewResponse["nfl"] | null>(null);
  const [seasonNflLedgerPreview, setSeasonNflLedgerPreview] = useState<SeasonNflLedgerPostingPreviewResponse["nflLedger"] | null>(null);
  const [ownershipError, setOwnershipError] = useState<string | null>(null);
  const [seasonYear, setSeasonYear] = useState(() => getCurrentGmFantasySeasonYear().toString());
  const [editingSeasonId, setEditingSeasonId] = useState<string | null>(null);
  const [editingSeasonYear, setEditingSeasonYear] = useState("");
  const [memberDisplayName, setMemberDisplayName] = useState("");
  const [memberEmail, setMemberEmail] = useState("");
  const [replacementMemberId, setReplacementMemberId] = useState("");
  const [replacementDisplayName, setReplacementDisplayName] = useState("");
  const [replacementEmail, setReplacementEmail] = useState("");
  const [selectedOwnerId, setSelectedOwnerId] = useState("");
  const [selectedTeamId, setSelectedTeamId] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(initialErrorMessage);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<DashboardTab>("overview");
  const [activeResultsDraftTab, setActiveResultsDraftTab] = useState<ResultsDraftTab>("offseason-draft");
  const [viewMode, setViewMode] = useState<DashboardViewMode>("commissioner");
  const [operationalDataSeasonId, setOperationalDataSeasonId] = useState<string | null>(null);
  const [hasConsumedInitialData, setHasConsumedInitialData] = useState(
    initialIsAuthenticated && (Boolean(leagueId) || initialLeagueOptions.length > 0 || Boolean(initialErrorMessage))
  );

  const activeSeason = bootstrapState?.activeSeason ?? null;
  const members = bootstrapState?.members ?? [];
  const replacementTargetMember = members.find((member) => member.id === replacementMemberId) ?? null;
  const ownershipOwners = seasonOwnership?.owners ?? [];
  const availableTeams = seasonOwnership?.availableTeams ?? [];
  const actingUserId = session?.user?.id ?? "";
  const currentUserMembership = members.find((member) => member.userId === actingUserId) ?? null;
  const currentUserRole = currentUserMembership?.role ?? null;
  const canManageLeague = currentUserRole === "COMMISSIONER";
  const canToggleOwnerView = canManageLeague;
  const commissionerAccessMessage = currentUserMembership
    ? currentUserRole === "COMMISSIONER"
      ? null
      : `You are signed in as ${session?.user?.displayName ?? session?.user?.email ?? "this user"}, but only the commissioner can change this league. Sign in as ${bootstrapState?.league.commissioner?.displayName ?? "the commissioner"} to make updates.`
    : `You are signed in as ${session?.user?.displayName ?? session?.user?.email ?? "this user"}, but this account is not a member of the current league. Commissioner-only actions are unavailable.`;

  const ownerSelectionOptions = useMemo(
    () => ownershipOwners.filter((owner) => owner.teamCount < 3),
    [ownershipOwners]
  );
  const tabNeedsOperationalData =
    activeTab === "seasons" ||
    activeTab === "ownership" ||
    activeTab === "results-draft" ||
    activeTab === "nfl-performance";
  const isAuthenticated = initialIsAuthenticated || sessionStatus === "authenticated";

  function getSubmittingButtonClass(actionId: string) {
    if (!isSubmitting) {
      return undefined;
    }

    return pendingActionId === actionId ? "disabled:opacity-70" : "disabled:opacity-100";
  }

  useEffect(() => {
    if (!errorMessage && !successMessage) {
      return;
    }

    const timer = window.setTimeout(() => {
      setErrorMessage(null);
      setSuccessMessage(null);
    }, 4000);

    return () => window.clearTimeout(timer);
  }, [errorMessage, successMessage]);

  useEffect(() => {
    setLeagueOptions(initialLeagueOptions);
    setBootstrapState(initialBootstrapState);
    setSeasons(initialSeasons);
    setErrorMessage(initialErrorMessage);
    setIsLoading(false);
    setHasConsumedInitialData(
      initialIsAuthenticated && (Boolean(leagueId) || initialLeagueOptions.length > 0 || Boolean(initialErrorMessage))
    );
  }, [
    initialBootstrapState,
    initialErrorMessage,
    initialIsAuthenticated,
    initialLeagueOptions,
    initialSeasons,
    leagueId
  ]);

  useEffect(() => {
    setViewMode(canManageLeague ? "commissioner" : "owner");
  }, [canManageLeague, leagueId]);

  async function loadActiveSeasonOperationalData(seasonId: string) {
    try {
      const [ownershipResponse, draftResponse, resultsResponse, phaseResponse, nflOverviewResponse, nflLedgerResponse] = await Promise.all([
        fetch(`/api/season/${seasonId}/ownership`, { cache: "no-store" }),
        fetch(`/api/season/${seasonId}/draft`, { cache: "no-store" }),
        fetch(`/api/season/${seasonId}/results`, { cache: "no-store" }),
        fetch(`/api/season/${seasonId}/phase`, { cache: "no-store" }),
        fetch(`/api/season/${seasonId}/nfl`, { cache: "no-store" }),
        fetch(`/api/season/${seasonId}/nfl/ledger`, { cache: "no-store" })
      ]);

      try {
        const ownershipData = await parseJsonResponse<SeasonOwnershipResponse>(ownershipResponse);

        setSeasonOwnership(ownershipData.ownership);
        setSelectedOwnerId((current) => {
          const ownerIds = ownershipData.ownership.owners.map((owner) => owner.userId);
          const assignableOwnerId =
            ownershipData.ownership.owners.find((owner) => owner.teamCount < 3)?.userId ??
            ownershipData.ownership.owners[0]?.userId ??
            "";

          return ownerIds.includes(current) ? current : assignableOwnerId;
        });
        setSelectedTeamId((current) =>
          ownershipData.ownership.availableTeams.some((team) => team.id === current)
            ? current
            : ownershipData.ownership.availableTeams[0]?.id ?? ""
        );
        setOwnershipError(null);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unable to load active-season ownership.";

        if (process.env.NODE_ENV !== "production") {
          console.error("Active-season ownership load failed:", message);
        }

        setSeasonOwnership(null);
        setOwnershipError(message);
        setSelectedOwnerId("");
        setSelectedTeamId("");
      }

      try {
        const draftData = await parseJsonResponse<DraftStateResponse>(draftResponse);
        setDraftState(draftData.draft);
      } catch (error) {
        if (process.env.NODE_ENV !== "production") {
          console.error("Draft state load failed:", error);
        }

        setDraftState(null);
      }

      try {
        const resultsData = await parseJsonResponse<SeasonResultsResponse>(resultsResponse);
        setResultsAvailability(resultsData.results.availability);
      } catch (error) {
        if (process.env.NODE_ENV !== "production") {
          console.error("Season results availability load failed:", error);
        }

        setResultsAvailability(null);
      }

      try {
        const phaseData = await parseJsonResponse<SeasonPhaseContextResponse>(phaseResponse);
        setSeasonPhaseContext(phaseData.phase);
      } catch (error) {
        if (process.env.NODE_ENV !== "production") {
          console.error("Season phase context load failed:", error);
        }

        setSeasonPhaseContext(null);
      }

      try {
        const nflOverviewData = await parseJsonResponse<SeasonNflOverviewResponse>(nflOverviewResponse);
        setSeasonNflOverview(nflOverviewData.nfl);
      } catch (error) {
        if (process.env.NODE_ENV !== "production") {
          console.error("Season NFL overview load failed:", error);
        }

        setSeasonNflOverview(null);
      }

      try {
        const nflLedgerData = await parseJsonResponse<SeasonNflLedgerPostingPreviewResponse>(nflLedgerResponse);
        setSeasonNflLedgerPreview(nflLedgerData.nflLedger);
      } catch (error) {
        if (process.env.NODE_ENV !== "production") {
          console.error("Season NFL ledger preview load failed:", error);
        }

        setSeasonNflLedgerPreview(null);
      }

      setOperationalDataSeasonId(seasonId);
    } catch (error) {
      if (process.env.NODE_ENV !== "production") {
        console.error("Operational data load failed:", error);
      }
    }
  }

  async function refreshLeagueDashboard(currentLeagueId: string, options?: { includeOperationalData?: boolean }) {
    setIsLoading(true);

    try {
      const [listResponse, bootstrapResponse, seasonsResponse] = await Promise.all([
        fetch("/api/league/list", { cache: "no-store" }),
        fetch(`/api/league/${currentLeagueId}/bootstrap-state`, { cache: "no-store" }),
        fetch(`/api/league/${currentLeagueId}/season/list`, { cache: "no-store" })
      ]);

      const listData = await parseJsonResponse<ListLeaguesResponse>(listResponse);
      const bootstrapData = await parseJsonResponse<LeagueBootstrapStateResponse>(bootstrapResponse);
      let seasonsData: SeasonListResponse | null = null;

      try {
        seasonsData = await parseJsonResponse<SeasonListResponse>(seasonsResponse);
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : "Unable to load seasons.");
      }

      setLeagueOptions(listData.leagues);
      setBootstrapState(bootstrapData.bootstrapState);
      setSeasons(seasonsData?.seasons ?? []);

      if (!bootstrapData.bootstrapState.activeSeason) {
        setSeasonOwnership(null);
        setDraftState(null);
        setResultsAvailability(null);
        setSeasonPhaseContext(null);
        setSeasonNflOverview(null);
        setSeasonNflLedgerPreview(null);
        setOwnershipError(null);
        setSelectedOwnerId("");
        setSelectedTeamId("");
        setOperationalDataSeasonId(null);
        return;
      }

      const nextSeasonId = bootstrapData.bootstrapState.activeSeason.id;

      if (operationalDataSeasonId !== nextSeasonId) {
        setSeasonOwnership(null);
        setDraftState(null);
        setResultsAvailability(null);
        setSeasonPhaseContext(null);
        setSeasonNflOverview(null);
        setSeasonNflLedgerPreview(null);
        setOwnershipError(null);
        setSelectedOwnerId("");
        setSelectedTeamId("");
        setOperationalDataSeasonId(null);
      }

      if (options?.includeOperationalData) {
        await loadActiveSeasonOperationalData(nextSeasonId);
      }
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void (async () => {
      if (!initialIsAuthenticated && sessionStatus === "loading") {
        return;
      }

      if (!isAuthenticated) {
        setIsLoading(false);
        setBootstrapState(null);
        setSeasons([]);
        setSeasonOwnership(null);
        setDraftState(null);
        setSeasonPhaseContext(null);
        setOwnershipError(null);
        setErrorMessage("Sign in to access the league dashboard.");
        return;
      }

      if (hasConsumedInitialData) {
        setHasConsumedInitialData(false);
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
        await refreshLeagueDashboard(leagueId, { includeOperationalData: tabNeedsOperationalData });
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : "Unable to load league.");
        setIsLoading(false);
      }
    })();
  }, [hasConsumedInitialData, initialIsAuthenticated, isAuthenticated, leagueId, sessionStatus]);

  useEffect(() => {
    if (!bootstrapState?.activeSeason || !tabNeedsOperationalData) {
      return;
    }

    if (operationalDataSeasonId === bootstrapState.activeSeason.id) {
      return;
    }

    void loadActiveSeasonOperationalData(bootstrapState.activeSeason.id);
  }, [bootstrapState?.activeSeason, operationalDataSeasonId, tabNeedsOperationalData]);

  async function handleCreateSeason(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!leagueId) {
      return;
    }

    setErrorMessage(null);
    setSuccessMessage(null);
    setPendingActionId("create-season");
    setIsSubmitting(true);

    try {
      const response = await fetch(`/api/league/${leagueId}/season/create`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          year: Number(seasonYear)
        })
      });
      const data = await parseJsonResponse<CreateSeasonResponse>(response);

      setSeasonYear(getCurrentGmFantasySeasonYear().toString());

      if (data.nflImport?.status === "FAILED") {
        setSuccessMessage(`Created and activated season ${data.season.name ?? data.season.year}.`);
        setErrorMessage(
          `Season created and activated, but automatic NFL import failed. ${data.nflImport.message ?? ""}`.trim()
        );
      } else if (data.nflImport?.message) {
        setSuccessMessage(
          `Created and activated season ${data.season.name ?? data.season.year}. ${data.nflImport.message}`.trim()
        );
      } else {
        setSuccessMessage(`Created and activated season ${data.season.name ?? data.season.year}.`);
      }

      await refreshLeagueDashboard(leagueId, { includeOperationalData: tabNeedsOperationalData });
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to create season.");
    } finally {
      setPendingActionId(null);
      setIsSubmitting(false);
    }
  }

  async function handleSetActiveSeason(seasonId: string) {
    if (!leagueId) {
      return;
    }

    setErrorMessage(null);
    setSuccessMessage(null);
    setPendingActionId(`set-active:${seasonId}`);
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
      } else if (data.nflImport?.status === "PENDING") {
        setSuccessMessage(`Active season updated. ${data.nflImport.message ?? ""}`.trim());
      } else if (data.nflImport?.status === "COMPLETED") {
        setSuccessMessage(`Active season updated. ${data.nflImport.message ?? ""}`.trim());
      } else {
        setSuccessMessage("Active season updated.");
      }

      await refreshLeagueDashboard(leagueId, { includeOperationalData: tabNeedsOperationalData });
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to set active season.");
    } finally {
      setPendingActionId(null);
      setIsSubmitting(false);
    }
  }

  async function handleUpdateLeaguePhase(nextPhase: NonNullable<SeasonPhaseContextResponse["phase"]>["season"]["leaguePhase"]) {
    if (!activeSeason || !leagueId) {
      return;
    }

    setErrorMessage(null);
    setSuccessMessage(null);
    setPendingActionId(`move-phase:${nextPhase}`);
    setIsSubmitting(true);

    try {
      const response = await fetch(`/api/season/${activeSeason.id}/phase`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ nextPhase })
      });
      const data = await parseJsonResponse<UpdateSeasonLeaguePhaseResponse>(response);

      setSeasonPhaseContext(data.phase);
      setSuccessMessage(`League phase updated to ${nextPhase}.`);
      await refreshLeagueDashboard(leagueId, { includeOperationalData: tabNeedsOperationalData || nextPhase === "DRAFT_PHASE" });
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to update season phase.");
    } finally {
      setPendingActionId(null);
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
    setPendingActionId(`season-year:${seasonId}`);
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

      if (data.nflImport?.status === "FAILED") {
        setSuccessMessage(`Updated season year to ${data.season.year}.`);
        setErrorMessage(
          `Season year updated, but automatic NFL re-import failed. ${data.nflImport.message ?? ""}`.trim()
        );
      } else if (data.nflImport?.status === "PENDING") {
        setSuccessMessage(`Updated season year to ${data.season.year}. ${data.nflImport.message ?? ""}`.trim());
      } else if (data.nflImport?.status === "COMPLETED") {
        setSuccessMessage(`Updated season year to ${data.season.year}. ${data.nflImport.message ?? ""}`.trim());
      } else {
        setSuccessMessage(`Updated season year to ${data.season.year}.`);
      }

      cancelSeasonYearEdit();
      await refreshLeagueDashboard(leagueId, { includeOperationalData: tabNeedsOperationalData });
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to update season year.");
    } finally {
      setPendingActionId(null);
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
    setPendingActionId("add-member");
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
      await refreshLeagueDashboard(leagueId, { includeOperationalData: tabNeedsOperationalData });
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to add member.");
    } finally {
      setPendingActionId(null);
      setIsSubmitting(false);
    }
  }

  function startMemberReplacement(leagueMemberId: string) {
    const member = members.find((entry) => entry.id === leagueMemberId) ?? null;

    setReplacementMemberId(leagueMemberId);
    setReplacementDisplayName("");
    setReplacementEmail("");

    if (member) {
      setSuccessMessage(`Ready to replace ${member.displayName}. Their league history will stay attached to this membership slot.`);
    }
  }

  function cancelMemberReplacement() {
    setReplacementMemberId("");
    setReplacementDisplayName("");
    setReplacementEmail("");
  }

  async function handleReplaceMember(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!leagueId) {
      return;
    }

    setErrorMessage(null);
    setSuccessMessage(null);
    setPendingActionId(`replace-member:${replacementMemberId}`);
    setIsSubmitting(true);

    try {
      const response = await fetch(`/api/league/${leagueId}/members/replace`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          leagueMemberId: replacementMemberId,
          displayName: replacementDisplayName,
          email: replacementEmail
        })
      });
      const data = await parseJsonResponse<ReplaceLeagueMemberResponse>(response);

      cancelMemberReplacement();
      setSuccessMessage(`Updated member slot to ${data.member.displayName}. Historical league records were preserved.`);
      await refreshLeagueDashboard(leagueId, { includeOperationalData: tabNeedsOperationalData });
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to change member.");
    } finally {
      setPendingActionId(null);
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
    setPendingActionId("assign-team");
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
      await refreshLeagueDashboard(leagueId!, { includeOperationalData: true });
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to assign team.");
    } finally {
      setPendingActionId(null);
      setIsSubmitting(false);
    }
  }

  async function handleToggleSeasonLock(season: SeasonListResponse["seasons"][number]) {
    if (!leagueId) {
      return;
    }

    setErrorMessage(null);
    setSuccessMessage(null);
    setPendingActionId(`season-lock:${season.id}`);
    setIsSubmitting(true);

    try {
      const response = await fetch(`/api/season/${season.id}/${season.isLocked ? "unlock" : "lock"}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
        })
      });
      if (season.isLocked) {
        const data = await parseJsonResponse<UnlockSeasonResponse>(response);
        setSuccessMessage(`Unlocked ${data.season.name ?? data.season.year}. Fix setup issues, then relock the season.`);
      } else {
        const data = await parseJsonResponse<LockSeasonResponse>(response);
        setSuccessMessage(`Locked ${data.season.name ?? data.season.year}.`);
      }

      await refreshLeagueDashboard(leagueId, { includeOperationalData: true });
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : `Unable to ${season.isLocked ? "unlock" : "lock"} season.`);
    } finally {
      setPendingActionId(null);
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
    setPendingActionId(`remove-team:${teamOwnershipId}`);
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
      await refreshLeagueDashboard(leagueId!, { includeOperationalData: true });
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to remove team.");
    } finally {
      setPendingActionId(null);
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
  const isInauguralAuctionSeason = activeSeason?.draftMode === "INAUGURAL_AUCTION";
  const draftExists = isInauguralAuctionSeason ? null : Boolean(draftState);
  const draftStatus = isInauguralAuctionSeason ? "Managed in inaugural auction room" : draftState?.draft.status ?? "No draft";
  const ownershipFinalized = isLocked && assignedTeamsCount === 30;
  const recommendedDraftOrderReady = resultsAvailability?.isReadyForDraftOrderAutomation ?? false;
  const currentLeaguePhase = seasonPhaseContext?.season.leaguePhase ?? activeSeason?.leaguePhase ?? null;
  const firstSeasonYearOnRecord =
    seasons.length > 0 ? Math.min(...seasons.map((season) => season.year)) : null;
  const isFirstSeasonOnRecord =
    activeSeason !== null && firstSeasonYearOnRecord !== null && activeSeason.year === firstSeasonYearOnRecord;
  const usesInauguralDraftChecklist = isInauguralAuctionSeason && isFirstSeasonOnRecord;
  const regularSeasonComplete =
    Boolean(activeSeason) &&
    (seasonNflOverview?.importState.importedRegularSeasonWeeks ?? 0) >= getRegularSeasonWeekLimit(activeSeason?.year ?? 0) &&
    seasonNflLedgerPreview?.postingStatus === "POSTED";
  const postseasonComplete =
    Boolean(activeSeason) &&
    Boolean((seasonNflOverview?.importState.importedPlayoffPhases ?? []).includes("SUPER_BOWL")) &&
    seasonNflLedgerPreview?.postingStatus === "POSTED";
  const keeperSelectionsComplete = isInauguralAuctionSeason
    ? assignedTeamsCount === 30
    : draftState?.keeperProgress.isComplete ?? false;
  const offseasonDraftComplete = isInauguralAuctionSeason
    ? assignedTeamsCount === 30
    : draftState?.draft.status === "COMPLETED";
  const availablePhaseTransitions =
    seasonPhaseContext?.availableTransitions ?? getFallbackPhaseTransitions(currentLeaguePhase);

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
    : isInauguralAuctionSeason && assignedTeamsCount < 30
    ? "Configure and run the inaugural auction until all 30 awarded teams are finalized."
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
    isInauguralAuctionSeason && assignedTeamsCount < 30
      ? "The inaugural auction must finish with 30 awarded teams and exactly two NFL teams left unassigned."
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
      <div className="w-full space-y-6">
        <section className="relative overflow-hidden rounded-[2rem] border border-[#123222] bg-[radial-gradient(circle_at_top_left,rgba(113,255,104,0.22),transparent_28%),linear-gradient(135deg,#081a11_0%,#0d2919_52%,#143222_100%)] shadow-[0_30px_90px_-42px_rgba(1,24,14,0.92)]">
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,transparent,rgba(255,204,92,0.06),transparent)] opacity-80" />
          <div className="relative min-h-[320px] sm:min-h-[460px]">
            <BrandAccountSlot />
            <div className="absolute left-5 top-5 z-20 sm:left-6 sm:top-6">
              <Link
                className={cn(
                  buttonVariants({ variant: "outline" }),
                  "border-white/65 bg-white/10 text-white hover:bg-white/18 hover:text-white"
                )}
                href="/"
              >
                Back to Home
              </Link>
            </div>
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-4 py-6 sm:px-6 sm:py-8">
              <BrandLogo size="hero" priority />
            </div>
          </div>
        </section>

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
            {viewMode === "commissioner" && commissionerAccessMessage ? (
              <Card className="border-amber-200 bg-amber-50">
                <CardContent className="p-4 text-sm text-amber-900">
                  {commissionerAccessMessage}
                </CardContent>
              </Card>
            ) : null}

            {viewMode === "commissioner" ? (
              <div className="relative z-10 flex flex-wrap gap-2 rounded-2xl border border-border bg-white/90 p-2 shadow-[0_14px_28px_-24px_rgba(6,32,18,0.2),0_0_0_1px_rgba(24,54,33,0.08)] backdrop-blur-sm">
                {[
                  { id: "overview", label: "Overview" },
                  { id: "seasons", label: "Seasons" },
                  { id: "members", label: "Members" },
                  { id: "ownership", label: "Ownership" },
                  { id: "results-draft", label: "Draft" },
                  { id: "fantasy", label: "Fantasy" },
                  { id: "nfl-performance", label: "NFL Results" },
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
            ) : null}

            {viewMode === "owner" ? (
              <div className="space-y-6">
                <LeagueOwnerPanel activeSeason={activeSeason} leagueName={bootstrapState.league.name} />
                {activeSeason?.draftMode === "INAUGURAL_AUCTION" ? (
                  <InauguralAuctionPanel
                    activeSeason={activeSeason}
                    description="Bid live from the owner view while the inaugural season is being assigned."
                    title="Live Auction Room"
                  />
                ) : null}
              </div>
            ) : null}

            {viewMode === "commissioner" && activeTab === "overview" ? (
              <Card>
                <CardHeader>
                  <CardTitle>League Overview</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-x-8 gap-y-3 text-sm text-muted-foreground sm:grid-cols-2">
                  <p>
                    <span className="font-semibold text-foreground">League:</span> {bootstrapState.league.name}
                  </p>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-foreground">Commissioner:</span>
                    {bootstrapState.league.commissioner ? (
                      <>
                        <ProfileAvatar
                          className="h-7 w-7 border-border bg-slate-100 text-slate-700"
                          fallbackClassName="text-[10px]"
                          imageUrl={bootstrapState.league.commissioner.profileImageUrl}
                          name={bootstrapState.league.commissioner.displayName}
                        />
                        <span>{bootstrapState.league.commissioner.displayName}</span>
                      </>
                    ) : (
                      <span>Not assigned</span>
                    )}
                  </div>
                  <p>
                    <span className="font-semibold text-foreground">Active season:</span>{" "}
                    {activeSeason ? activeSeason.name ?? activeSeason.year : "None selected"}
                  </p>
                  <p>
                    <span className="font-semibold text-foreground">Members:</span> {bootstrapState.memberCount}
                  </p>
                  <p>
                    <span className="font-semibold text-foreground">Ledger Entry Fee:</span> $200
                  </p>
                  <p>
                    <span className="font-semibold text-foreground">Ledger Payouts:</span> Standard
                  </p>
                  <p>
                    <span className="font-semibold text-foreground">Fantasy Scoring:</span> Big Play PPR
                  </p>
                </CardContent>
              </Card>
            ) : null}

            {viewMode === "commissioner" && activeTab === "seasons" ? (
              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Season Management</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <form className="space-y-4" onSubmit={handleCreateSeason}>
                      <Button className={getSubmittingButtonClass("create-season")} disabled={isSubmitting || !canManageLeague} type="submit">
                        Create New Season
                      </Button>
                    </form>

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
                              {editingSeasonId === season.id ? (
                                <div className="mt-3 flex flex-wrap items-center gap-2">
                                  <Input
                                    className="w-32"
                                    inputMode="numeric"
                                    onChange={(event) => setEditingSeasonYear(event.target.value)}
                                    value={editingSeasonYear}
                                  />
                                  <Button
                                    className={getSubmittingButtonClass(`season-year:${season.id}`)}
                                    disabled={isSubmitting || !canManageLeague || !editingSeasonYear.trim()}
                                    onClick={() => void handleUpdateSeasonYear(season.id)}
                                    type="button"
                                  >
                                    Save Year
                                  </Button>
                                  <Button
                                    className={getSubmittingButtonClass(`season-year:${season.id}`)}
                                    disabled={isSubmitting}
                                    onClick={cancelSeasonYearEdit}
                                    type="button"
                                    variant="outline"
                                  >
                                    Cancel
                                  </Button>
                                </div>
                              ) : null}
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                              <button
                                aria-label={season.isLocked ? `Unlock ${season.name ?? season.year}` : `Lock ${season.name ?? season.year}`}
                                className={cn(
                                  "inline-flex h-10 w-10 items-center justify-center rounded-full border transition-colors disabled:opacity-100",
                                  season.isLocked
                                    ? "border-rose-200 bg-rose-100 text-rose-500 hover:bg-rose-200"
                                    : "border-border bg-background text-muted-foreground hover:bg-secondary hover:text-foreground",
                                  isSubmitting && pendingActionId === `season-lock:${season.id}` ? "opacity-70" : undefined
                                )}
                                disabled={
                                  isSubmitting ||
                                  !canManageLeague ||
                                  (!season.isLocked &&
                                    season.status === "ACTIVE" &&
                                    !bootstrapState?.lockReadiness.isReadyToLock)
                                }
                                onClick={() => void handleToggleSeasonLock(season)}
                                title={season.isLocked ? "Unlock season" : "Lock season"}
                                type="button"
                              >
                                {season.isLocked ? <Lock className="h-4 w-4" /> : <LockOpen className="h-4 w-4" />}
                              </button>
                              {editingSeasonId !== season.id ? (
                                <Button
                                  className={getSubmittingButtonClass(`edit-season:${season.id}`)}
                                  disabled={isSubmitting || !canManageLeague}
                                  onClick={() => startSeasonYearEdit(season.id, season.year)}
                                  type="button"
                                  variant="outline"
                                >
                                  Edit Year
                                </Button>
                              ) : null}
                              <Button
                                className={cn("min-w-[7.75rem]", getSubmittingButtonClass(`set-active:${season.id}`))}
                                disabled={isSubmitting || season.status === "ACTIVE" || !canManageLeague}
                                onClick={() => void handleSetActiveSeason(season.id)}
                                type="button"
                                variant={season.status === "ACTIVE" ? "secondary" : "outline"}
                              >
                                {season.status === "ACTIVE" ? "Active Season" : "Set Active"}
                              </Button>
                              {season.status === "ACTIVE" && availablePhaseTransitions.length ? (
                                availablePhaseTransitions.map((transition) => (
                                  <Button
                                    className={getSubmittingButtonClass(`move-phase:${transition.phase}`)}
                                    disabled={isSubmitting || !canManageLeague || !transition.isAvailable}
                                    key={transition.phase}
                                    onClick={() => void handleUpdateLeaguePhase(transition.phase)}
                                    type="button"
                                    variant="outline"
                                  >
                                    Move to {transition.phase}
                                  </Button>
                                ))
                              ) : null}
                            </div>
                            {season.status === "ACTIVE" && availablePhaseTransitions.length ? (
                              <div className="basis-full rounded-lg border border-dashed border-border p-3 text-sm text-muted-foreground">
                                {availablePhaseTransitions.map((transition) => (
                                  <div className="mb-2 last:mb-0" key={`${season.id}-${transition.phase}`}>
                                    <p className="font-medium text-foreground">{transition.phase}</p>
                                    {transition.warnings.length > 0 ? (
                                      <ul className="mt-1 space-y-1">
                                        {transition.warnings.map((warning) => (
                                          <li key={warning}>{warning}</li>
                                        ))}
                                      </ul>
                                    ) : (
                                      <p className="mt-1">No transition warnings.</p>
                                    )}
                                  </div>
                                ))}
                              </div>
                            ) : null}
                          </div>
                        ))
                      )}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Season Checklist</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-5">
                    <div className="rounded-2xl border border-border bg-secondary/25 p-4">
                      <p className="text-sm text-muted-foreground">
                        <span className="font-semibold text-foreground">Active Season:</span>{" "}
                        {activeSeason ? activeSeason.name ?? activeSeason.year : "None selected"}
                      </p>
                      <p className="mt-2 text-sm text-muted-foreground">
                        <span className="font-semibold text-foreground">Overall Status:</span>{" "}
                        {lockState === "LOCKED"
                          ? "Locked"
                          : lockState === "READY_TO_LOCK"
                          ? "Ready to Lock"
                          : "Not Ready to Lock"}
                      </p>
                    </div>

                    <div className="space-y-3">
                      {usesInauguralDraftChecklist ? (
                        <ChecklistStatusItem
                          label="Inaugural Draft Complete"
                          passed={assignedTeamsCount === 30}
                          value={
                            assignedTeamsCount === 30
                              ? "The inaugural auction is complete and all 30 awarded teams are finalized."
                              : "Finish the inaugural auction to finalize all 30 awarded teams for the league's first season."
                          }
                        />
                      ) : (
                        <>
                          <ChecklistStatusItem
                            label="Keepers Selected & Teams Dropped"
                            passed={keeperSelectionsComplete}
                            value={
                              keeperSelectionsComplete
                                ? "Keeper selections are saved for every owner and the 12-team offseason pool is ready."
                                : "All owners still need two saved keepers before the 12-team offseason pool is ready."
                            }
                          />
                          <ChecklistStatusItem
                            label="Offseason Draft Complete"
                            passed={offseasonDraftComplete}
                            value={
                              offseasonDraftComplete
                                ? "Every owner has selected a new third team and the offseason draft is complete."
                                : "The offseason draft still needs to finish before every owner has a new third team."
                            }
                          />
                        </>
                      )}
                      <ChecklistStatusItem
                        label="Fantasy Results Complete"
                        passed={standingsSaved}
                        value={
                          standingsSaved
                            ? "The commissioner has saved final fantasy standings for the active season."
                            : "Enter and save the active season's final fantasy standings to complete fantasy results."
                        }
                      />
                      <ChecklistStatusItem
                        label="NFL Regular Season Complete"
                        passed={Boolean(regularSeasonComplete)}
                        value={
                          regularSeasonComplete
                            ? "All regular-season NFL weeks are imported and regular-season payouts are posted."
                            : "Complete all regular-season NFL imports and post the league's regular-season payouts."
                        }
                      />
                      <ChecklistStatusItem
                        label="NFL Postseason Complete"
                        passed={Boolean(postseasonComplete)}
                        value={
                          postseasonComplete
                            ? "All NFL playoff phases through the Super Bowl are imported and postseason payouts are posted."
                            : "Finish playoff imports through the Super Bowl and post the league's postseason payouts."
                        }
                      />
                    </div>
                  </CardContent>
                </Card>
              </div>
            ) : null}

            {viewMode === "commissioner" && activeTab === "members" ? (
              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Members Management</CardTitle>
                    <CardDescription>
                      Add new members or replace an existing member while preserving that member slot&apos;s league history.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <form className="grid gap-3 md:grid-cols-3" onSubmit={handleAddMember}>
                      <Input onChange={(event) => setMemberDisplayName(event.target.value)} placeholder="Display name" value={memberDisplayName} />
                      <Input onChange={(event) => setMemberEmail(event.target.value)} placeholder="Email" type="email" value={memberEmail} />
                      <Button
                        className={getSubmittingButtonClass("add-member")}
                        disabled={isSubmitting || !memberDisplayName || !memberEmail || !canManageLeague}
                        type="submit"
                      >
                        Add Member
                      </Button>
                    </form>

                    <div className="space-y-3">
                      {members.map((member) => (
                        <div
                          className={`flex flex-wrap items-center justify-between gap-3 rounded-lg border p-4 transition-colors ${
                            replacementMemberId === member.id ? "border-foreground bg-secondary/20" : "border-border"
                          }`}
                          key={member.id}
                        >
                          <div>
                            <div className="flex items-center gap-3">
                              <ProfileAvatar
                                className="h-9 w-9 border-border bg-slate-100 text-slate-700"
                                fallbackClassName="text-xs"
                                imageUrl={member.profileImageUrl}
                                name={member.displayName}
                              />
                              <p className="font-medium text-foreground">{member.displayName}</p>
                            </div>
                            <p className="text-sm text-muted-foreground">{member.email}</p>
                            {member.phoneNumber ? (
                              <p className="text-sm text-muted-foreground">{member.phoneNumber}</p>
                            ) : null}
                          </div>
                          <div className="flex items-center gap-3">
                            <Button
                              className={getSubmittingButtonClass(`open-member-replace:${member.id}`)}
                              disabled={isSubmitting || member.role === "COMMISSIONER" || !canManageLeague}
                              onClick={() => startMemberReplacement(member.id)}
                              type="button"
                              variant={replacementMemberId === member.id ? "secondary" : "outline"}
                            >
                              {member.role === "COMMISSIONER"
                                ? "Commissioner"
                                : replacementMemberId === member.id
                                ? "Changing Member"
                                : "Change Member"}
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

              </div>
            ) : null}

            {viewMode === "commissioner" && activeTab === "ownership" ? (
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
                              className={getSubmittingButtonClass("assign-team")}
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
                                  <div className="flex items-center gap-3">
                                    {selectedOwner ? (
                                      <ProfileAvatar
                                        className="h-9 w-9 border-border bg-slate-100 text-slate-700"
                                        fallbackClassName="text-xs"
                                        imageUrl={selectedOwner.profileImageUrl}
                                        name={selectedOwner.displayName}
                                      />
                                    ) : null}
                                    <p className="font-medium text-foreground">
                                      {selectedOwner ? selectedOwner.displayName : "Select an owner to edit"}
                                    </p>
                                  </div>
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
                                            className={cn("h-7 px-2", getSubmittingButtonClass(`remove-team:${entry.ownershipId}`))}
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
                                <div className="flex items-center gap-3">
                                  <ProfileAvatar
                                    className="h-9 w-9 border-border bg-slate-100 text-slate-700"
                                    fallbackClassName="text-xs"
                                    imageUrl={owner.profileImageUrl}
                                    name={owner.displayName}
                                  />
                                  <p className="font-medium text-foreground">{owner.displayName}</p>
                                </div>
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

            {viewMode === "commissioner" && activeTab === "results-draft" ? (
              <div className="space-y-6">
                {activeSeason?.draftMode !== "INAUGURAL_AUCTION" ? (
                  <div className="flex flex-wrap gap-2">
                    {[
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
                  </div>
                ) : null}

                {activeResultsDraftTab === "offseason-draft" ? (
                  activeSeason?.draftMode === "INAUGURAL_AUCTION" ? (
                    <InauguralAuctionPanel activeSeason={activeSeason} />
                  ) : (
                    <OffseasonDraftPanel
                      leagueId={leagueId}
                      leagueCode={bootstrapState?.league.leagueCode ?? null}
                      activeSeason={activeSeason}
                      accessMessage={commissionerAccessMessage}
                      canManageDraft={canManageLeague}
                      draftState={draftState}
                      isDraftStateLoading={isLoading && hasActiveSeason && !draftState}
                      isSubmitting={isSubmitting}
                      pendingActionId={pendingActionId}
                      members={members}
                      onEndSubmit={() => {
                        setPendingActionId(null);
                        setIsSubmitting(false);
                      }}
                      onError={(message) => setErrorMessage(message || null)}
                      onRefresh={() => refreshLeagueDashboard(leagueId, { includeOperationalData: true })}
                      onStartSubmit={(actionId) => {
                        setPendingActionId(actionId);
                        setIsSubmitting(true);
                      }}
                      onSuccess={(message) => setSuccessMessage(message || null)}
                      phaseContext={seasonPhaseContext}
                      seasons={seasons}
                    />
                  )
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
                    onRefresh={() => refreshLeagueDashboard(leagueId, { includeOperationalData: true })}
                    onSuccess={(message) => setSuccessMessage(message || null)}
                    phaseContext={seasonPhaseContext}
                    seasonOwnership={seasonOwnership}
                    seasons={seasons}
                    visibleSections={["draftReset", "draftOrder"]}
                  />
                ) : null}

                <DraftScheduler activeSeason={activeSeason} />
              </div>
            ) : null}

            {viewMode === "commissioner" && activeTab === "fantasy" ? (
              <CommissionerToolsPanel
                activeSeason={activeSeason}
                accessMessage={commissionerAccessMessage}
                canManageLeague={canManageLeague}
                draftState={draftState}
                hideHeading
                members={members}
                onError={(message) => setErrorMessage(message || null)}
                onRefresh={() => refreshLeagueDashboard(leagueId, { includeOperationalData: true })}
                onSuccess={(message) => setSuccessMessage(message || null)}
                phaseContext={seasonPhaseContext}
                seasonOwnership={seasonOwnership}
                seasons={seasons}
                visibleSections={["standings"]}
              />
            ) : null}

            {viewMode === "commissioner" && activeTab === "nfl-performance" ? (
              <SeasonNflPerformancePanel
                accessMessage={commissionerAccessMessage}
                activeSeason={activeSeason}
                canManageNfl={canManageLeague}
                onError={(message) => setErrorMessage(message || null)}
                onSuccess={(message) => setSuccessMessage(message || null)}
                seasonOwnership={seasonOwnership}
              />
            ) : null}

            {viewMode === "commissioner" && activeTab === "ledger" ? (
              <SeasonLedgerPanel
                accessMessage={commissionerAccessMessage}
                activeSeason={activeSeason}
                canManageLedger={canManageLeague}
                members={members}
                onError={(message) => setErrorMessage(message || null)}
                onSuccess={(message) => setSuccessMessage(message || null)}
              />
            ) : null}

            {viewMode === "commissioner" && activeTab === "history-analytics" ? <LeagueHistoryPanel leagueId={leagueId} /> : null}

            {canToggleOwnerView ? (
              <div className="flex items-center justify-end gap-3">
                <span className="text-base font-semibold text-foreground">Dashboard View:</span>
                <div className="inline-flex rounded-full border border-border bg-white/90 p-1 shadow-[0_14px_28px_-24px_rgba(6,32,18,0.2),0_0_0_1px_rgba(24,54,33,0.08)] backdrop-blur-sm">
                  <button
                    className={cn(
                      "rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
                      viewMode === "commissioner"
                        ? "bg-slate-800 text-white shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                    onClick={() => setViewMode("commissioner")}
                    type="button"
                  >
                    Commissioner
                  </button>
                  <button
                    className={cn(
                      "rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
                      viewMode === "owner"
                        ? "bg-slate-800 text-white shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                    onClick={() => setViewMode("owner")}
                    type="button"
                  >
                    Owner
                  </button>
                </div>
              </div>
            ) : null}
          </>
        )}
      </div>

      {replacementTargetMember ? (
        <div className="fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-slate-950/60 backdrop-blur-md"
            onClick={() => {
              if (!isSubmitting) {
                cancelMemberReplacement();
              }
            }}
          />
          <div className="absolute inset-0 overflow-y-auto px-4 py-6">
            <div className="flex min-h-full items-center justify-center">
              <Card className="relative z-10 w-full max-w-lg border border-slate-200 bg-white shadow-[0_28px_90px_rgba(15,23,42,0.38)] ring-1 ring-slate-900/10">
                <CardHeader>
                  <CardTitle>Change Member</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600 shadow-sm">
                    <p className="font-medium text-foreground">{replacementTargetMember.displayName}</p>
                    <p>{replacementTargetMember.email}</p>
                    <p>{replacementTargetMember.role}</p>
                  </div>

                  <form className="space-y-4" onSubmit={handleReplaceMember}>
                    <Input
                      onChange={(event) => setReplacementDisplayName(event.target.value)}
                      placeholder="New member display name"
                      value={replacementDisplayName}
                    />
                    <Input
                      onChange={(event) => setReplacementEmail(event.target.value)}
                      placeholder="New member email"
                      type="email"
                      value={replacementEmail}
                    />

                    <div className="rounded-lg border border-dashed border-emerald-300 bg-emerald-50/80 p-4 text-sm text-emerald-900">
                      The replacement user inherits this member slot&apos;s teams, season history, standings, ledger records,
                      and draft history.
                    </div>

                    <div className="flex flex-wrap gap-3">
                      <Button
                        className={getSubmittingButtonClass(`replace-member:${replacementMemberId}`)}
                        disabled={
                          isSubmitting ||
                          !canManageLeague ||
                          !replacementMemberId ||
                          !replacementDisplayName ||
                          !replacementEmail
                        }
                        type="submit"
                      >
                        Save Member Change
                      </Button>
                      <Button
                        className={getSubmittingButtonClass(`replace-member:${replacementMemberId}`)}
                        disabled={isSubmitting}
                        onClick={() => cancelMemberReplacement()}
                        type="button"
                        variant="outline"
                      >
                        Cancel
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
