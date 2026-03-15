import { NextResponse } from "next/server";

import { HistoryServiceError, historyService } from "@/server/services/history-service";
import type { DraftHistoryResponse } from "@/types/history";

export const dynamic = "force-dynamic";

interface RouteContext {
  params: {
    leagueId: string;
  };
}

export async function GET(_request: Request, { params }: RouteContext) {
  try {
    const drafts = await historyService.getDraftHistory(params.leagueId);

    return NextResponse.json<DraftHistoryResponse>({ drafts });
  } catch (error) {
    if (error instanceof HistoryServiceError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }

    return NextResponse.json({ error: "Unable to load draft history." }, { status: 500 });
  }
}
