import { NextResponse } from "next/server";

import { RouteAuthError, requireAuthenticatedUserId } from "@/lib/auth-session";
import {
  inauguralAuctionService,
  InauguralAuctionServiceError
} from "@/server/services/inaugural-auction-service";
import type { StartInauguralAuctionResponse } from "@/types/inaugural-auction";

export const dynamic = "force-dynamic";

interface RouteContext {
  params: {
    seasonId: string;
  };
}

export async function POST(_request: Request, { params }: RouteContext) {
  try {
    const actingUserId = await requireAuthenticatedUserId();
    const auction = await inauguralAuctionService.resumeAuction({
      seasonId: params.seasonId,
      actingUserId
    });
    return NextResponse.json<StartInauguralAuctionResponse>({ auction });
  } catch (error) {
    if (error instanceof RouteAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    if (error instanceof InauguralAuctionServiceError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json({ error: "Unable to resume the inaugural auction." }, { status: 500 });
  }
}
