"use client";

import { useEffect, useState } from "react";
import { Fingerprint, LoaderCircle } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { beginDashboardTransition } from "@/lib/dashboard-transition";

function hasMobilePasskeySupport(): boolean {
  return (
    typeof window !== "undefined" &&
    window.isSecureContext &&
    "PublicKeyCredential" in window &&
    window.matchMedia("(max-width: 767px) and (pointer: coarse)").matches
  );
}

export function PasskeyLoginButton({ nextPath }: { nextPath: string }) {
  const router = useRouter();
  const [isSupported, setIsSupported] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 767px) and (pointer: coarse)");
    const updateSupport = () => setIsSupported(hasMobilePasskeySupport());

    updateSupport();
    media.addEventListener("change", updateSupport);
    return () => media.removeEventListener("change", updateSupport);
  }, []);

  async function signInWithPasskey() {
    const supabase = createSupabaseBrowserClient();
    if (!supabase) {
      toast.error("Connexion biométrique indisponible", {
        description: "Supabase n’est pas configuré pour cette application."
      });
      return;
    }

    setIsLoading(true);
    const { error } = await supabase.auth.signInWithPasskey();
    setIsLoading(false);

    if (error) {
      const cancelled = /abort|cancel|notallowed/i.test(error.message);
      if (!cancelled) {
        toast.error("Connexion Face ID impossible", {
          description: error.message
        });
      }
      return;
    }

    toast.success("Connexion sécurisée");
    beginDashboardTransition();
    router.replace(nextPath);
    router.refresh();
  }

  if (!isSupported) return null;

  return (
    <button
      type="button"
      onClick={signInWithPasskey}
      disabled={isLoading}
      className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl border border-ink-200 bg-white px-4 text-sm font-semibold text-ink-800 transition hover:border-emerald-400 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/[0.12] dark:bg-white/[0.05] dark:text-white dark:hover:border-emerald-400/60 dark:hover:bg-emerald-400/10"
    >
      {isLoading ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden /> : <Fingerprint className="h-4 w-4" aria-hidden />}
      {isLoading ? "Vérification…" : "Se connecter avec Face ID"}
    </button>
  );
}
