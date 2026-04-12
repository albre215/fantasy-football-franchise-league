import { NextResponse } from "next/server";

import { AuthRecoveryServiceError, authRecoveryService } from "@/server/services/auth-recovery-service";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      phoneNumber?: string;
    };

    const result = await authRecoveryService.createTemporaryLoginCode(body.phoneNumber ?? "");

    return NextResponse.json({
      challengeId: result.challengeId,
      delivery: result.delivery
    });
  } catch (error) {
    if (error instanceof AuthRecoveryServiceError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }

    return NextResponse.json({ error: "Unable to send a temporary login code." }, { status: 500 });
  }
}
