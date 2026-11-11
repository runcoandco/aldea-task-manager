import { NextResponse } from "next/server";
import { appUrl, signalAppUrl } from "@/lib/config";
import { currentUser } from "@/lib/session";

export async function GET() {
  const user = await currentUser();

  if (!user || !user.apps.includes("signal")) {
    return NextResponse.redirect(appUrl());
  }

  const signalUrl = new URL(signalAppUrl());
  signalUrl.searchParams.set("owner", user.signalOwner || user.owner);
  signalUrl.searchParams.set("role", user.role);
  return NextResponse.redirect(signalUrl);
}
