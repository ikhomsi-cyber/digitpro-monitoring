import { NextRequest, NextResponse } from "next/server";

/**
 * Redirection OAuth / webview Powens après liaison bancaire.
 * Déclarez cette URL exacte dans la console Powens (POWENS_REDIRECT_URI).
 */
export async function GET(req: NextRequest) {
  const u = req.nextUrl;
  const error = u.searchParams.get("error");
  const errorDescription = u.searchParams.get("error_description");
  const connectionId = u.searchParams.get("connection_id");

  const target = new URL("/dashboard", u.origin);
  if (error) {
    target.searchParams.set("powens_connect", "error");
    target.searchParams.set("powens_error", error);
    if (errorDescription) {
      target.searchParams.set(
        "powens_error_description",
        errorDescription.slice(0, 500)
      );
    }
  } else {
    target.searchParams.set("powens_connect", "ok");
    if (connectionId) {
      target.searchParams.set("powens_connection_id", connectionId);
    }
  }

  return NextResponse.redirect(target);
}
