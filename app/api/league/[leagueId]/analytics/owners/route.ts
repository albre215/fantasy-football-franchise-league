import { NextResponse } from "next/server";

import { analyticsService, AnalyticsServiceError } from "@/server/services/analytics-service";
import type { OwnerAnalyticsResponse } from "@/types/analytics";

export const dynamic = "force-dynamic";

interface RouteContext {
  params: {
    leagueId: string;
  };
}

export async function GET(_request: Request, { params }: RouteContext) {
  try {
    const ownerAnalytics = await analyticsService.getOwnerAnalytics(params.leagueId);
    return NextResponse.json<OwnerAnalyticsResponse>({ ownerAnalytics });
  } catch (error) {
    if (error instanceof AnalyticsServiceError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }

    return NextResponse.json({ error: "Unable to load owner analytics." }, { status: 500 });
  }
}
