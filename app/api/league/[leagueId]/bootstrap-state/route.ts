import { NextResponse } from "next/server";

import { LeagueServiceError, leagueService } from "@/server/services/league-service";
import type { LeagueBootstrapStateResponse } from "@/types/league";

export const dynamic = "force-dynamic";

interface RouteContext {
  params: {
    leagueId: string;
  };
}

export async function GET(_request: Request, { params }: RouteContext) {
  try {
    const bootstrapState = await leagueService.getBootstrapState(params.leagueId);

    return NextResponse.json<LeagueBootstrapStateResponse>({ bootstrapState });
  } catch (error) {
    if (error instanceof LeagueServiceError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }

    return NextResponse.json({ error: "Unable to load bootstrap state." }, { status: 500 });
  }
}
