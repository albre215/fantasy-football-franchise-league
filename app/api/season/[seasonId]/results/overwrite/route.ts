import { NextResponse } from "next/server";

import { requireAuthenticatedUserId, RouteAuthError } from "@/lib/auth-session";
import { resultsService, ResultsServiceError } from "@/server/services/results-service";
import type {
  FantasyPayoutConfigEntry,
  OverwriteManualSeasonStandingsResponse
} from "@/types/results";

export const dynamic = "force-dynamic";

interface RouteContext {
  params: {
    seasonId: string;
  };
}

export async function POST(request: Request, { params }: RouteContext) {
  try {
    const body = (await request.json()) as {
      orderedLeagueMemberIds?: string[];
      confirmOverwrite?: boolean;
      payoutConfig?: FantasyPayoutConfigEntry[];
    };
    const actingUserId = await requireAuthenticatedUserId();

    const results = await resultsService.overwriteManualSeasonStandings({
      seasonId: params.seasonId,
      actingUserId,
      orderedLeagueMemberIds: Array.isArray(body.orderedLeagueMemberIds) ? body.orderedLeagueMemberIds : [],
      confirmOverwrite: body.confirmOverwrite === true,
      payoutConfig: Array.isArray(body.payoutConfig) ? body.payoutConfig : undefined
    });

    return NextResponse.json<OverwriteManualSeasonStandingsResponse>({ results });
  } catch (error) {
    if (error instanceof RouteAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }

    if (error instanceof ResultsServiceError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }

    return NextResponse.json({ error: "Unable to overwrite final standings." }, { status: 500 });
  }
}
