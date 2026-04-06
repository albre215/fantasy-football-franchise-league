import { NextResponse } from "next/server";

import { requireAuthenticatedUserId, RouteAuthError } from "@/lib/auth-session";
import { seasonActivationService } from "@/server/services/season-activation-service";
import { SeasonServiceError } from "@/server/services/season-service";
import type { SetActiveSeasonInput, SetActiveSeasonResponse } from "@/types/season";

export const dynamic = "force-dynamic";

interface RouteContext {
  params: {
    leagueId: string;
  };
}

export async function POST(request: Request, { params }: RouteContext) {
  try {
    const body = (await request.json()) as Partial<SetActiveSeasonInput>;
    const actingUserId = await requireAuthenticatedUserId();
    const result = await seasonActivationService.setActiveSeasonAndSyncNflResults({
      leagueId: params.leagueId,
      seasonId: body.seasonId ?? "",
      actingUserId
    });

    return NextResponse.json<SetActiveSeasonResponse>(result);
  } catch (error) {
    if (error instanceof RouteAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }

    if (error instanceof SeasonServiceError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }

    if (process.env.NODE_ENV !== "production") {
      console.error("Set active season route failed:", error);

      return NextResponse.json(
        {
          error: error instanceof Error ? error.message : "Unable to set active season."
        },
        { status: 500 }
      );
    }

    return NextResponse.json({ error: "Unable to set active season." }, { status: 500 });
  }
}
