import { NextResponse } from "next/server";

import { requireAuthenticatedUserId, RouteAuthError } from "@/lib/auth-session";
import { NflPerformanceServiceError, nflPerformanceService } from "@/server/services/nfl-performance-service";
import type { ImportSeasonNflResultsResponse } from "@/types/nfl-performance";

export const dynamic = "force-dynamic";

interface RouteContext {
  params: {
    seasonId: string;
    weekNumber: string;
  };
}

export async function POST(_request: Request, { params }: RouteContext) {
  try {
    const actingUserId = await requireAuthenticatedUserId();
    const nfl = await nflPerformanceService.importSeasonWeekNflResults(
      params.seasonId,
      Number.parseInt(params.weekNumber, 10),
      actingUserId
    );

    return NextResponse.json<ImportSeasonNflResultsResponse>({ nfl }, { status: 201 });
  } catch (error) {
    if (error instanceof RouteAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }

    if (error instanceof NflPerformanceServiceError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }

    return NextResponse.json({ error: "Unable to import weekly NFL results." }, { status: 500 });
  }
}
