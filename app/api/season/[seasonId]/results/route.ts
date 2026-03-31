import { NextResponse } from "next/server";

import { requireAuthenticatedUserId, RouteAuthError } from "@/lib/auth-session";
import { resultsService, ResultsServiceError } from "@/server/services/results-service";
import type {
  FantasyPayoutConfigEntry,
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
      orderedLeagueMemberIds?: string[];
      payoutConfig?: FantasyPayoutConfigEntry[];
    };
    const actingUserId = await requireAuthenticatedUserId();

    const results = await resultsService.saveManualSeasonStandings({
      seasonId: params.seasonId,
      actingUserId,
      orderedLeagueMemberIds: Array.isArray(body.orderedLeagueMemberIds) ? body.orderedLeagueMemberIds : [],
      payoutConfig: Array.isArray(body.payoutConfig) ? body.payoutConfig : undefined
    });

    return NextResponse.json<SaveManualSeasonStandingsResponse>({ results });
  } catch (error) {
    if (error instanceof RouteAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }

    if (error instanceof ResultsServiceError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }

    return NextResponse.json({ error: "Unable to save final standings." }, { status: 500 });
  }
}
