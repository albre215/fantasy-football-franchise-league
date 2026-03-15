import { LeagueDashboard } from "@/components/league/league-dashboard";

interface LeaguePageProps {
  searchParams?: {
    leagueId?: string;
  };
}

export default function LeaguePage({ searchParams }: LeaguePageProps) {
  return <LeagueDashboard leagueId={searchParams?.leagueId} />;
}
