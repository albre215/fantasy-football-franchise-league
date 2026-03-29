import { NextResponse } from "next/server";

import { RouteAuthError, requireAuthenticatedUserId } from "@/lib/auth-session";
import { AccountServiceError, accountService } from "@/server/services/account-service";
import type { AccountProfileResponse } from "@/types/account";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const userId = await requireAuthenticatedUserId();
    const account = await accountService.getAccountProfile(userId);

    return NextResponse.json<AccountProfileResponse>({ account });
  } catch (error) {
    if (error instanceof RouteAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }

    if (error instanceof AccountServiceError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }

    return NextResponse.json({ error: "Unable to load account settings." }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const userId = await requireAuthenticatedUserId();
    const body = (await request.json()) as {
      displayName?: string;
      phoneNumber?: string;
    };

    const account = await accountService.updateAccountProfile(userId, {
      displayName: body.displayName ?? "",
      phoneNumber: body.phoneNumber ?? ""
    });

    return NextResponse.json<AccountProfileResponse>({ account });
  } catch (error) {
    if (error instanceof RouteAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }

    if (error instanceof AccountServiceError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }

    return NextResponse.json({ error: "Unable to update account settings." }, { status: 500 });
  }
}
