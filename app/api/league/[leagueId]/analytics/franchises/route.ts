import { NextResponse } from "next/server";

import { analyticsService, AnalyticsServiceError } from "@/server/services/analytics-service";
import type { FranchiseAnalyticsResponse } from "@/types/analytics";

export const dynamic = "force-dynamic";

interface RouteContext {
  params: {
    leagueId: string;
  };
}

export async function GET(_request: Request, { params }: RouteContext) {
  try {
    const franchiseAnalytics = await analyticsService.getFranchiseAnalytics(params.leagueId);
    return NextResponse.json<FranchiseAnalyticsResponse>({ franchiseAnalytics });
  } catch (error) {
    if (error instanceof AnalyticsServiceError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }

    return NextResponse.json({ error: "Unable to load franchise analytics." }, { status: 500 });
  }
}
