import { NextResponse } from "next/server";

import { HistoryServiceError, historyService } from "@/server/services/history-service";
import type { OwnerHistoryResponse } from "@/types/history";

export const dynamic = "force-dynamic";

interface RouteContext {
  params: {
    leagueId: string;
  };
}

export async function GET(request: Request, { params }: RouteContext) {
  try {
    const { searchParams } = new URL(request.url);
    const ownerHistory = await historyService.getOwnerHistory(params.leagueId, searchParams.get("userId") ?? "");

    return NextResponse.json<OwnerHistoryResponse>({ ownerHistory });
  } catch (error) {
    if (error instanceof HistoryServiceError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }

    return NextResponse.json({ error: "Unable to load owner history." }, { status: 500 });
  }
}
