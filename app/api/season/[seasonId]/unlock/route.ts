import { NextResponse } from "next/server";

import { SeasonServiceError, seasonService } from "@/server/services/season-service";
import type { SeasonActorInput, UnlockSeasonResponse } from "@/types/season";

export const dynamic = "force-dynamic";

interface RouteContext {
  params: {
    seasonId: string;
  };
}

export async function POST(request: Request, { params }: RouteContext) {
  try {
    const body = (await request.json()) as Partial<SeasonActorInput>;
    const season = await seasonService.unlockSeason({
      seasonId: params.seasonId,
      actingUserId: body.actingUserId ?? ""
    });

    return NextResponse.json<UnlockSeasonResponse>({ season });
  } catch (error) {
    if (error instanceof SeasonServiceError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }

    return NextResponse.json({ error: "Unable to unlock season." }, { status: 500 });
  }
}
