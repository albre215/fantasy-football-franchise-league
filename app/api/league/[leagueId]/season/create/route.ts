import { NextResponse } from "next/server";

import { SeasonServiceError, seasonService } from "@/server/services/season-service";
import type { CreateSeasonInput, CreateSeasonResponse } from "@/types/season";

export const dynamic = "force-dynamic";

interface RouteContext {
  params: {
    leagueId: string;
  };
}

export async function POST(request: Request, { params }: RouteContext) {
  try {
    const body = (await request.json()) as Partial<CreateSeasonInput>;
    const season = await seasonService.createSeason({
      leagueId: params.leagueId,
      year: Number(body.year),
      name: body.name
    });

    return NextResponse.json<CreateSeasonResponse>({ season }, { status: 201 });
  } catch (error) {
    if (error instanceof SeasonServiceError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }

    return NextResponse.json({ error: "Unable to create season." }, { status: 500 });
  }
}
