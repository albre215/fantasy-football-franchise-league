import { NextResponse } from "next/server";

import { SeasonServiceError, seasonService } from "@/server/services/season-service";
import type { ActiveSeasonResponse } from "@/types/season";

export const dynamic = "force-dynamic";

interface RouteContext {
  params: {
    leagueId: string;
  };
}

export async function GET(_request: Request, { params }: RouteContext) {
  try {
    const season = await seasonService.getActiveSeason(params.leagueId);

    return NextResponse.json<ActiveSeasonResponse>({ season });
  } catch (error) {
    if (error instanceof SeasonServiceError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }

    return NextResponse.json({ error: "Unable to load active season." }, { status: 500 });
  }
}
