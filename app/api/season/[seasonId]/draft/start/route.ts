import { NextResponse } from "next/server";

import { RouteAuthError, requireAuthenticatedUserId } from "@/lib/auth-session";
import { DraftServiceError, draftService } from "@/server/services/draft-service";
import type { StartDraftInput, StartDraftResponse } from "@/types/draft";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Partial<StartDraftInput>;
    const actingUserId = await requireAuthenticatedUserId();
    const draft = await draftService.startDraft({
      draftId: body.draftId ?? "",
      actingUserId
    });

    return NextResponse.json<StartDraftResponse>({ draft });
  } catch (error) {
    if (error instanceof RouteAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }

    if (error instanceof DraftServiceError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }

    return NextResponse.json({ error: "Unable to start offseason draft." }, { status: 500 });
  }
}
