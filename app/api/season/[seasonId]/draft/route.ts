import { NextResponse } from "next/server";

import { RouteAuthError, requireAuthenticatedUserId } from "@/lib/auth-session";
import { DraftServiceError, draftService } from "@/server/services/draft-service";
import type { DraftStateResponse, InitializeDraftInput, InitializeDraftResponse } from "@/types/draft";

export const dynamic = "force-dynamic";

interface RouteContext {
  params: {
    seasonId: string;
  };
}

export async function GET(_request: Request, { params }: RouteContext) {
  try {
    const draft = await draftService.getDraftStateByTargetSeason(params.seasonId);

    return NextResponse.json<DraftStateResponse>({ draft });
  } catch (error) {
    if (error instanceof DraftServiceError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }

    return NextResponse.json({ error: "Unable to load offseason draft." }, { status: 500 });
  }
}

export async function POST(request: Request, { params }: RouteContext) {
  try {
    const body = (await request.json()) as Partial<InitializeDraftInput>;
    const actingUserId = await requireAuthenticatedUserId();
    const draft = await draftService.initializeDraft({
      targetSeasonId: params.seasonId,
      sourceSeasonId: body.sourceSeasonId ?? "",
      actingUserId,
      orderLeagueMemberIds: body.orderLeagueMemberIds ?? []
    });

    return NextResponse.json<InitializeDraftResponse>({ draft }, { status: 201 });
  } catch (error) {
    if (error instanceof RouteAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }

    if (error instanceof DraftServiceError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }

    return NextResponse.json({ error: "Unable to initialize offseason draft." }, { status: 500 });
  }
}
