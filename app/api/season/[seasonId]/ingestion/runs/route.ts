import { NextResponse } from "next/server";

import { ingestionService, IngestionServiceError } from "@/server/services/ingestion-service";
import type { IngestionRunListResponse } from "@/types/ingestion";

export const dynamic = "force-dynamic";

interface RouteContext {
  params: {
    seasonId: string;
  };
}

export async function GET(_request: Request, { params }: RouteContext) {
  try {
    const runs = await ingestionService.listIngestionRuns(params.seasonId);

    return NextResponse.json<IngestionRunListResponse>({ runs });
  } catch (error) {
    if (error instanceof IngestionServiceError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }

    return NextResponse.json({ error: "Unable to load ingestion runs." }, { status: 500 });
  }
}
