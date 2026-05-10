import { cookies } from "next/headers";
import { openai } from "@ai-sdk/openai";
import { groq } from "@ai-sdk/groq";
import { streamText, convertToModelMessages, type UIMessage, type LanguageModel } from "ai";
import { getSupabaseRuntimeMode } from "@/lib/supabase/config";
import {
  getDashboardEffectiveDataMode,
  isDashboardDemoPreferenceActive
} from "@/lib/dashboard-demo-preference";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getMockTransactions } from "@/lib/mock-data";
import type { DashboardTx } from "@/lib/dashboard-metrics";
import { buildChatContext } from "@/lib/chat-context";
import { mapExpenseCategoryLabel } from "@/lib/expense-category-map";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Mirror of the dashboard fetch — keeps demo/Supabase behavior consistent. */
async function loadTransactions(): Promise<{
  transactions: DashboardTx[];
  userEmail: string | null;
  source: "supabase" | "demo";
}> {
  const envMode = getSupabaseRuntimeMode();
  const cookieStore = await cookies();
  const dataMode = getDashboardEffectiveDataMode(envMode, cookieStore);
  const demoPreferenceOn =
    envMode === "SUPABASE" && isDashboardDemoPreferenceActive(cookieStore);

  if (dataMode === "DEMO" || envMode !== "SUPABASE" || demoPreferenceOn) {
    const transactions: DashboardTx[] = getMockTransactions().map((t) => ({
      id: t.id,
      date: t.date,
      label: t.label,
      category: mapExpenseCategoryLabel(t.category),
      amount: t.amount,
      company: (t.company ?? "").trim()
    }));
    return { transactions, userEmail: null, source: "demo" };
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    const transactions: DashboardTx[] = getMockTransactions().map((t) => ({
      id: t.id,
      date: t.date,
      label: t.label,
      category: mapExpenseCategoryLabel(t.category),
      amount: t.amount,
      company: (t.company ?? "").trim()
    }));
    return { transactions, userEmail: null, source: "demo" };
  }

  const { data: userData } = await supabase.auth.getUser();
  const userEmail = userData.user?.email ?? null;
  if (!userData.user) {
    return { transactions: [], userEmail, source: "supabase" };
  }

  const withBalance = await supabase
    .from("transactions")
    .select("id,date,label,category,amount,balance,company")
    .order("date", { ascending: false })
    .limit(5000);

  const balanceColumnMissing =
    withBalance.error &&
    typeof withBalance.error.message === "string" &&
    /balance/i.test(withBalance.error.message) &&
    /(could not find|schema cache|does not exist)/i.test(withBalance.error.message);

  type TxRow = {
    id: string;
    date: string;
    label: string | null;
    category: string | null;
    amount: number | string;
    balance?: number | string | null;
    company: string | null;
  };

  let rawRows: TxRow[] = [];
  if (balanceColumnMissing) {
    const fallback = await supabase
      .from("transactions")
      .select("id,date,label,category,amount,company")
      .order("date", { ascending: false })
      .limit(5000);
    if (!fallback.error) rawRows = (fallback.data ?? []) as unknown as TxRow[];
  } else if (!withBalance.error) {
    rawRows = (withBalance.data ?? []) as unknown as TxRow[];
  }

  const transactions: DashboardTx[] = rawRows.map((row) => ({
    id: String(row.id),
    date: String(row.date).slice(0, 10),
    label: String(row.label ?? ""),
    category: mapExpenseCategoryLabel(String(row.category ?? "")),
    amount: Number(row.amount),
    balance: row.balance == null ? null : Number(row.balance),
    company: String(row.company ?? "").trim()
  }));

  return { transactions, userEmail, source: "supabase" };
}

/**
 * Choix du modèle : Groq et/ou OpenAI selon les clés et CHAT_PROVIDER.
 * - CHAT_PROVIDER=openai : uniquement OpenAI (aucun repli Groq).
 * - CHAT_PROVIDER=groq : Groq en priorité, repli OpenAI si besoin.
 * - Sinon : Groq en priorité si les deux clés sont présentes (défaut), sinon l’une ou l’autre.
 */
