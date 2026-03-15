import { NextResponse } from "next/server";

import { HistoryServiceError, historyService } from "@/server/services/history-service";
import type { FranchiseHistoryResponse } from "@/types/history";

export const dynamic = "force-dynamic";

interface RouteContext {
  params: {
    leagueId: string;
  };
}

export async function GET(request: Request, { params }: RouteContext) {
  try {
    const { searchParams } = new URL(request.url);
    const franchiseHistory = await historyService.getFranchiseHistory(
      params.leagueId,
      searchParams.get("nflTeamId") ?? ""
    );

    return NextResponse.json<FranchiseHistoryResponse>({ franchiseHistory });
  } catch (error) {
    if (error instanceof HistoryServiceError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }

    return NextResponse.json({ error: "Unable to load franchise history." }, { status: 500 });
  }
}
