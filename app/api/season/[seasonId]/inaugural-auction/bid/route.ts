import { NextResponse } from "next/server";

import { RouteAuthError, requireAuthenticatedUserId } from "@/lib/auth-session";
import {
  inauguralAuctionService,
  InauguralAuctionServiceError
} from "@/server/services/inaugural-auction-service";
import type { SubmitInauguralBidInput, SubmitInauguralBidResponse } from "@/types/inaugural-auction";

export const dynamic = "force-dynamic";

interface RouteContext {
  params: {
    seasonId: string;
  };
}

export async function POST(request: Request, { params }: RouteContext) {
  try {
    const actingUserId = await requireAuthenticatedUserId();
    const body = (await request.json()) as Partial<SubmitInauguralBidInput>;
    const auction = await inauguralAuctionService.submitBid({
      seasonId: params.seasonId,
      actingUserId,
      amount: Number(body.amount ?? 0)
    });

    return NextResponse.json<SubmitInauguralBidResponse>({ auction });
  } catch (error) {
    if (error instanceof RouteAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }

    if (error instanceof InauguralAuctionServiceError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }

    return NextResponse.json({ error: "Unable to submit the inaugural auction bid." }, { status: 500 });
  }
}
