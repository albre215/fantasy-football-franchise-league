import { NextResponse } from "next/server";

import { resultsService, ResultsServiceError } from "@/server/services/results-service";
import type {
  SaveManualSeasonStandingsResponse,
  SeasonResultsResponse
} from "@/types/results";

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

export async function POST(request: Request, { params }: RouteContext) {
  try {
    const body = (await request.json()) as {
      actingUserId?: string;
      orderedLeagueMemberIds?: string[];
    };

    const results = await resultsService.saveManualSeasonStandings({
      seasonId: params.seasonId,
      actingUserId: body.actingUserId?.trim() ?? "",
      orderedLeagueMemberIds: Array.isArray(body.orderedLeagueMemberIds) ? body.orderedLeagueMemberIds : []
    });

    return NextResponse.json<SaveManualSeasonStandingsResponse>({ results });
  } catch (error) {
    if (error instanceof ResultsServiceError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }

    return NextResponse.json({ error: "Unable to save final standings." }, { status: 500 });
  }
}
