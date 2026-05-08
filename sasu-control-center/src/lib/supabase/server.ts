import "server-only";

import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import type { Database } from "./types";
import { getSupabaseEnv } from "./config";

export async function createSupabaseServerClient() {
  const cookieStore = await cookies();

  const env = getSupabaseEnv();
  if (!env) return null;

  return createServerClient<Database>(env.url, env.anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Server Components cannot set cookies. Middleware will refresh sessions instead.
        }
      }
    }
  });
}

