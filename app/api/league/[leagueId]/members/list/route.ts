import { NextResponse } from "next/server";

import { LeagueServiceError, leagueService } from "@/server/services/league-service";
import type { LeagueMembersListResponse } from "@/types/league";

export const dynamic = "force-dynamic";

interface RouteContext {
  params: {
    leagueId: string;
  };
}

export async function GET(_request: Request, { params }: RouteContext) {
  try {
    const members = await leagueService.getBootstrapMembers(params.leagueId);

    return NextResponse.json<LeagueMembersListResponse>({ members });
  } catch (error) {
    if (error instanceof LeagueServiceError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }

    return NextResponse.json({ error: "Unable to load league members." }, { status: 500 });
  }
}
