import { NextResponse } from "next/server";

import { SeasonServiceError, seasonService } from "@/server/services/season-service";
import type { SeasonSetupStatusResponse } from "@/types/season";

export const dynamic = "force-dynamic";

interface RouteContext {
  params: {
    seasonId: string;
  };
}

export async function GET(_request: Request, { params }: RouteContext) {
  try {
    const status = await seasonService.getSeasonSetupStatus(params.seasonId);

    return NextResponse.json<SeasonSetupStatusResponse>({ status });
  } catch (error) {
    if (error instanceof SeasonServiceError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }

    return NextResponse.json({ error: "Unable to load season setup status." }, { status: 500 });
  }
}
