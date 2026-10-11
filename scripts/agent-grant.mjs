import { createHash, randomBytes } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";

const [operation, nameOrId, output] = process.argv.slice(2);
if (!["create","revoke"].includes(operation) || !nameOrId || (operation === "create" && !output)) {
  throw new Error("Usage: node --env-file=.env.local scripts/agent-grant.mjs create NAME OUTPUT_FILE | revoke GRANT_ID");
}
const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } });
if (operation === "revoke") {
  const result = await client.rpc("agent_grant_revoke", { p_grant_id: nameOrId });
  if (result.error) throw new Error("Revocation failed.");
  console.log("Agent grant revoked.");
} else {
  const owner = process.env.QONTO_ALLOWED_USER_ID;
  if (!owner) throw new Error("Configure the explicit owner before provisioning an agent.");
  const token = "dp_agent_" + randomBytes(32).toString("base64url");
  const result = await client.rpc("agent_grant_create", {
    p_user_id: owner, p_name: nameOrId, p_hash: createHash("sha256").update(token).digest("hex")
  });
  if (result.error) throw new Error("Provisioning failed; verify migration.");
  try { await writeFile(output, token + "\n", { mode: 0o600, flag: "wx" }); }
  catch { await client.rpc("agent_grant_revoke", { p_grant_id: result.data }); throw new Error("Credential file unavailable; grant revoked."); }
  console.log(`Grant ${result.data}: one hour, 100 calls, professional aggregates only. Credential saved to the requested file.`);
}
