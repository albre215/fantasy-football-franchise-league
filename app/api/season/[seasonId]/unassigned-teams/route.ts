import { NextResponse } from "next/server";

import { TeamOwnershipServiceError, teamOwnershipService } from "@/server/services/team-ownership-service";
import type { NFLTeamsResponse } from "@/types/team-ownership";

export const dynamic = "force-dynamic";

interface RouteContext {
  params: {
    seasonId: string;
  };
}

export async function GET(_request: Request, { params }: RouteContext) {
  try {
    const teams = await teamOwnershipService.getAvailableTeams(params.seasonId);

    return NextResponse.json<NFLTeamsResponse>({ teams });
  } catch (error) {
    if (error instanceof TeamOwnershipServiceError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }

    return NextResponse.json({ error: "Unable to load unassigned teams." }, { status: 500 });
  }
}
