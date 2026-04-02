import { NextResponse } from "next/server";

import { requireAuthenticatedUserId, RouteAuthError } from "@/lib/auth-session";
import {
  seasonPhaseService,
  SeasonPhaseServiceError
} from "@/server/services/season-phase-service";
import type {
  LeaguePhase,
  SeasonPhaseContextResponse,
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
    const phase = await seasonPhaseService.getSeasonPhaseContext(params.seasonId);

    return NextResponse.json<SeasonPhaseContextResponse>({ phase });
  } catch (error) {
    if (error instanceof SeasonPhaseServiceError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }

    return NextResponse.json({ error: "Unable to load season phase context." }, { status: 500 });
  }
}

export async function POST(request: Request, { params }: RouteContext) {
  try {
    const body = (await request.json()) as {
      nextPhase?: string;
    };
    const actingUserId = await requireAuthenticatedUserId();
    const updated = await seasonPhaseService.updateSeasonLeaguePhase({
      seasonId: params.seasonId,
      nextPhase: (body.nextPhase ?? "") as LeaguePhase,
      actingUserId
    });

    return NextResponse.json<UpdateSeasonLeaguePhaseResponse>(updated);
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
