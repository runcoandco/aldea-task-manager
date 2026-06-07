import { NextResponse } from "next/server";
import { appUrl } from "@/lib/config";
import { currentUser } from "@/lib/session";

export async function GET() {
  const user = await currentUser();

  if (!user || !user.apps.includes("signal")) {
    return NextResponse.redirect(appUrl());
  }

  const signalUrl = new URL(process.env.SIGNAL_APP_URL || "https://aldea-signal-capture.vercel.app/");
  signalUrl.searchParams.set("owner", user.owner);
  signalUrl.searchParams.set("role", user.role);
  return NextResponse.redirect(signalUrl);
}
