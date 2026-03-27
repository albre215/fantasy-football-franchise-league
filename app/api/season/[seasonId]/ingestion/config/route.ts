import { NextResponse } from "next/server";

import { ingestionService, IngestionServiceError } from "@/server/services/ingestion-service";
import type {
  SaveSeasonSourceConfigInput,
  SaveSeasonSourceConfigResponse,
  SeasonSourceConfigResponse
} from "@/types/ingestion";

export const dynamic = "force-dynamic";

interface RouteContext {
  params: {
    seasonId: string;
  };
}

export async function GET(_request: Request, { params }: RouteContext) {
  try {
    const configs = await ingestionService.getSeasonSourceConfigs(params.seasonId);

    return NextResponse.json<SeasonSourceConfigResponse>({ configs });
  } catch (error) {
    if (error instanceof IngestionServiceError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }

    return NextResponse.json({ error: "Unable to load season source configuration." }, { status: 500 });
  }
}

export async function POST(request: Request, { params }: RouteContext) {
  try {
    const body = (await request.json()) as Partial<SaveSeasonSourceConfigInput>;
    const config = await ingestionService.saveSeasonSourceConfig({
      seasonId: params.seasonId,
      provider: body.provider ?? "CSV",
      externalLeagueId: body.externalLeagueId,
      externalSeasonKey: body.externalSeasonKey,
      config: body.config ?? {},
      actingUserId: body.actingUserId ?? ""
    });

    return NextResponse.json<SaveSeasonSourceConfigResponse>({ config });
  } catch (error) {
    if (error instanceof IngestionServiceError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }

    return NextResponse.json({ error: "Unable to save season source configuration." }, { status: 500 });
  }
}