function pickChatModel(): { model: LanguageModel; provider: string } | null {
  const pref = (process.env.CHAT_PROVIDER ?? "").trim().toLowerCase();
  const hasGroq = Boolean(process.env.GROQ_API_KEY?.trim());
  const hasOpenai = Boolean(process.env.OPENAI_API_KEY?.trim());

  const groqModel = (): { model: LanguageModel; provider: string } | null => {
    if (!hasGroq) return null;
    const modelId = process.env.GROQ_CHAT_MODEL || "llama-3.3-70b-versatile";
    return { model: groq(modelId), provider: `groq:${modelId}` };
  };
  const openaiModel = (): { model: LanguageModel; provider: string } | null => {
    if (!hasOpenai) return null;
    const modelId = process.env.OPENAI_CHAT_MODEL || "gpt-4o-mini";
    return { model: openai(modelId), provider: `openai:${modelId}` };
  };

  if (pref === "openai") {
    return openaiModel();
  }
  if (pref === "groq") {
    return groqModel() ?? openaiModel();
  }
  return groqModel() ?? openaiModel();
}

export async function POST(req: Request) {
  const picked = pickChatModel();
  if (!picked) {
    return new Response(
      JSON.stringify({
        error:
          "Aucune clé d’API IA utilisable. Définissez GROQ_API_KEY (recommandé) ou OPENAI_API_KEY dans .env.local, puis redémarrez. CHAT_PROVIDER=openai force uniquement OpenAI."
      }),
      { status: 503, headers: { "Content-Type": "application/json" } }
    );
  }

  let body: { messages?: UIMessage[] } = {};
  try {
    body = (await req.json()) as { messages?: UIMessage[] };
  } catch {
    return new Response(JSON.stringify({ error: "Corps JSON invalide." }), {
      status: 400,
      headers: { "Content-Type": "application/json" }
    });
  }

  const allMessages = Array.isArray(body.messages) ? body.messages : [];

  // Keep the conversation rolling but bound: the system prompt (~3-4k tokens
  // with aggregates + 250 tx CSV) plus too much history blew past Groq's
  // 12 000 TPM limit. We keep the last MAX_HISTORY messages — enough to feel
  // contextual, small enough to stay well under the cap.
  const MAX_HISTORY = 10;
  const messages =
    allMessages.length > MAX_HISTORY ? allMessages.slice(-MAX_HISTORY) : allMessages;

  const { transactions, userEmail, source } = await loadTransactions();
  const context = buildChatContext(transactions, {
    userLabel: userEmail ?? (source === "demo" ? "démo" : null) ?? undefined
  });

  try {
    const result = streamText({
      model: picked.model,
      system: context.systemMessage,
      messages: await convertToModelMessages(messages),
      temperature: 0.2
    });

    return result.toUIMessageStreamResponse();
  } catch (err) {
    return jsonError(err, picked.provider);
  }
}

/**
 * Translate provider errors (Groq / OpenAI) into a friendly JSON payload
 * the UI can show. Specifically: rate-limit / context-too-big should not
 * look like a bare crash — we hint at what to do.
 */
function jsonError(err: unknown, provider: string): Response {
  const message = err instanceof Error ? err.message : String(err);
  const lower = message.toLowerCase();
  const isRateLimit =
    lower.includes("rate limit") ||
    lower.includes("tokens per minute") ||
    lower.includes("tpm") ||
    lower.includes("request too large");
  const isQuota =
    lower.includes("insufficient_quota") ||
    lower.includes("exceeded your current quota");

  let userMessage = `L’assistant (${provider}) a renvoyé une erreur : ${message}`;
  if (isRateLimit) {
    userMessage =
      "L’assistant a été temporairement bridé par le fournisseur (limite de tokens/minute). Patientez ~30 s et reposez votre question, ou réduisez votre message.";
  } else if (isQuota) {
    userMessage =
      provider.startsWith("openai")
        ? "OpenAI indique un quota insuffisant : vérifiez la facturation et les limites sur https://platform.openai.com/account/billing (crédit, mode payant, plafond mensuel). En attendant, vous pouvez utiliser Groq gratuit : renseignez GROQ_API_KEY dans .env.local, retirez ou commentez CHAT_PROVIDER=openai (ou mettez CHAT_PROVIDER=groq), puis redémarrez le serveur."
        : "Quota du fournisseur dépassé. Vérifiez votre plan ou utilisez une autre clé (ex. OpenAI avec facturation active).";
  }

  return new Response(
    JSON.stringify({ error: userMessage, provider, raw: message }),
    {
      status: isRateLimit ? 429 : isQuota ? 402 : 500,
      headers: { "Content-Type": "application/json" }
    }
  );
}
