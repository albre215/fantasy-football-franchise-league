import { NextResponse } from "next/server";

import { SeasonServiceError, seasonService } from "@/server/services/season-service";
import type { LockSeasonResponse } from "@/types/season";

export const dynamic = "force-dynamic";

interface RouteContext {
  params: {
    seasonId: string;
  };
}

export async function POST(_request: Request, { params }: RouteContext) {
  try {
    const result = await seasonService.lockSeason(params.seasonId);

    return NextResponse.json<LockSeasonResponse>(result);
  } catch (error) {
    if (error instanceof SeasonServiceError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }

    return NextResponse.json({ error: "Unable to lock season." }, { status: 500 });
  }
}
