import { NextResponse } from "next/server";

import { leagueService } from "@/server/services/league-service";
import type { ListLeaguesResponse } from "@/types/league";

export const dynamic = "force-dynamic";

export async function GET() {
  const leagues = await leagueService.listLeagues();

  return NextResponse.json<ListLeaguesResponse>({ leagues });
}
