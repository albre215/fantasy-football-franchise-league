import { NextResponse } from "next/server";

import { teamOwnershipService } from "@/server/services/team-ownership-service";
import type { NFLTeamsResponse } from "@/types/team-ownership";

export const dynamic = "force-dynamic";

export async function GET() {
  const teams = await teamOwnershipService.getAllTeams();

  return NextResponse.json<NFLTeamsResponse>({ teams });
}
