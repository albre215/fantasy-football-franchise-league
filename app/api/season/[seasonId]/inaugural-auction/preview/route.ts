import { NextResponse } from "next/server";

import { RouteAuthError, requireAuthenticatedUserId } from "@/lib/auth-session";
import {
  inauguralAuctionService,
  InauguralAuctionServiceError
} from "@/server/services/inaugural-auction-service";
import type {
  ConfigureInauguralAuctionInput,
  InauguralAuctionOrderPreviewResponse
} from "@/types/inaugural-auction";

export const dynamic = "force-dynamic";

interface RouteContext {
  params: {
    seasonId: string;
  };
}

export async function POST(request: Request, { params }: RouteContext) {
  try {
    const actingUserId = await requireAuthenticatedUserId();
    const body = (await request.json()) as Partial<ConfigureInauguralAuctionInput>;
    const preview = await inauguralAuctionService.previewAuctionOrder({
      seasonId: params.seasonId,
      actingUserId,
      orderMethod: body.orderMethod ?? "ALPHABETICAL",
      divisionOrder: body.divisionOrder ?? [],
      customTeamOrder: body.customTeamOrder ?? [],
      previousYearSortDirection: body.previousYearSortDirection
    });

    return NextResponse.json<InauguralAuctionOrderPreviewResponse>({ preview });
  } catch (error) {
    if (error instanceof RouteAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }

    if (error instanceof InauguralAuctionServiceError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }

    return NextResponse.json({ error: "Unable to preview the inaugural auction order." }, { status: 500 });
  }
}
