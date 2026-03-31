import { NextResponse } from "next/server";

import { requireAuthenticatedUserId, RouteAuthError } from "@/lib/auth-session";
import { NflPerformanceServiceError, nflPerformanceService } from "@/server/services/nfl-performance-service";
import type {
  SeasonWeekNflResultsResponse,
  UpsertSeasonWeekTeamResultInput,
  UpsertSeasonWeekTeamResultResponse
} from "@/types/nfl-performance";

export const dynamic = "force-dynamic";

interface RouteContext {
  params: {
    seasonId: string;
    weekNumber: string;
  };
}

function parseWeekNumber(value: string) {
  return Number.parseInt(value, 10);
}

export async function GET(_request: Request, { params }: RouteContext) {
  try {
    const actingUserId = await requireAuthenticatedUserId();
    const nfl = await nflPerformanceService.getSeasonWeekNflResults(
      params.seasonId,
      parseWeekNumber(params.weekNumber),
      actingUserId
    );

    return NextResponse.json<SeasonWeekNflResultsResponse>({ nfl });
  } catch (error) {
    if (error instanceof RouteAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }

    if (error instanceof NflPerformanceServiceError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }

    return NextResponse.json({ error: "Unable to load weekly NFL results." }, { status: 500 });
  }
}

export async function POST(request: Request, { params }: RouteContext) {
  try {
    const body = (await request.json()) as Partial<UpsertSeasonWeekTeamResultInput>;
    const actingUserId = await requireAuthenticatedUserId();
    const nfl = await nflPerformanceService.upsertSeasonWeekTeamResults({
      seasonId: params.seasonId,
      actingUserId,
      weekNumber: parseWeekNumber(params.weekNumber),
      nflTeamId: body.nflTeamId ?? "",
      opponentNflTeamId: body.opponentNflTeamId ?? null,
      phase: body.phase ?? "REGULAR_SEASON",
      result: body.result ?? "WIN",
      pointsFor: typeof body.pointsFor === "number" ? body.pointsFor : null,
      pointsAgainst: typeof body.pointsAgainst === "number" ? body.pointsAgainst : null,
      metadata: body.metadata ?? null
    });

    return NextResponse.json<UpsertSeasonWeekTeamResultResponse>({ nfl }, { status: 201 });
  } catch (error) {
    if (error instanceof RouteAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }

    if (error instanceof NflPerformanceServiceError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }

    return NextResponse.json({ error: "Unable to save weekly NFL results." }, { status: 500 });
  }
}
