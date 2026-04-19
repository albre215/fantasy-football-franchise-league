import { redirect } from "next/navigation";

import { getServerAuthSession } from "@/auth";
import { DraftLobbyClient } from "@/components/league/draft-lobby-client";
import { leagueService } from "@/server/services/league-service";

interface DraftLobbyPageProps {
  searchParams?: {
    leagueId?: string;
  };
}

export default async function DraftLobbyPage({ searchParams }: DraftLobbyPageProps) {
  const session = await getServerAuthSession();
  const leagueId = searchParams?.leagueId;

  if (!leagueId) {
    redirect("/");
  }

  if (!session?.user?.id) {
    redirect(`/?callbackUrl=${encodeURIComponent(`/league/draft-lobby?leagueId=${leagueId}`)}`);
  }

  let bootstrapState = null;
  let errorMessage: string | null = null;
  try {
    bootstrapState = await leagueService.getBootstrapState(leagueId);
  } catch (error) {
    errorMessage = error instanceof Error ? error.message : "Unable to load league.";
  }

  const activeSeason = bootstrapState?.activeSeason ?? null;
  const leagueName = bootstrapState?.league.name ?? "League";

  return (
    <DraftLobbyClient
      activeSeason={activeSeason}
      errorMessage={errorMessage}
      leagueName={leagueName}
    />
  );
}
