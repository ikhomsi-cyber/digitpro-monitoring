import { NextRequest, NextResponse } from "next/server";
import {
  powensAccountFilterForAxis,
  powensDefaultCompanyLabel,
  powensPrimaryImportAxis,
  type PowensImportAxis
} from "@/lib/powens/config";
import { powensCloudFetchTransactions, normalizePowensUserBearerToken } from "@/lib/powens/cloud-api";

export const dynamic = "force-dynamic";

function bearerFromHeader(req: NextRequest): string | null {
  const auth = req.headers.get("authorization")?.trim();
  if (!auth) return null;
  if (auth.toLowerCase().startsWith("bearer ")) {
    const t = auth.slice(7).trim();
    return t.length ? t : null;
  }
  return auth.length ? auth : null;
}

function pickImportAxis(
  postBody: Record<string, unknown> | null,
  req: NextRequest
): PowensImportAxis {
  const q = req.nextUrl.searchParams.get("scope")?.trim().toLowerCase();
  if (q === "personal") return "personal";
  if (q === "pro") return "pro";
  if (postBody) {
    const raw = postBody.scope;
    if (typeof raw === "string") {
      const v = raw.trim().toLowerCase();
      if (v === "personal") return "personal";
      if (v === "pro") return "pro";
    }
  }
  return powensPrimaryImportAxis();
}

function pickPowensUserId(
  postBody: Record<string, unknown> | null,
  req: NextRequest
): string | null {
  if (postBody) {
    const id = postBody.id_user ?? postBody.powens_user_id;
    if (id != null && String(id).trim()) return String(id).trim();
  }
  const q =
    req.nextUrl.searchParams.get("id_user")?.trim() ||
    req.nextUrl.searchParams.get("powens_user_id")?.trim();
  return q || null;
}

/**
 * GET ou POST /api/powens/transactions-test
 *
 * Dev uniquement : appelle les endpoints GET transactions Powens avec un **token utilisateur**
 * (`auth_token` retourné par `auth/init` ou stocké dans `powens_users`).
 *
 * Token (priorité) :
 * 1. `Authorization: Bearer <token>`
 * 2. POST JSON `{ "auth_token": "<token>" }`
 * 3. Query `?token=…`
 * 4. Variable `POWENS_TEST_AUTH_TOKEN` dans `.env.local`
 *
 * Optionnel — id utilisateur Powens (`id_user` dans la réponse `auth/init`) :
 * `?id_user=123` ou POST `{ "id_user": "123" }` → essaie aussi `GET /users/{id}/transactions?limit=…`
 *
 * Périmètre (aligné dashboard) : `?scope=pro|personal` ou POST `{ "scope": "personal" }`
 * (sinon même défaut que `POWENS_IMPORT_SCOPE`). Filtre optionnel `POWENS_*_ACCOUNT_IDS` appliqué selon l’axe.
 */
async function handle(req: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json(
      { ok: false, error: "Route désactivée en production (tests Powens uniquement en dev)." },
      { status: 403 }
    );
  }

  let postBody: Record<string, unknown> | null = null;
  if (req.method === "POST") {
    try {
      postBody = (await req.json()) as Record<string, unknown>;
    } catch {
      postBody = null;
    }
  }

  let token = bearerFromHeader(req);

  if (!token && postBody) {
    const raw = postBody.auth_token ?? postBody.token;
    if (typeof raw === "string" && raw.trim()) token = raw.trim();
  }

  if (!token) {
    const q = req.nextUrl.searchParams.get("token")?.trim();
    if (q) token = q;
  }

  if (!token) {
    const env = process.env.POWENS_TEST_AUTH_TOKEN?.trim();
    if (env) token = env;
  }

  if (!token) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Token manquant : header Authorization: Bearer, POST { auth_token }, ?token= ou POWENS_TEST_AUTH_TOKEN dans .env.local"
      },
      { status: 400 }
    );
  }

  const powensUserId = pickPowensUserId(postBody, req);
  const axis = pickImportAxis(postBody, req);
  const company = powensDefaultCompanyLabel(axis);
  const filterAccountIds = powensAccountFilterForAxis(axis);

  try {
    const normalizedToken = normalizePowensUserBearerToken(token);
    const rows = await powensCloudFetchTransactions(normalizedToken, {
      company,
      scope: axis,
      powensUserId,
      filterAccountIds
    });
    return NextResponse.json({
      ok: true,
      count: rows.length,
      scope: axis,
      company,
      filterAccountIdsCount: filterAccountIds?.length ?? 0,
      powensUserIdUsed: powensUserId,
      sample: rows.slice(0, 25),
      truncated: rows.length > 25
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: message }, { status: 502 });
  }
}

export async function GET(req: NextRequest) {
  return handle(req);
}

export async function POST(req: NextRequest) {
  return handle(req);
}
