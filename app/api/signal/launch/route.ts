import { NextResponse } from "next/server";
import { appUrl, signalAppUrl } from "@/lib/config";
import { currentUser } from "@/lib/session";
import { createSignalLaunchToken } from "@/lib/signal-launch";

export async function GET() {
  const user = await currentUser();

  if (!user || !user.apps.includes("signal")) {
    return NextResponse.redirect(appUrl());
  }

  const signalUrl = new URL(signalAppUrl());
  signalUrl.searchParams.set("launch", createSignalLaunchToken({
    owner: user.signalOwner || user.owner,
    role: user.role
  }));
  return NextResponse.redirect(signalUrl);
}
