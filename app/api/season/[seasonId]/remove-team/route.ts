import { NextResponse } from "next/server";

import { requireAuthenticatedUserId, RouteAuthError } from "@/lib/auth-session";
import { TeamOwnershipServiceError, teamOwnershipService } from "@/server/services/team-ownership-service";
import type { RemoveTeamOwnershipInput, RemoveTeamOwnershipResponse } from "@/types/team-ownership";

export const dynamic = "force-dynamic";

interface RouteContext {
  params: {
    seasonId: string;
  };
}

export async function POST(request: Request, { params }: RouteContext) {
  try {
    const body = (await request.json()) as Partial<RemoveTeamOwnershipInput>;
    const actingUserId = await requireAuthenticatedUserId();
    const result = await teamOwnershipService.removeTeamOwnership({
      seasonId: params.seasonId,
      teamOwnershipId: body.teamOwnershipId ?? "",
      actingUserId
    });

    return NextResponse.json<RemoveTeamOwnershipResponse>(result);
  } catch (error) {
    if (error instanceof RouteAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }

    if (error instanceof TeamOwnershipServiceError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }

    return NextResponse.json({ error: "Unable to remove team ownership." }, { status: 500 });
  }
}
