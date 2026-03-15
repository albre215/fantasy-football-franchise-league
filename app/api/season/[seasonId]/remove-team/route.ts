import { NextResponse } from "next/server";

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
    const result = await teamOwnershipService.removeTeamOwnership({
      seasonId: params.seasonId,
      teamOwnershipId: body.teamOwnershipId ?? "",
      actingUserId: body.actingUserId ?? ""
    });

    return NextResponse.json<RemoveTeamOwnershipResponse>(result);
  } catch (error) {
    if (error instanceof TeamOwnershipServiceError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }

    return NextResponse.json({ error: "Unable to remove team ownership." }, { status: 500 });
  }
}
