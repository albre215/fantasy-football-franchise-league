import { NextResponse } from "next/server";

import { requireAuthenticatedUserId, RouteAuthError } from "@/lib/auth-session";
import { ownerService, OwnerServiceError } from "@/server/services/owner-service";
import type { OwnerSeasonResponse } from "@/types/owner";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(
  _request: Request,
  { params }: { params: { seasonId: string } }
) {
  try {
    const actingUserId = await requireAuthenticatedUserId();
    const season = await ownerService.getOwnerSeasonContext(actingUserId, params.seasonId);

    return NextResponse.json<OwnerSeasonResponse>({ season });
  } catch (error) {
    if (error instanceof RouteAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }

    if (error instanceof OwnerServiceError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }

    return NextResponse.json({ error: "Unable to load owner season details." }, { status: 500 });
  }
}
