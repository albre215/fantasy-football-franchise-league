import { redirect } from "next/navigation";

import { getServerAuthSession } from "@/auth";
import { LeagueDashboard } from "@/components/league/league-dashboard";
import { leagueService } from "@/server/services/league-service";
import { seasonService } from "@/server/services/season-service";
import type { LeagueBootstrapStateResponse, LeagueListItem } from "@/types/league";
import type { SeasonListResponse } from "@/types/season";

interface LeaguePageProps {
  searchParams?: {
    leagueId?: string;
  };
}

export default async function LeaguePage({ searchParams }: LeaguePageProps) {
  const session = await getServerAuthSession();
  const isAuthenticated = Boolean(session?.user?.id);
  const leagueId = searchParams?.leagueId;

  if (!leagueId) {
    redirect("/");
  }

  let initialLeagueOptions: LeagueListItem[] = [];
  let initialBootstrapState: LeagueBootstrapStateResponse["bootstrapState"] | null = null;
  let initialSeasons: SeasonListResponse["seasons"] = [];
  let initialErrorMessage: string | null = null;

  if (isAuthenticated && session?.user?.id) {
    try {
      initialLeagueOptions = await leagueService.listLeaguesForUser(session.user.id);

      if (leagueId) {
        try {
          initialBootstrapState = await leagueService.getBootstrapState(leagueId);
        } catch (error) {
          initialErrorMessage = error instanceof Error ? error.message : "Unable to load league.";
        }

        try {
          initialSeasons = await seasonService.getLeagueSeasons(leagueId);
        } catch (error) {
          if (!initialErrorMessage) {
            initialErrorMessage = error instanceof Error ? error.message : "Unable to load seasons.";
          }
        }
      }
    } catch (error) {
      if (!initialErrorMessage) {
        initialErrorMessage = error instanceof Error ? error.message : "Unable to load league.";
      }
    }
  }

  return (
    <LeagueDashboard
      initialBootstrapState={initialBootstrapState}
      initialErrorMessage={initialErrorMessage}
      initialIsAuthenticated={isAuthenticated}
      initialLeagueOptions={initialLeagueOptions}
      initialSeasons={initialSeasons}
      leagueId={leagueId}
    />
  );
}
