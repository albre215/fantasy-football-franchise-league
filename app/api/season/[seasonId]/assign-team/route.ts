import { NextResponse } from "next/server";

import { TeamOwnershipServiceError, teamOwnershipService } from "@/server/services/team-ownership-service";
import type { AssignTeamInput, AssignTeamResponse } from "@/types/team-ownership";

export const dynamic = "force-dynamic";

interface RouteContext {
  params: {
    seasonId: string;
  };
}

export async function POST(request: Request, { params }: RouteContext) {
  try {
    const body = (await request.json()) as Partial<AssignTeamInput>;
    const result = await teamOwnershipService.assignTeamToUser({
      seasonId: params.seasonId,
      userId: body.userId ?? "",
      nflTeamId: body.nflTeamId ?? ""
    });

    return NextResponse.json<AssignTeamResponse>(result, { status: 201 });
  } catch (error) {
    if (error instanceof TeamOwnershipServiceError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }

    return NextResponse.json({ error: "Unable to assign NFL team." }, { status: 500 });
  }
}
