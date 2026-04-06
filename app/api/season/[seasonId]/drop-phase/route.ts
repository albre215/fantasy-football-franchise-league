import { NextResponse } from "next/server";

import { requireAuthenticatedUserId, RouteAuthError } from "@/lib/auth-session";
import { dropPhaseService, DropPhaseServiceError } from "@/server/services/drop-phase-service";
import type { DropPhaseContextResponse } from "@/types/draft";

export const dynamic = "force-dynamic";

interface RouteContext {
  params: {
    seasonId: string;
  };
}

export async function GET(_request: Request, { params }: RouteContext) {
  try {
    await requireAuthenticatedUserId();
    const dropPhase = await dropPhaseService.getDropPhaseContext(params.seasonId);

    return NextResponse.json<DropPhaseContextResponse>({ dropPhase });
  } catch (error) {
    if (error instanceof RouteAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }

    if (error instanceof DropPhaseServiceError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }

    return NextResponse.json({ error: "Unable to load drop-phase context." }, { status: 500 });
  }
}
