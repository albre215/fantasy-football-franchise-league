import { NextResponse } from "next/server";

import { LeagueServiceError, leagueService } from "@/server/services/league-service";
import type { AddLeagueMemberInput, AddLeagueMemberResponse } from "@/types/league";

export const dynamic = "force-dynamic";

interface RouteContext {
  params: {
    leagueId: string;
  };
}

export async function POST(request: Request, { params }: RouteContext) {
  try {
    const body = (await request.json()) as Partial<AddLeagueMemberInput>;
    const member = await leagueService.addLeagueMember({
      leagueId: params.leagueId,
      displayName: body.displayName ?? "",
      email: body.email ?? "",
      mockUserKey: body.mockUserKey
    });

    return NextResponse.json<AddLeagueMemberResponse>({ member }, { status: 201 });
  } catch (error) {
    if (error instanceof LeagueServiceError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }

    return NextResponse.json({ error: "Unable to add league member." }, { status: 500 });
  }
}
