import { NextResponse } from "next/server";

import { AuthRecoveryServiceError, authRecoveryService } from "@/server/services/auth-recovery-service";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get("token") ?? "";
    const result = await authRecoveryService.validatePasswordResetToken(token);

    return NextResponse.json({
      valid: true,
      email: result.email
    });
  } catch (error) {
    if (error instanceof AuthRecoveryServiceError) {
      return NextResponse.json({ error: error.message, valid: false }, { status: error.statusCode });
    }

    return NextResponse.json({ error: "Unable to validate password reset link.", valid: false }, { status: 500 });
  }
}
