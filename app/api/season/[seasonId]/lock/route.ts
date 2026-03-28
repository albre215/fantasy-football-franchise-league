import { NextResponse } from "next/server";

import { RouteAuthError, requireAuthenticatedUserId } from "@/lib/auth-session";
import { SeasonServiceError, seasonService } from "@/server/services/season-service";
import type { LockSeasonResponse, SeasonActorInput } from "@/types/season";

export const dynamic = "force-dynamic";

interface RouteContext {
  params: {
    seasonId: string;
  };
}

export async function POST(request: Request, { params }: RouteContext) {
  try {
    const body = (await request.json()) as Partial<SeasonActorInput>;
    const actingUserId = await requireAuthenticatedUserId();
    const result = await seasonService.lockSeasonWithActor({
      seasonId: params.seasonId,
      actingUserId
    });

    return NextResponse.json<LockSeasonResponse>(result);
  } catch (error) {
    if (error instanceof RouteAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }

    if (error instanceof SeasonServiceError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }

    return NextResponse.json({ error: "Unable to lock season." }, { status: 500 });
  }
}
