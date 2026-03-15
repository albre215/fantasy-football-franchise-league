import { NextResponse } from "next/server";

import { SeasonServiceError, seasonService } from "@/server/services/season-service";
import type { SetActiveSeasonInput, SetActiveSeasonResponse } from "@/types/season";

export const dynamic = "force-dynamic";

interface RouteContext {
  params: {
    leagueId: string;
  };
}

export async function POST(request: Request, { params }: RouteContext) {
  try {
    const body = (await request.json()) as Partial<SetActiveSeasonInput>;
    const season = await seasonService.setActiveSeason({
      leagueId: params.leagueId,
      seasonId: body.seasonId ?? ""
    });

    return NextResponse.json<SetActiveSeasonResponse>({ season });
  } catch (error) {
    if (error instanceof SeasonServiceError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }

    return NextResponse.json({ error: "Unable to set active season." }, { status: 500 });
  }
}
