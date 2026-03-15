import { NextResponse } from "next/server";

import { HistoryServiceError, historyService } from "@/server/services/history-service";
import type { LeagueSeasonHistoryResponse } from "@/types/history";

export const dynamic = "force-dynamic";

interface RouteContext {
  params: {
    leagueId: string;
  };
}

export async function GET(_request: Request, { params }: RouteContext) {
  try {
    const seasons = await historyService.getSeasonHistory(params.leagueId);

    return NextResponse.json<LeagueSeasonHistoryResponse>({ seasons });
  } catch (error) {
    if (error instanceof HistoryServiceError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }

    return NextResponse.json({ error: "Unable to load season history." }, { status: 500 });
  }
}
