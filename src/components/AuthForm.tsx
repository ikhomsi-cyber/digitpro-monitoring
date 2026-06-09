"use client";

import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { reportSupabaseEnvDiagnostics } from "@/lib/supabase/config";
import { useRouter, useSearchParams } from "next/navigation";
import { clsx } from "clsx";

type Mode = "login" | "signup";

function formatAuthError(message: string): string {
  const m = message.trim();
  if (/email not confirmed/i.test(m)) {
    return (
      "Votre adresse e-mail n’est pas encore confirmée. Ouvrez le lien reçu par e-mail (vérifiez les courriers indésirables), " +
      "puis reconnectez-vous. Pour le développement local, vous pouvez désactiver la confirmation dans Supabase : " +
      "Authentication → Providers → Email → désactiver « Confirm email »."
    );
  }
  return m;
}

export function AuthForm({ mode }: { mode: Mode }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [supabaseReady, setSupabaseReady] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setSupabaseReady(true);
    reportSupabaseEnvDiagnostics("AuthForm (client)", { dedupeKey: "browser" });
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);

    startTransition(async () => {
      if (!supabaseReady) return;
      const supabase = createSupabaseBrowserClient();
      if (!supabase) {
        setError(
          "Supabase n’est pas configuré. Ajoutez NEXT_PUBLIC_SUPABASE_URL et NEXT_PUBLIC_SUPABASE_ANON_KEY pour activer l’authentification."
        );
        return;
      }

      const next = searchParams.get("next") || "/dashboard";

      if (mode === "login") {
        const { error: loginError } = await supabase.auth.signInWithPassword({ email, password });
        if (loginError) {
          const msg = formatAuthError(loginError.message);
          setError(msg);
          toast.error("Connexion impossible", { description: msg });
          return;
        }
        toast.success("Connecté", { description: email });
      } else {
        const { data, error: signupError } = await supabase.auth.signUp({ email, password });
        if (signupError) {
          const msg = formatAuthError(signupError.message);
          setError(msg);
          toast.error("Inscription impossible", { description: msg });
          return;
        }
        if (!data.session) {
          const msg =
            "Compte créé. Consultez votre boîte e-mail et cliquez sur le lien de confirmation pour activer votre compte, puis reconnectez-vous.";
          setInfo(msg);
          toast.success("Compte créé", {
            description: "Confirmez votre e-mail pour activer le compte."
          });
          return;
        }
        toast.success("Compte créé", { description: email });
      }

      router.push(next);
      router.refresh();
    });
  }

  const fieldClass = clsx(
    "mt-2 w-full rounded-2xl border px-4 py-3 text-base outline-none transition",
    "border-ink-300 bg-white text-ink-900 placeholder:text-ink-400",
    "focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/25",
    "dark:border-white/[0.12] dark:bg-white/[0.05] dark:text-white dark:placeholder:text-white/35",
    "dark:focus:border-emerald-400/70 dark:focus:ring-emerald-400/25"
  );
  const labelClass = "text-sm font-semibold text-ink-700 dark:text-white/70";

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <label className={labelClass}>Email</label>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={fieldClass}
          placeholder="vous@exemple.fr"
        />
      </div>

      <div>
        <label className={labelClass}>Mot de passe</label>
        <input
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={fieldClass}
          placeholder="••••••••"
        />
      </div>

      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 dark:border-rose-400/25 dark:bg-rose-500/10 dark:text-rose-200">
          {error}
        </div>
      ) : null}

      {info ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900 dark:border-emerald-400/25 dark:bg-emerald-500/10 dark:text-emerald-200">
          {info}
        </div>
      ) : null}

      <button
        type="submit"
        disabled={isPending || !supabaseReady}
        className={clsx(
          "premium-cta w-full text-base",
          (isPending || !supabaseReady) && "cursor-not-allowed opacity-60"
        )}
      >
        {mode === "login" ? "Se connecter" : "Créer un compte"}
      </button>
    </form>
  );
}

