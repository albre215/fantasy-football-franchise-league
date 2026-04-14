import { NextResponse } from "next/server";

import { requireAuthenticatedUserId, RouteAuthError } from "@/lib/auth-session";
import { seasonActivationService } from "@/server/services/season-activation-service";
import { SeasonServiceError } from "@/server/services/season-service";
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
    const actingUserId = await requireAuthenticatedUserId();
    const result = await seasonActivationService.createSeasonAndSyncNflResults({
      leagueId: params.leagueId,
      year: Number(body.year),
      name: body.name,
      actingUserId
    });

    return NextResponse.json<CreateSeasonResponse>(result, { status: 201 });
  } catch (error) {
    if (error instanceof RouteAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }

    if (error instanceof SeasonServiceError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }

    return NextResponse.json({ error: "Unable to create season." }, { status: 500 });
  }
}
