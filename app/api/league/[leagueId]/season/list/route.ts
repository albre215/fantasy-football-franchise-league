import { NextResponse } from "next/server";

import { SeasonServiceError, seasonService } from "@/server/services/season-service";
import type { SeasonListResponse } from "@/types/season";

export const dynamic = "force-dynamic";

interface RouteContext {
  params: {
    leagueId: string;
  };
}

export async function GET(_request: Request, { params }: RouteContext) {
  try {
    const seasons = await seasonService.getLeagueSeasons(params.leagueId);

    return NextResponse.json<SeasonListResponse>({ seasons });
  } catch (error) {
    if (error instanceof SeasonServiceError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }

    return NextResponse.json({ error: "Unable to load seasons." }, { status: 500 });
  }
}
