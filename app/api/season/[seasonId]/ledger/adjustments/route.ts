import { NextResponse } from "next/server";

import { requireAuthenticatedUserId, RouteAuthError } from "@/lib/auth-session";
import { ledgerService, LedgerServiceError } from "@/server/services/ledger-service";
import type { CreateManualAdjustmentInput, CreateManualAdjustmentResponse } from "@/types/ledger";

export const dynamic = "force-dynamic";

interface RouteContext {
  params: {
    seasonId: string;
  };
}

export async function POST(request: Request, { params }: RouteContext) {
  try {
    const body = (await request.json()) as Partial<CreateManualAdjustmentInput>;
    const actingUserId = await requireAuthenticatedUserId();

    const result = await ledgerService.createManualAdjustment({
      seasonId: params.seasonId,
      leagueMemberId: body.leagueMemberId ?? "",
      amount: typeof body.amount === "number" ? body.amount : Number(body.amount),
      description: body.description ?? "",
      actingUserId,
      metadata: body.metadata ?? null
    });

    return NextResponse.json<CreateManualAdjustmentResponse>(result, { status: 201 });
  } catch (error) {
    if (error instanceof RouteAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }

    if (error instanceof LedgerServiceError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }

    return NextResponse.json({ error: "Unable to create manual adjustment." }, { status: 500 });
  }
}
