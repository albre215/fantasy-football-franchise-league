import { NextResponse } from "next/server";

import { AuthRecoveryServiceError, authRecoveryService } from "@/server/services/auth-recovery-service";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const neutralResponse = {
    message: "If an account matches that email, a password reset email will be sent.",
    delivery: {
      channel: "email" as const
    }
  };

  try {
    const body = (await request.json()) as {
      email?: string;
    };

    const result = await authRecoveryService.requestPasswordReset(body.email ?? "");

    return NextResponse.json({
      message:
        result.delivery.channel === "email"
          ? "A password reset email has been sent."
          : "A password reset email preview is ready.",
      delivery: result.delivery
    });
  } catch (error) {
    if (error instanceof AuthRecoveryServiceError) {
      if (error.statusCode === 404 || error.statusCode === 429) {
        return NextResponse.json(neutralResponse);
      }

      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }

    return NextResponse.json({ error: "Unable to start password reset." }, { status: 500 });
  }
}
