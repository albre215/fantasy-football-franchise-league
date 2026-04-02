import { NextResponse } from "next/server";

import { AuthServiceError, authService } from "@/server/services/auth-service";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      displayName?: string;
      email?: string;
      phoneNumber?: string;
      password?: string;
    };

    const user = await authService.registerUser({
      displayName: body.displayName ?? "",
      email: body.email ?? "",
      phoneNumber: body.phoneNumber ?? "",
      password: body.password ?? ""
    });

    return NextResponse.json({ user }, { status: 201 });
  } catch (error) {
    if (error instanceof AuthServiceError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }

    return NextResponse.json({ error: "Unable to register account." }, { status: 500 });
  }
}
