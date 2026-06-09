"use client";

import { useEffect } from "react";
import Link from "next/link";

/**
 * Erreur rendu Server Component du dashboard (ex. après sync Qonto + refresh).
 * En prod Next masque souvent le message ; le digest permet de corréler les logs Vercel.
 */
export default function DashboardError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[dashboard/error]", error.message, error.digest ?? "");
  }, [error]);

  return (
    <div className="premium-dashboard-page flex min-h-dvh items-center justify-center px-6 py-20">
      <div className="mx-auto max-w-lg text-center">
        <h1 className="font-display text-2xl font-semibold text-ink-900 dark:text-white">
          Impossible d’afficher le tableau de bord
        </h1>
        <p className="mt-4 text-ink-600 dark:text-white/55">
          Une erreur s’est produite côté serveur lors du chargement de cette page. Si cela arrive
          après une synchronisation Qonto, rechargez la page : les données ont souvent bien été
          enregistrées.
        </p>
        {error.digest ? (
          <p className="mt-3 font-mono text-xs text-ink-500 dark:text-white/40">
            Réf. technique (digest) : {error.digest}
          </p>
        ) : null}
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <button type="button" onClick={() => reset()} className="btn-primary">
            Réessayer
          </button>
          <button
            type="button"
            onClick={() => {
              window.location.reload();
            }}
            className="btn-secondary"
          >
            Recharger la page
          </button>
          <Link
            href="/login"
            className="text-sm font-semibold text-emerald-600 underline-offset-4 hover:underline dark:text-emerald-400"
          >
            Connexion
          </Link>
        </div>
      </div>
    </div>
  );
}
