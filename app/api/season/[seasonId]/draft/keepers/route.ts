import { NextResponse } from "next/server";

import { RouteAuthError, requireAuthenticatedUserId } from "@/lib/auth-session";
import { DraftServiceError, draftService } from "@/server/services/draft-service";
import type { SaveKeepersInput, SaveKeepersResponse } from "@/types/draft";

export const dynamic = "force-dynamic";

interface RouteContext {
  params: {
    seasonId: string;
  };
}

export async function POST(request: Request, { params }: RouteContext) {
  try {
    const body = (await request.json()) as Partial<SaveKeepersInput>;
    const actingUserId = await requireAuthenticatedUserId();
    const draft = await draftService.saveKeepers({
      draftId: body.draftId ?? "",
      leagueMemberId: body.leagueMemberId ?? "",
      nflTeamIds: body.nflTeamIds ?? [],
      actingUserId
    });

    return NextResponse.json<SaveKeepersResponse>({ draft });
  } catch (error) {
    if (error instanceof RouteAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }

    if (error instanceof DraftServiceError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }

    return NextResponse.json({ error: `Unable to save keepers for season ${params.seasonId}.` }, { status: 500 });
  }
}
