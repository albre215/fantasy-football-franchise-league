import { NextResponse } from "next/server";

import { LeagueServiceError, leagueService } from "@/server/services/league-service";
import type { JoinLeagueInput, JoinLeagueResponse } from "@/types/league";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Partial<JoinLeagueInput>;
    const league = await leagueService.joinLeague({
      userId: body.userId ?? "",
      leagueId: body.leagueId ?? ""
    });

    return NextResponse.json<JoinLeagueResponse>({ league });
  } catch (error) {
    if (error instanceof LeagueServiceError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }

    return NextResponse.json({ error: "Unable to join league." }, { status: 500 });
  }
}
