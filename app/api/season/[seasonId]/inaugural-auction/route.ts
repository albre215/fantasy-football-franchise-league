import { NextResponse } from "next/server";

import { RouteAuthError, requireAuthenticatedUserId } from "@/lib/auth-session";
import {
  inauguralAuctionService,
  InauguralAuctionServiceError
} from "@/server/services/inaugural-auction-service";
import type {
  ConfigureInauguralAuctionInput,
  ConfigureInauguralAuctionResponse,
  InauguralAuctionStateResponse
} from "@/types/inaugural-auction";

export const dynamic = "force-dynamic";

interface RouteContext {
  params: {
    seasonId: string;
  };
}

export async function GET(_request: Request, { params }: RouteContext) {
  try {
    const actingUserId = await requireAuthenticatedUserId();
    const auction = await inauguralAuctionService.getAuctionStateBySeason(params.seasonId, actingUserId);

    return NextResponse.json<InauguralAuctionStateResponse>({ auction });
  } catch (error) {
    if (error instanceof RouteAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }

    if (error instanceof InauguralAuctionServiceError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }

    return NextResponse.json({ error: "Unable to load the inaugural auction." }, { status: 500 });
  }
}

export async function POST(request: Request, { params }: RouteContext) {
  try {
    const actingUserId = await requireAuthenticatedUserId();
    const body = (await request.json()) as Partial<ConfigureInauguralAuctionInput>;
    const auction = await inauguralAuctionService.configureAuction({
      seasonId: params.seasonId,
      actingUserId,
      orderMethod: body.orderMethod ?? "ALPHABETICAL",
      divisionOrder: body.divisionOrder ?? []
    });

    return NextResponse.json<ConfigureInauguralAuctionResponse>({ auction }, { status: 201 });
  } catch (error) {
    if (error instanceof RouteAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }

    if (error instanceof InauguralAuctionServiceError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }

    return NextResponse.json({ error: "Unable to configure the inaugural auction." }, { status: 500 });
  }
}
