import { NextResponse } from "next/server";

import { requireAuthenticatedUserId, RouteAuthError } from "@/lib/auth-session";
import { NflPerformanceServiceError, nflPerformanceService } from "@/server/services/nfl-performance-service";
import type {
  PostSeasonNflResultsToLedgerResponse,
  SeasonNflLedgerPostingPreviewResponse
} from "@/types/nfl-performance";

export const dynamic = "force-dynamic";

interface RouteContext {
  params: {
    seasonId: string;
  };
}

export async function GET(_request: Request, { params }: RouteContext) {
  try {
    const actingUserId = await requireAuthenticatedUserId();
    const nflLedger = await nflPerformanceService.getSeasonNflLedgerPostingPreview(params.seasonId, actingUserId);

    return NextResponse.json<SeasonNflLedgerPostingPreviewResponse>({ nflLedger });
  } catch (error) {
    if (error instanceof RouteAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }

    if (error instanceof NflPerformanceServiceError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }

    return NextResponse.json({ error: "Unable to load NFL ledger posting status." }, { status: 500 });
  }
}

export async function POST(_request: Request, { params }: RouteContext) {
  try {
    const actingUserId = await requireAuthenticatedUserId();
    const nflLedger = await nflPerformanceService.postSeasonNflResultsToLedger(params.seasonId, actingUserId);

    return NextResponse.json<PostSeasonNflResultsToLedgerResponse>({ nflLedger });
  } catch (error) {
    if (error instanceof RouteAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }

    if (error instanceof NflPerformanceServiceError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }

    return NextResponse.json({ error: "Unable to post NFL results into the ledger." }, { status: 500 });
  }
}
