"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Fingerprint, LoaderCircle, Smartphone } from "lucide-react";
import { toast } from "sonner";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

function hasMobilePasskeySupport(): boolean {
  return (
    typeof window !== "undefined" &&
    window.isSecureContext &&
    "PublicKeyCredential" in window &&
    window.matchMedia("(max-width: 767px) and (pointer: coarse)").matches
  );
}

export function MobilePasskeySettings() {
  const [isSupported, setIsSupported] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isRegistering, setIsRegistering] = useState(false);
  const [passkeyCount, setPasskeyCount] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 767px) and (pointer: coarse)");
    const updateSupport = () => setIsSupported(hasMobilePasskeySupport());
    updateSupport();
    media.addEventListener("change", updateSupport);

    async function loadPasskeys() {
      if (!hasMobilePasskeySupport()) {
        setIsLoading(false);
        return;
      }

      const supabase = createSupabaseBrowserClient();
      if (!supabase) {
        setError("Supabase n’est pas configuré.");
        setIsLoading(false);
        return;
      }

      const { data, error: listError } = await supabase.auth.passkey.list();
      if (listError) {
        setError("Face ID doit d’abord être activé dans la configuration Supabase.");
      } else {
        setPasskeyCount(data.length);
      }
      setIsLoading(false);
    }

    void loadPasskeys();
    return () => media.removeEventListener("change", updateSupport);
  }, []);

  async function registerPasskey() {
    const supabase = createSupabaseBrowserClient();
    if (!supabase) return;

    setError(null);
    setIsRegistering(true);
    const { error: registrationError } = await supabase.auth.registerPasskey();
    setIsRegistering(false);

    if (registrationError) {
      const cancelled = /abort|cancel|notallowed/i.test(registrationError.message);
      if (!cancelled) {
        setError(registrationError.message);
        toast.error("Activation Face ID impossible", { description: registrationError.message });
      }
      return;
    }

    setPasskeyCount((count) => count + 1);
    toast.success("Face ID activé pour ce mobile");
  }

  return (
    <section className="rounded-3xl border border-ink-200 bg-white p-5 shadow-[0_14px_54px_-28px_rgba(0,0,0,0.2)] dark:border-white/[0.08] dark:bg-white/[0.04]">
      <div className="flex items-start gap-3">
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">
          <Fingerprint className="h-5 w-5" aria-hidden />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-ink-500 dark:text-white/45">Connexion mobile</p>
          <h2 className="mt-1 font-display text-xl font-bold text-ink-950 dark:text-white">Face ID</h2>
          <p className="mt-1 text-sm leading-6 text-ink-600 dark:text-white/55">
            {isSupported
              ? "Activez Face ID sur ce téléphone pour vous reconnecter sans saisir votre mot de passe."
              : "L’activation est disponible uniquement depuis un téléphone compatible, en connexion sécurisée."}
          </p>
        </div>
      </div>

      {isSupported ? (
        <div className="mt-5">
          {error ? <p className="mb-3 text-sm text-rose-700 dark:text-rose-300">{error}</p> : null}
          {passkeyCount > 0 ? (
            <p className="mb-3 inline-flex items-center gap-2 text-sm font-semibold text-emerald-700 dark:text-emerald-300">
              <CheckCircle2 className="h-4 w-4" aria-hidden /> Face ID activé sur ce mobile
            </p>
          ) : null}
          <button
            type="button"
            onClick={registerPasskey}
            disabled={isLoading || isRegistering || Boolean(error)}
            className="btn-primary min-h-12 w-full sm:w-auto"
          >
            {isLoading || isRegistering ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden /> : <Smartphone className="h-4 w-4" aria-hidden />}
            {passkeyCount > 0 ? "Ajouter Face ID à ce mobile" : "Activer Face ID"}
          </button>
        </div>
      ) : null}
    </section>
  );
}
