import { NextRequest, NextResponse } from "next/server";
import { syncSecretToken } from "@/lib/config";
import { runAldeaTrailSync } from "@/lib/sync/aldea-trails";

function isAuthorized(request: NextRequest) {
  const header = request.headers.get("authorization") || "";
  const [scheme, token] = header.split(" ");
  return scheme === "Bearer" && token === syncSecretToken();
}

export async function POST(request: NextRequest) {
  try {
    if (!isAuthorized(request)) {
      return NextResponse.json({
        success: false,
        timestamp: new Date().toISOString(),
        error: "Unauthorized"
      }, { status: 401 });
    }
  } catch (error) {
    return NextResponse.json({
      success: false,
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : "Configuration error"
    }, { status: 500 });
  }

  try {
    return NextResponse.json(await runAldeaTrailSync());
  } catch (error) {
    console.error("ALDEA Trails sync failed", error);
    return NextResponse.json({
      success: false,
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : "Sync failed"
    }, { status: 500 });
  }
}
