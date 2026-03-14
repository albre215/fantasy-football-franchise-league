import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    status: "ok",
    service: "fantasy-franchise-league",
    timestamp: new Date().toISOString()
  });
}
