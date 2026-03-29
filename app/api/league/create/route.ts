import { NextResponse } from "next/server";

import { requireAuthenticatedUserId, RouteAuthError } from "@/lib/auth-session";
import { getLeagueCodeSchemaHelpMessage } from "@/lib/database-errors";
import { LeagueServiceError, leagueService } from "@/server/services/league-service";
import type { CreateLeagueInput, CreateLeagueResponse } from "@/types/league";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Partial<CreateLeagueInput>;
    const actingUserId = await requireAuthenticatedUserId();
    const league = await leagueService.createLeague({
      userId: actingUserId,
      name: body.name ?? "",
      description: body.description
    });

    return NextResponse.json<CreateLeagueResponse>({ league }, { status: 201 });
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

    return NextResponse.json({ error: "Unable to create league." }, { status: 500 });
  }
}
