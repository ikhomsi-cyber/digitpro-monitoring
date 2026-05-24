#!/usr/bin/env node
/**
 * Purge Powens data via service role (tous les utilisateurs).
 * Usage: node scripts/purge-powens-data.mjs
 * Requires NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in .env.local
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

function loadEnvLocal() {
  const path = resolve(process.cwd(), ".env.local");
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i < 0) continue;
    const key = t.slice(0, i).trim();
    let val = t.slice(i + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
}

loadEnvLocal();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false }
});

async function run() {
  const { data: sessions } = await supabase.from("import_sessions").select("id").eq("format", "powens");
  const sessionIds = (sessions ?? []).map((s) => s.id);
  let deletedTx = 0;
  if (sessionIds.length) {
    const { count, error } = await supabase
      .from("transactions")
      .delete({ count: "exact" })
      .in("import_session_id", sessionIds);
    if (error) throw error;
    deletedTx = count ?? 0;
  }

  const { count: deletedSessions, error: sErr } = await supabase
    .from("import_sessions")
    .delete({ count: "exact" })
    .eq("format", "powens");
  if (sErr) throw sErr;

  const { count: deletedPowens, error: pErr } = await supabase
    .from("powens_users")
    .delete({ count: "exact" })
    .neq("id", "00000000-0000-0000-0000-000000000000");
  if (pErr && !/powens_users|does not exist|42P01/i.test(pErr.message)) throw pErr;

  for (const table of [
    "lcl_transactions",
    "lcl_accounts",
    "revolut_personal_transactions",
    "revolut_personal_accounts"
  ]) {
    const { error } = await supabase.from(table).delete().neq("id", "00000000-0000-0000-0000-000000000000");
    if (error && !/does not exist|Could not find/i.test(error.message)) {
      console.warn(`${table}:`, error.message);
    }
  }

  const { error: mErr } = await supabase.from("monthly_metrics").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  if (mErr) throw mErr;

  console.log(
    JSON.stringify(
      {
        deletedTransactions: deletedTx,
        deletedImportSessions: deletedSessions ?? 0,
        deletedPowensUsers: deletedPowens ?? 0
      },
      null,
      2
    )
  );
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
