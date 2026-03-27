import { NextResponse } from "next/server";

import { ingestionService, IngestionServiceError } from "@/server/services/ingestion-service";
import type { PreviewIngestionInput, PreviewIngestionResponse } from "@/types/ingestion";

export const dynamic = "force-dynamic";

interface RouteContext {
  params: {
    seasonId: string;
  };
}

export async function POST(request: Request, { params }: RouteContext) {
  try {
    const body = (await request.json()) as Partial<PreviewIngestionInput>;
    const preview = await ingestionService.previewImport({
      seasonId: params.seasonId,
      provider: body.provider ?? "CSV",
      importType: body.importType ?? "SEASON_STANDINGS",
      weekNumber: body.weekNumber,
      csvContent: body.csvContent,
      externalLeagueId: body.externalLeagueId,
      externalSeasonKey: body.externalSeasonKey,
      config: body.config ?? {}
    });

    return NextResponse.json<PreviewIngestionResponse>({ preview });
  } catch (error) {
    if (error instanceof IngestionServiceError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }

    return NextResponse.json({ error: "Unable to preview results import." }, { status: 500 });
  }
}
