import { NextResponse } from "next/server";

import { resultsService, ResultsServiceError } from "@/server/services/results-service";
import type { DraftOrderRecommendationResponse } from "@/types/draft";

export const dynamic = "force-dynamic";

interface RouteContext {
  params: {
    seasonId: string;
  };
}

export async function GET(request: Request, { params }: RouteContext) {
  try {
    const { searchParams } = new URL(request.url);
    const sourceSeasonId = searchParams.get("sourceSeasonId")?.trim() ?? "";
    const recommendation = await resultsService.getRecommendedOffseasonDraftOrder(sourceSeasonId, params.seasonId);

    return NextResponse.json<DraftOrderRecommendationResponse>({ recommendation });
  } catch (error) {
    if (error instanceof ResultsServiceError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }

    return NextResponse.json({ error: "Unable to generate recommended draft order." }, { status: 500 });
  }
}
