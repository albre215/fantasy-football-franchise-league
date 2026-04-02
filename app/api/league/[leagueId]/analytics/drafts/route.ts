import { NextResponse } from "next/server";

import { analyticsService, AnalyticsServiceError } from "@/server/services/analytics-service";
import type { DraftAnalyticsResponse } from "@/types/analytics";

export const dynamic = "force-dynamic";

interface RouteContext {
  params: {
    leagueId: string;
  };
}

export async function GET(_request: Request, { params }: RouteContext) {
  try {
    const draftAnalytics = await analyticsService.getDraftAnalytics(params.leagueId);
    return NextResponse.json<DraftAnalyticsResponse>({ draftAnalytics });
  } catch (error) {
    if (error instanceof AnalyticsServiceError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }

    return NextResponse.json({ error: "Unable to load draft analytics." }, { status: 500 });
  }
}
