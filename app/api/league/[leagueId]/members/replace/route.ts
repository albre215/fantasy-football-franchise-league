import { NextResponse } from "next/server";

import { requireAuthenticatedUserId, RouteAuthError } from "@/lib/auth-session";
import { LeagueServiceError, leagueService } from "@/server/services/league-service";
import type { ReplaceLeagueMemberInput, ReplaceLeagueMemberResponse } from "@/types/league";

export const dynamic = "force-dynamic";

interface RouteContext {
  params: {
    leagueId: string;
  };
}

export async function POST(request: Request, { params }: RouteContext) {
  try {
    const body = (await request.json()) as Partial<ReplaceLeagueMemberInput>;
    const actingUserId = await requireAuthenticatedUserId();
    const member = await leagueService.replaceLeagueMember({
      leagueId: params.leagueId,
      leagueMemberId: body.leagueMemberId ?? "",
      displayName: body.displayName ?? "",
      email: body.email ?? "",
      actingUserId,
      mockUserKey: body.mockUserKey
    });

    return NextResponse.json<ReplaceLeagueMemberResponse>({ member });
  } catch (error) {
    if (error instanceof RouteAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }

    if (error instanceof LeagueServiceError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }

    return NextResponse.json({ error: "Unable to replace league member." }, { status: 500 });
  }
}
