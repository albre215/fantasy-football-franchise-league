import { NextResponse } from "next/server";

import { AuthRecoveryServiceError, authRecoveryService } from "@/server/services/auth-recovery-service";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      token?: string;
      password?: string;
      confirmPassword?: string;
    };

    if ((body.password ?? "") !== (body.confirmPassword ?? "")) {
      return NextResponse.json({ error: "Passwords must match." }, { status: 400 });
    }

    await authRecoveryService.resetPasswordWithToken(body.token ?? "", body.password ?? "");

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof AuthRecoveryServiceError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }

    return NextResponse.json({ error: "Unable to complete password reset." }, { status: 500 });
  }
}
