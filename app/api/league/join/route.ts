import { NextResponse } from "next/server";

import { requireAuthenticatedUserId, RouteAuthError } from "@/lib/auth-session";
import { getLeagueCodeSchemaHelpMessage } from "@/lib/database-errors";
import { LeagueServiceError, leagueService } from "@/server/services/league-service";
import type { JoinLeagueInput, JoinLeagueResponse } from "@/types/league";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Partial<JoinLeagueInput>;
    const actingUserId = await requireAuthenticatedUserId();
    const league = await leagueService.joinLeague({
      userId: actingUserId,
      leagueCode: body.leagueCode ?? ""
    });

    return NextResponse.json<JoinLeagueResponse>({ league });
  } catch (error) {
    if (error instanceof RouteAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }

    if (error instanceof LeagueServiceError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }

    const schemaHelpMessage = getLeagueCodeSchemaHelpMessage(error);
    if (schemaHelpMessage) {
      return NextResponse.json({ error: schemaHelpMessage }, { status: 503 });
    }

    return NextResponse.json({ error: "Unable to join league." }, { status: 500 });
  }
}
