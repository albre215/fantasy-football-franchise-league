import { NextResponse } from "next/server";

import { requireAuthenticatedUserId, RouteAuthError } from "@/lib/auth-session";
import { ledgerService, LedgerServiceError } from "@/server/services/ledger-service";
import type { LeagueMemberSeasonLedgerResponse } from "@/types/ledger";

export const dynamic = "force-dynamic";

interface RouteContext {
  params: {
    seasonId: string;
    leagueMemberId: string;
  };
}

export async function GET(_request: Request, { params }: RouteContext) {
  try {
    const actingUserId = await requireAuthenticatedUserId();
    const ledger = await ledgerService.getLeagueMemberSeasonLedger(
      params.seasonId,
      params.leagueMemberId,
      actingUserId
    );

    return NextResponse.json<LeagueMemberSeasonLedgerResponse>({ ledger });
  } catch (error) {
    if (error instanceof RouteAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }

    if (error instanceof LedgerServiceError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }

    return NextResponse.json({ error: "Unable to load league member ledger." }, { status: 500 });
  }
}
