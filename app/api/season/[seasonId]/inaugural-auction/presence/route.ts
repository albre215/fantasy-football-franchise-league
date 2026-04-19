import { NextResponse } from "next/server";

import { RouteAuthError, requireAuthenticatedUserId } from "@/lib/auth-session";
import {
  DraftPresenceServiceError,
  draftPresenceService
} from "@/server/services/draft-presence-service";

export const dynamic = "force-dynamic";

interface RouteContext {
  params: { seasonId: string };
}

export async function GET(_request: Request, { params }: RouteContext) {
  try {
    await requireAuthenticatedUserId();
    const presentMemberIds = await draftPresenceService.listPresentMemberIdsBySeason(params.seasonId);
    return NextResponse.json({ presentMemberIds });
  } catch (error) {
    if (error instanceof RouteAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json({ error: "Unable to load presence." }, { status: 500 });
  }
}

export async function POST(_request: Request, { params }: RouteContext) {
  try {
    const actingUserId = await requireAuthenticatedUserId();
    const presentMemberIds = await draftPresenceService.join(params.seasonId, actingUserId);
    return NextResponse.json({ presentMemberIds });
  } catch (error) {
    if (error instanceof RouteAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    if (error instanceof DraftPresenceServiceError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json({ error: "Unable to join the draft lobby." }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  try {
    const actingUserId = await requireAuthenticatedUserId();
    const presentMemberIds = await draftPresenceService.leave(params.seasonId, actingUserId);
    return NextResponse.json({ presentMemberIds });
  } catch (error) {
    if (error instanceof RouteAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    if (error instanceof DraftPresenceServiceError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json({ error: "Unable to leave the draft lobby." }, { status: 500 });
  }
}
