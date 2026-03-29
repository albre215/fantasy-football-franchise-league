import { NextResponse } from "next/server";

import { requireAuthenticatedUserId, RouteAuthError } from "@/lib/auth-session";
import { DraftServiceError, draftService } from "@/server/services/draft-service";
import type { OverrideDraftOrderResponse } from "@/types/draft";

export const dynamic = "force-dynamic";

interface RouteContext {
  params: {
    seasonId: string;
  };
}

export async function POST(request: Request, { params }: RouteContext) {
  try {
    const body = (await request.json()) as {
      orderLeagueMemberIds?: string[];
      confirmOverride?: boolean;
    };
    const actingUserId = await requireAuthenticatedUserId();

    if (body.confirmOverride !== true) {
      return NextResponse.json({ error: "Draft order override must be explicitly confirmed." }, { status: 400 });
    }

    const draft = await draftService.overrideDraftOrder({
      targetSeasonId: params.seasonId,
      actingUserId,
      orderLeagueMemberIds: Array.isArray(body.orderLeagueMemberIds) ? body.orderLeagueMemberIds : []
    });

    return NextResponse.json<OverrideDraftOrderResponse>({ draft });
  } catch (error) {
    if (error instanceof RouteAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }

    if (error instanceof DraftServiceError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }

    return NextResponse.json({ error: "Unable to override draft order." }, { status: 500 });
  }
}
