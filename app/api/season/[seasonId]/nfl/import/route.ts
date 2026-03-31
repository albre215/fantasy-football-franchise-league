import { NextResponse } from "next/server";

import { requireAuthenticatedUserId, RouteAuthError } from "@/lib/auth-session";
import { NflPerformanceServiceError, nflPerformanceService } from "@/server/services/nfl-performance-service";
import type { ImportSeasonNflResultsInput, ImportSeasonNflResultsResponse } from "@/types/nfl-performance";

export const dynamic = "force-dynamic";

interface RouteContext {
  params: {
    seasonId: string;
  };
}

export async function POST(request: Request, { params }: RouteContext) {
  try {
    const body = (await request.json()) as Partial<ImportSeasonNflResultsInput>;
    const actingUserId = await requireAuthenticatedUserId();
    const nfl = await nflPerformanceService.importSeasonNflResults({
      seasonId: params.seasonId,
      actingUserId,
      weekNumber: typeof body.weekNumber === "number" ? body.weekNumber : undefined
    });

    return NextResponse.json<ImportSeasonNflResultsResponse>({ nfl }, { status: 201 });
  } catch (error) {
    if (error instanceof RouteAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }

    if (error instanceof NflPerformanceServiceError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }

    return NextResponse.json({ error: "Unable to import NFL results." }, { status: 500 });
  }
}
