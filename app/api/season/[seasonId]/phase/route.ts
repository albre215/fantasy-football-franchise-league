import { NextResponse } from "next/server";

import { requireAuthenticatedUserId, RouteAuthError } from "@/lib/auth-session";
import { seasonPhaseService, SeasonPhaseServiceError } from "@/server/services/season-phase-service";
import type {
  SeasonPhaseContextResponse,
  UpdateSeasonLeaguePhaseInput,
  UpdateSeasonLeaguePhaseResponse
} from "@/types/season";

export const dynamic = "force-dynamic";

interface RouteContext {
  params: {
    seasonId: string;
  };
}

export async function GET(_request: Request, { params }: RouteContext) {
  try {
    await requireAuthenticatedUserId();
    const phase = await seasonPhaseService.getSeasonPhaseContext(params.seasonId);

    return NextResponse.json<SeasonPhaseContextResponse>({ phase });
  } catch (error) {
    if (error instanceof RouteAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }

    if (error instanceof SeasonPhaseServiceError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }

    return NextResponse.json({ error: "Unable to load season phase." }, { status: 500 });
  }
}

export async function POST(request: Request, { params }: RouteContext) {
  try {
    const actingUserId = await requireAuthenticatedUserId();
    const body = (await request.json()) as Partial<UpdateSeasonLeaguePhaseInput>;
    const phase = await seasonPhaseService.updateSeasonLeaguePhase({
      seasonId: params.seasonId,
      actingUserId,
      nextPhase: body.nextPhase ?? "IN_SEASON"
    });

    return NextResponse.json<UpdateSeasonLeaguePhaseResponse>({ phase });
  } catch (error) {
    if (error instanceof RouteAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }

    if (error instanceof SeasonPhaseServiceError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }

    return NextResponse.json({ error: "Unable to update season phase." }, { status: 500 });
  }
}
