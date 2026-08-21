"use client";

import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { reportSupabaseEnvDiagnostics } from "@/lib/supabase/config";
import { useRouter, useSearchParams } from "next/navigation";
import { clsx } from "clsx";
import { ArrowRight, Eye, EyeOff, KeyRound, LoaderCircle, Mail } from "lucide-react";
import { getSafeAuthRedirect } from "@/lib/auth-redirect";
import { beginDashboardTransition } from "@/lib/dashboard-transition";
import { PasskeyLoginButton } from "@/components/PasskeyLoginButton";

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
  const [showPassword, setShowPassword] = useState(false);
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

      const next = getSafeAuthRedirect(searchParams.get("next"));

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

      beginDashboardTransition();
      router.push(next);
      router.refresh();
    });
  }

  const fieldClass = clsx(
    "h-[3.25rem] w-full rounded-2xl border bg-white px-4 text-base outline-none transition",
    "border-ink-300 bg-white text-ink-900 placeholder:text-ink-400",
    "focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/15",
    "dark:border-white/[0.12] dark:bg-white/[0.05] dark:text-white dark:placeholder:text-white/35",
    "dark:focus:border-emerald-400/70 dark:focus:ring-emerald-400/20"
  );
  const labelClass = "mb-2 block text-sm font-semibold text-ink-700 dark:text-white/70";

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <div className="space-y-4">
        <label className="block">
          <span className={labelClass}>Adresse e-mail</span>
          <span className="relative block">
            <Mail className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400 dark:text-white/35" aria-hidden />
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={clsx(fieldClass, "pl-11")}
              placeholder="vous@exemple.fr"
            />
          </span>
        </label>

        <label className="block">
          <span className={labelClass}>Mot de passe</span>
          <span className="relative block">
            <KeyRound className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400 dark:text-white/35" aria-hidden />
            <input
              type={showPassword ? "text" : "password"}
              required
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={clsx(fieldClass, "px-11")}
              placeholder="8 caractères minimum"
            />
            <button
              type="button"
              onClick={() => setShowPassword((visible) => !visible)}
              className="absolute right-3 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-xl text-ink-500 transition hover:bg-ink-100 hover:text-ink-900 dark:text-white/45 dark:hover:bg-white/10 dark:hover:text-white"
              aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
            >
              {showPassword ? <EyeOff className="h-4 w-4" aria-hidden /> : <Eye className="h-4 w-4" aria-hidden />}
            </button>
          </span>
        </label>
      </div>

      {error ? (
        <div role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm leading-6 text-rose-800 dark:border-rose-400/25 dark:bg-rose-500/10 dark:text-rose-200">
          {error}
        </div>
      ) : null}

      {info ? (
        <div role="status" className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm leading-6 text-emerald-900 dark:border-emerald-400/25 dark:bg-emerald-500/10 dark:text-emerald-200">
          {info}
        </div>
      ) : null}

      <button
        type="submit"
        disabled={isPending || !supabaseReady}
        className={clsx(
          "premium-cta min-h-[3.25rem] w-full text-base",
          (isPending || !supabaseReady) && "cursor-not-allowed opacity-60"
        )}
      >
        {isPending ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden /> : null}
        {isPending ? "Connexion…" : mode === "login" ? "Se connecter" : "Créer un compte"}
        {!isPending ? <ArrowRight className="h-4 w-4" aria-hidden /> : null}
      </button>

      {mode === "login" ? (
        <>
          <div className="flex items-center gap-3 text-xs font-medium text-ink-400 dark:text-white/30" aria-hidden="true">
            <span className="h-px flex-1 bg-ink-200 dark:bg-white/[0.1]" />
            ou
            <span className="h-px flex-1 bg-ink-200 dark:bg-white/[0.1]" />
          </div>
          <PasskeyLoginButton nextPath={getSafeAuthRedirect(searchParams.get("next"))} />
        </>
      ) : null}
    </form>
  );
}
