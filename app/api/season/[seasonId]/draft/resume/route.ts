import { NextResponse } from "next/server";

import { DraftServiceError, draftService } from "@/server/services/draft-service";
import type { ResumeDraftResponse, StartDraftInput } from "@/types/draft";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Partial<StartDraftInput>;
    const draft = await draftService.resumeDraft({
      draftId: body.draftId ?? "",
      actingUserId: body.actingUserId ?? ""
    });

    return NextResponse.json<ResumeDraftResponse>({ draft });
  } catch (error) {
    if (error instanceof DraftServiceError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }

    return NextResponse.json({ error: "Unable to resume offseason draft." }, { status: 500 });
  }
}
