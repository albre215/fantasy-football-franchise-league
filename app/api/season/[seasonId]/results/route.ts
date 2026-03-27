import { NextResponse } from "next/server";

import { resultsService, ResultsServiceError } from "@/server/services/results-service";
import type { SeasonResultsResponse } from "@/types/results";

export const dynamic = "force-dynamic";

interface RouteContext {
  params: {
    seasonId: string;
  };
}

export async function GET(_request: Request, { params }: RouteContext) {
  try {
    const results = await resultsService.getSeasonResults(params.seasonId);

    return NextResponse.json<SeasonResultsResponse>({ results });
  } catch (error) {
    if (error instanceof ResultsServiceError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }

    return NextResponse.json({ error: "Unable to load season results." }, { status: 500 });
  }
}
