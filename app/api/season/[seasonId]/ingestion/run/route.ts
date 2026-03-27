import { NextResponse } from "next/server";

import { ingestionService, IngestionServiceError } from "@/server/services/ingestion-service";
import type { RunIngestionInput, RunIngestionResponse } from "@/types/ingestion";

export const dynamic = "force-dynamic";

interface RouteContext {
  params: {
    seasonId: string;
  };
}

export async function POST(request: Request, { params }: RouteContext) {
  try {
    const body = (await request.json()) as Partial<RunIngestionInput>;
    const result = await ingestionService.runImport({
      seasonId: params.seasonId,
      provider: body.provider ?? "CSV",
      importType: body.importType ?? "SEASON_STANDINGS",
      weekNumber: body.weekNumber,
      csvContent: body.csvContent,
      externalLeagueId: body.externalLeagueId,
      externalSeasonKey: body.externalSeasonKey,
      config: body.config ?? {},
      actingUserId: body.actingUserId ?? "",
      mappingOverrides: body.mappingOverrides ?? {}
    });

    return NextResponse.json<RunIngestionResponse>(result);
  } catch (error) {
    if (error instanceof IngestionServiceError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }

    return NextResponse.json({ error: "Unable to run results import." }, { status: 500 });
  }
}
