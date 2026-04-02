import { NextResponse } from "next/server";

import { requireAuthenticatedUserId, RouteAuthError } from "@/lib/auth-session";
import { NflPerformanceServiceError, nflPerformanceService } from "@/server/services/nfl-performance-service";
import type { SeasonNflOverviewResponse } from "@/types/nfl-performance";

export const dynamic = "force-dynamic";

interface RouteContext {
  params: {
    seasonId: string;
  };
}

export async function GET(_request: Request, { params }: RouteContext) {
  try {
    const actingUserId = await requireAuthenticatedUserId();
    const nfl = await nflPerformanceService.getSeasonNflOverview(params.seasonId, actingUserId);

    return NextResponse.json<SeasonNflOverviewResponse>({ nfl });
  } catch (error) {
    if (error instanceof RouteAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }

    if (error instanceof NflPerformanceServiceError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }

    return NextResponse.json({ error: "Unable to load NFL performance." }, { status: 500 });
  }
}
