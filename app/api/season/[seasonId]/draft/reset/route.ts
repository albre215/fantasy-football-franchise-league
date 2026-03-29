import { NextResponse } from "next/server";

import { requireAuthenticatedUserId, RouteAuthError } from "@/lib/auth-session";
import { DraftServiceError, draftService } from "@/server/services/draft-service";
import type { ResetDraftResponse } from "@/types/draft";

export const dynamic = "force-dynamic";

interface RouteContext {
  params: {
    seasonId: string;
  };
}

export async function POST(request: Request, { params }: RouteContext) {
  try {
    const body = (await request.json()) as {
      force?: boolean;
      confirmReset?: boolean;
    };
    const actingUserId = await requireAuthenticatedUserId();

    if (body.confirmReset !== true) {
      return NextResponse.json({ error: "Draft reset must be explicitly confirmed." }, { status: 400 });
    }

    const result = await draftService.resetDraft({
      targetSeasonId: params.seasonId,
      actingUserId,
      force: body.force === true
    });

    return NextResponse.json<ResetDraftResponse>(result);
  } catch (error) {
    if (error instanceof RouteAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }

    if (error instanceof DraftServiceError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }

    return NextResponse.json({ error: "Unable to reset offseason draft." }, { status: 500 });
  }
}
