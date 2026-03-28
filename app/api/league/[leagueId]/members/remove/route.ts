import { NextResponse } from "next/server";

import { requireAuthenticatedUserId, RouteAuthError } from "@/lib/auth-session";
import { LeagueServiceError, leagueService } from "@/server/services/league-service";
import type { RemoveLeagueMemberInput, RemoveLeagueMemberResponse } from "@/types/league";

export const dynamic = "force-dynamic";

interface RouteContext {
  params: {
    leagueId: string;
  };
}

export async function POST(request: Request, { params }: RouteContext) {
  try {
    const body = (await request.json()) as Partial<RemoveLeagueMemberInput>;
    const actingUserId = await requireAuthenticatedUserId();
    const result = await leagueService.removeLeagueMember({
      leagueId: params.leagueId,
      leagueMemberId: body.leagueMemberId ?? "",
      actingUserId
    });

    return NextResponse.json<RemoveLeagueMemberResponse>(result);
  } catch (error) {
    if (error instanceof RouteAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }

    if (error instanceof LeagueServiceError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }

    return NextResponse.json({ error: "Unable to remove league member." }, { status: 500 });
  }
}
