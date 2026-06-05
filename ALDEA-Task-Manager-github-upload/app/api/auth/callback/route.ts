import { NextRequest, NextResponse } from "next/server";
import { appUrl, findApprovedUser, googleOAuthConfig } from "@/lib/config";
import { COOKIE_NAME, createSessionToken, sessionCookieOptions } from "@/lib/session";

type GoogleTokenResponse = {
  id_token?: string;
  error?: string;
};

type GoogleProfile = {
  aud?: string;
  email?: string;
  email_verified?: boolean;
  exp?: number;
};

function decodeJwtPayload(token: string) {
  const [, payload] = token.split(".");
  if (!payload) return null;
  return JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as GoogleProfile;
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const expectedState = request.cookies.get("aldea_oauth_state")?.value;

  if (!state || !expectedState || state !== expectedState) {
    return NextResponse.redirect(`${appUrl()}/?auth=state-failed`);
  }

  if (!code) {
    return NextResponse.redirect(`${appUrl()}/?auth=missing-code`);
  }

  const { clientId, clientSecret, redirectUri } = googleOAuthConfig();
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code"
    })
  });

  const token = await response.json() as GoogleTokenResponse;
  if (!response.ok || !token.id_token) {
    return NextResponse.redirect(`${appUrl()}/?auth=token-failed`);
  }

  const profile = decodeJwtPayload(token.id_token);
  const now = Math.floor(Date.now() / 1000);
  const email = profile?.email?.toLowerCase().trim();
  if (!profile || !email || profile.email_verified === false || profile.aud !== clientId || !profile.exp || profile.exp < now) {
    return NextResponse.redirect(`${appUrl()}/?auth=email-unverified`);
  }

  const user = findApprovedUser(email);
  if (!user || !user.apps.includes("task-manager")) {
    return NextResponse.redirect(`${appUrl()}/?auth=not-approved`);
  }

  const redirect = NextResponse.redirect(appUrl());
  redirect.cookies.set(COOKIE_NAME, await createSessionToken(user), {
    ...sessionCookieOptions(),
    maxAge: 60 * 60 * 24 * 7
  });
  redirect.cookies.delete("aldea_oauth_state");
  return redirect;
}
