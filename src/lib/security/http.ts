export function requireSameOrigin(request: Request): Response | null {
  const origin = request.headers.get("origin");
  const expected = new URL(request.url).origin;
  if (!origin || origin !== expected || request.headers.get("sec-fetch-site") === "cross-site") {
    return Response.json({ ok: false, error: "Origine de requête non autorisée." }, { status: 403 });
  }
  return null;
}

export const privateResponseHeaders = { "Cache-Control": "private, no-store", Vary: "Cookie" };
