// Run AFTER the private-store migration, with the same key as the deployment.
// Never prints credentials. Re-runs skip encrypted values. Back up first.
import { createCipheriv, randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const keyValue = process.env.INTEGRATION_TOKEN_ENCRYPTION_KEY ?? "";
if (!/^[a-f0-9]{64}$/i.test(keyValue)) throw new Error("Encryption key must contain 64 hexadecimal characters.");
const key = Buffer.from(keyValue, "hex");
const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } });
function encrypt(value, binding) {
  if (value.startsWith("enc:v1:")) return value;
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(Buffer.from(binding));
  const bytes = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return "enc:v1:" + Buffer.concat([iv, cipher.getAuthTag(), bytes]).toString("base64");
}
let migrated = 0;
for (let page=1;;page++) {
  const { data, error } = await client.auth.admin.listUsers({ page, perPage: 100 });
  if (error) throw new Error("User enumeration failed.");
  for (const user of data.users) {
    for (const integration of ["gmail", "powens"]) {
      const result = await client.rpc("integration_secret_read", { p_user_id: user.id, p_integration: integration });
      if (result.error) throw new Error("Private credential read failed; verify migration.");
      if (!result.data) continue;
      const row = result.data;
      let changed = false;
      for (const field of integration === "gmail" ? ["refresh_token","access_token"] : ["auth_token"]) {
        if (typeof row[field] === "string" && row[field] && !row[field].startsWith("enc:v1:")) {
          row[field] = encrypt(row[field], `${integration}:${user.id}:${field}`);
          changed = true;
        }
      }
      if (!changed) continue;
      const write = await client.rpc("integration_secret_write", { p_user_id: user.id, p_integration: integration, p_values: row });
      if (write.error) throw new Error("Encrypted credential write failed.");
      migrated++;
    }
  }
  if (data.users.length < 100) break;
}
console.log(`Encrypted ${migrated} integration connections.`);
