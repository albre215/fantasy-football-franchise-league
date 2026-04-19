import { NextResponse } from "next/server";
import { DraftType } from "@prisma/client";

import { RouteAuthError, requireAuthenticatedUserId } from "@/lib/auth-session";
import {
  DraftScheduleServiceError,
  draftScheduleService,
  type DraftScheduleSummary
} from "@/server/services/draft-schedule-service";

export const dynamic = "force-dynamic";

interface RouteContext {
  params: { seasonId: string };
}

interface ScheduleBody {
  scheduledAt?: string;
  timezone?: string;
  draftType?: DraftType;
}

function isDraftType(value: unknown): value is DraftType {
  return value === "INAUGURAL" || value === "KEEPER" || value === "OFFSEASON";
}

export async function GET(_request: Request, { params }: RouteContext) {
  try {
    await requireAuthenticatedUserId();
    const schedule = await draftScheduleService.getBySeason(params.seasonId);
    return NextResponse.json<{ schedule: DraftScheduleSummary | null }>({ schedule });
  } catch (error) {
    if (error instanceof RouteAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json({ error: "Unable to load the draft schedule." }, { status: 500 });
  }
}

export async function PUT(request: Request, { params }: RouteContext) {
  try {
    const actingUserId = await requireAuthenticatedUserId();
    const body = (await request.json()) as ScheduleBody;

    if (!body.scheduledAt) {
      return NextResponse.json({ error: "scheduledAt is required." }, { status: 400 });
    }
    if (!body.timezone) {
      return NextResponse.json({ error: "timezone is required." }, { status: 400 });
    }
    if (!isDraftType(body.draftType)) {
      return NextResponse.json({ error: "draftType must be INAUGURAL, KEEPER, or OFFSEASON." }, { status: 400 });
    }

    const schedule = await draftScheduleService.upsert({
      seasonId: params.seasonId,
      actingUserId,
      draftType: body.draftType,
      scheduledAt: new Date(body.scheduledAt),
      timezone: body.timezone
    });

    return NextResponse.json<{ schedule: DraftScheduleSummary }>({ schedule });
  } catch (error) {
    if (error instanceof RouteAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    if (error instanceof DraftScheduleServiceError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json({ error: "Unable to save the draft schedule." }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  try {
    const actingUserId = await requireAuthenticatedUserId();
    await draftScheduleService.clear(params.seasonId, actingUserId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof RouteAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    if (error instanceof DraftScheduleServiceError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json({ error: "Unable to clear the draft schedule." }, { status: 500 });
  }
}
