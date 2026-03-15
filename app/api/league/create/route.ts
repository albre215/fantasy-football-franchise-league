import { NextResponse } from "next/server";

import { LeagueServiceError, leagueService } from "@/server/services/league-service";
import type { CreateLeagueInput, CreateLeagueResponse } from "@/types/league";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Partial<CreateLeagueInput>;
    const league = await leagueService.createLeague({
      userId: body.userId ?? "",
      name: body.name ?? "",
      description: body.description
    });

    return NextResponse.json<CreateLeagueResponse>({ league }, { status: 201 });
  } catch (error) {
    if (error instanceof LeagueServiceError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }

    return NextResponse.json({ error: "Unable to create league." }, { status: 500 });
  }
}
