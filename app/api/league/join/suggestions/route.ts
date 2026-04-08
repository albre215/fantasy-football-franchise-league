import { NextResponse } from "next/server";

import { requireAuthenticatedUserId, RouteAuthError } from "@/lib/auth-session";
import { LeagueServiceError, leagueService } from "@/server/services/league-service";
import type { JoinLeagueSuggestionsResponse } from "@/types/league";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const actingUserId = await requireAuthenticatedUserId();
    const { searchParams } = new URL(request.url);
    const query = searchParams.get("query") ?? "";
    const suggestions = await leagueService.getJoinLeagueSuggestions(actingUserId, query);

    return NextResponse.json<JoinLeagueSuggestionsResponse>({ suggestions });
  } catch (error) {
    if (error instanceof RouteAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }

    if (error instanceof LeagueServiceError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }

    return NextResponse.json({ error: "Unable to load league suggestions." }, { status: 500 });
  }
}
