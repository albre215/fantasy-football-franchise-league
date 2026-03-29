import { NextResponse } from "next/server";

import { RouteAuthError, requireAuthenticatedUserId } from "@/lib/auth-session";
import { leagueService } from "@/server/services/league-service";
import type { ListLeaguesResponse } from "@/types/league";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const userId = await requireAuthenticatedUserId();
    const leagues = await leagueService.listLeaguesForUser(userId);

    return NextResponse.json<ListLeaguesResponse>({ leagues });
  } catch (error) {
    if (error instanceof RouteAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }

    return NextResponse.json({ error: "Unable to load your leagues." }, { status: 500 });
  }
}
