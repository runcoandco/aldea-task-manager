import { NextResponse } from "next/server";
import { appUrl } from "@/lib/config";
import { COOKIE_NAME } from "@/lib/session";

function logout() {
  const response = NextResponse.redirect(appUrl(), { status: 303 });
  response.cookies.delete(COOKIE_NAME);
  return response;
}

export async function GET() {
  return logout();
}

export async function POST() {
  return logout();
}
