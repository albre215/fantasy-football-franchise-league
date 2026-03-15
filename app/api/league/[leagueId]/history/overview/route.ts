import { NextResponse } from "next/server";

import { HistoryServiceError, historyService } from "@/server/services/history-service";
import type { LeagueHistoryOverviewResponse } from "@/types/history";

export const dynamic = "force-dynamic";

interface RouteContext {
  params: {
    leagueId: string;
  };
}

export async function GET(_request: Request, { params }: RouteContext) {
  try {
    const overview = await historyService.getLeagueHistoryOverview(params.leagueId);

    return NextResponse.json<LeagueHistoryOverviewResponse>({ overview });
  } catch (error) {
    if (error instanceof HistoryServiceError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }

    return NextResponse.json({ error: "Unable to load league history overview." }, { status: 500 });
  }
}
