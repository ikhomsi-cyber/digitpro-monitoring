import { NextResponse } from "next/server";

/**
 * Powens webview redirects here with either:
 * - ?connection_id=123
 * - ?error=...&error_description=...
 *
 * This route intentionally returns a simple HTML response so it can be used as a redirect URI
 * during early integration. The dashboard will still require a manual "Synchroniser LCL" click.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const connectionId = url.searchParams.get("connection_id");
  const err = url.searchParams.get("error");
  const errDesc = url.searchParams.get("error_description");

  const ok = Boolean(connectionId) && !err;

  const body = `<!doctype html>
<html lang="fr">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Powens Connect</title>
    <style>
      body{font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial; padding:24px; color:#111827;}
      .card{max-width:560px;margin:0 auto;border:1px solid #e5e7eb;border-radius:16px;padding:18px;background:#fff;}
      .ok{color:#065f46;font-weight:700;}
      .bad{color:#991b1b;font-weight:700;}
      code{background:#f3f4f6;padding:2px 6px;border-radius:6px;}
      a{color:#2563eb;}
    </style>
  </head>
  <body>
    <div class="card">
      <h1>${ok ? "Connexion LCL terminée" : "Connexion LCL échouée"}</h1>
      <p class="${ok ? "ok" : "bad"}">
        ${ok ? "Powens a renvoyé un connection_id." : "Powens a renvoyé une erreur."}
      </p>
      ${
        ok
          ? `<p>connection_id: <code>${connectionId}</code></p>`
          : `<p>error: <code>${err ?? ""}</code></p><p>description: <code>${errDesc ?? ""}</code></p>`
      }
      <p>Vous pouvez maintenant revenir au dashboard et cliquer sur “Synchroniser LCL”.</p>
      <p><a href="/dashboard">Retour au dashboard</a></p>
    </div>
  </body>
</html>`;

  return new NextResponse(body, {
    status: ok ? 200 : 400,
    headers: { "content-type": "text/html; charset=utf-8" }
  });
}

