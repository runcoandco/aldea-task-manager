import { NextResponse } from "next/server";
import { appUrl } from "@/lib/config";
import { COOKIE_NAME } from "@/lib/session";

export async function POST() {
  const response = NextResponse.redirect(appUrl(), { status: 303 });
  response.cookies.delete(COOKIE_NAME);
  return response;
}
