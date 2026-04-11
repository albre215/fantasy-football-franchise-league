import { NextResponse } from "next/server";

import { RouteAuthError, requireAuthenticatedUserId } from "@/lib/auth-session";
import { AccountServiceError, accountService } from "@/server/services/account-service";

export const dynamic = "force-dynamic";

export async function PATCH(request: Request) {
  try {
    const userId = await requireAuthenticatedUserId();
    const body = (await request.json()) as {
      currentPassword?: string;
      nextPassword?: string;
    };

    await accountService.changePassword(userId, body.currentPassword ?? "", body.nextPassword ?? "");

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof RouteAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }

    if (error instanceof AccountServiceError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }

    return NextResponse.json({ error: "Unable to update password." }, { status: 500 });
  }
}
