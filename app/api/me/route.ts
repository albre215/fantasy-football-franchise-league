import { NextResponse } from "next/server";

import { requireAuthenticatedUserId, RouteAuthError } from "@/lib/auth-session";
import { OwnerServiceError, ownerService } from "@/server/services/owner-service";
import type { OwnerDashboardResponse } from "@/types/owner";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const actingUserId = await requireAuthenticatedUserId();
    const dashboard = await ownerService.getOwnerDashboard(actingUserId);

    return NextResponse.json<OwnerDashboardResponse>(dashboard);
  } catch (error) {
    if (error instanceof RouteAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }

    if (error instanceof OwnerServiceError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }

    return NextResponse.json({ error: "Unable to load owner dashboard." }, { status: 500 });
  }
}
