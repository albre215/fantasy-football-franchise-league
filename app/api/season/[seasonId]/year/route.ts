import { NextResponse } from "next/server";

import { requireAuthenticatedUserId, RouteAuthError } from "@/lib/auth-session";
import { SeasonServiceError, seasonService } from "@/server/services/season-service";
import type { UpdateSeasonYearResponse } from "@/types/season";

export const dynamic = "force-dynamic";

interface RouteContext {
  params: {
    seasonId: string;
  };
}

export async function POST(request: Request, { params }: RouteContext) {
  try {
    const body = (await request.json()) as {
      year?: number | string;
    };
    const actingUserId = await requireAuthenticatedUserId();
    const season = await seasonService.updateSeasonYear({
      seasonId: params.seasonId,
      actingUserId,
      year: Number(body.year)
    });

    return NextResponse.json<UpdateSeasonYearResponse>({ season });
  } catch (error) {
    if (error instanceof RouteAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }

    if (error instanceof SeasonServiceError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }

    return NextResponse.json({ error: "Unable to update season year." }, { status: 500 });
  }
}
