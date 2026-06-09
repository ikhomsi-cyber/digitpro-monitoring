import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowUpRight } from "lucide-react";
import { getSupabaseRuntimeMode, reportSupabaseEnvDiagnostics } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Logo } from "@/components/ui/Logo";

/** L’analyse LMNP est affichée sur le dashboard (`?panel=lmnp`) pour éviter un changement de page. */
const LMNP_ON_DASHBOARD = "/dashboard?panel=lmnp";

export const dynamic = "force-dynamic";

export default async function LmnpPage() {
  reportSupabaseEnvDiagnostics("app/lmnp/page");

  const envMode = getSupabaseRuntimeMode();
  const supabase = envMode === "SUPABASE" ? await createSupabaseServerClient() : null;
  const user = !supabase ? null : (await supabase.auth.getUser()).data.user;

  if (envMode === "SUPABASE" && !user) {
    return (
      <div className="premium-dashboard-page flex min-h-dvh items-center justify-center px-6 py-24">
        <div className="mx-auto max-w-2xl text-center">
          <Logo className="mx-auto mb-8" />
          <h1 className="h-display">Connexion requise</h1>
          <p className="mt-4 text-ink-600 dark:text-white/55">Connectez-vous pour accéder à l’analyse LMNP.</p>
          <div className="mt-8">
            <Link href={`/login?next=${encodeURIComponent(LMNP_ON_DASHBOARD)}`} className="premium-cta inline-flex">
              Connexion <ArrowUpRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </div>
    );
  }

  redirect(LMNP_ON_DASHBOARD);
}
