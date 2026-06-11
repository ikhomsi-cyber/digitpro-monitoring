import Link from "next/link";
import { Suspense } from "react";
import { CheckCircle2, Sparkles, ShieldCheck, LineChart, type LucideIcon } from "lucide-react";
import { AuthForm } from "@/components/AuthForm";
import { Logo } from "@/components/ui/Logo";
import { PremiumIconBadge, type IconBadgeTone } from "@/components/ui/PremiumIconBadge";

const FEATURES: { icon: LucideIcon; label: string; tone: IconBadgeTone }[] = [
  { icon: LineChart, label: "Pilotez votre chiffre d’affaires en temps réel", tone: "brand" },
  { icon: Sparkles, label: "Assistant IA qui analyse vos transactions", tone: "emerald" },
  { icon: ShieldCheck, label: "Vos données restent privées et chiffrées", tone: "sky" }
];

export default function LoginPage() {
  return (
    <div className="premium-dashboard-page grid min-h-dvh grid-cols-1 lg:grid-cols-2">
      {/* ───────────── BRAND PANEL ─────────────────────────────── */}
      <aside
        aria-hidden="true"
        className="relative hidden overflow-hidden border-r border-ink-200/70 bg-gradient-to-br from-ink-50 via-white to-emerald-50/40 dark:border-white/[0.06] dark:from-transparent dark:via-transparent dark:to-transparent lg:flex lg:flex-col lg:items-center lg:justify-center lg:px-12 lg:py-16"
      >
        {/* Soft halo backgrounds */}
        <div className="pointer-events-none absolute -left-32 -top-32 h-[480px] w-[480px] rounded-full bg-[radial-gradient(circle,rgba(16,185,129,0.18),transparent_65%)] dark:bg-[radial-gradient(circle,rgba(45,212,191,0.22),transparent_65%)]" />
        <div className="pointer-events-none absolute -right-32 bottom-0 h-[420px] w-[420px] rounded-full bg-[radial-gradient(circle,rgba(20,184,166,0.12),transparent_65%)] dark:bg-[radial-gradient(circle,rgba(14,116,144,0.28),transparent_65%)]" />
        <div className="pointer-events-none absolute inset-0 opacity-[0.04] [background-image:linear-gradient(rgba(0,0,0,1)_1px,transparent_1px),linear-gradient(90deg,rgba(0,0,0,1)_1px,transparent_1px)] [background-size:40px_40px] dark:opacity-[0.05] dark:[background-image:linear-gradient(rgba(255,255,255,1)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,1)_1px,transparent_1px)]" />

        <div className="relative flex w-full max-w-md flex-col items-center">
          <Logo
            hero
            tagline="Pilotage financier moderne pour freelances et SASU. Conçu pour la clarté."
          />

          <ul className="mt-12 w-full space-y-3">
            {FEATURES.map((f) => (
              <li
                key={f.label}
                className="flex items-center gap-3 rounded-2xl border border-ink-200/80 bg-white/80 px-4 py-3 shadow-sm backdrop-blur-sm dark:border-cyan-100/[0.12] dark:bg-white/[0.05] dark:shadow-none"
              >
                <PremiumIconBadge icon={f.icon} tone={f.tone} size="sm" />
                <span className="text-sm font-medium text-ink-800 dark:text-white/80">{f.label}</span>
                <CheckCircle2 className="ml-auto h-4 w-4 text-emerald-500 dark:text-emerald-400" aria-hidden />
              </li>
            ))}
          </ul>
        </div>

        <div className="absolute bottom-6 left-0 right-0 text-center text-xs text-ink-500 dark:text-white/40">
          © {new Date().getFullYear()} DigitPro · Iliass KHOMSI
        </div>
      </aside>

      {/* ───────────── FORM PANEL ──────────────────────────────── */}
      <main className="flex flex-col px-6 py-10 sm:px-12 lg:px-16">
        {/* Mobile-only mini brand bar */}
        <div className="lg:hidden">
          <Logo />
        </div>

        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-10">
          {/* Mobile-only big logo (split screen invisible on mobile) */}
          <div className="mb-10 lg:hidden">
            <Logo hero tagline="Pilotage financier moderne pour freelances et SASU." />
          </div>

          <div className="text-center lg:text-left">
            <div className="h-eyebrow">Bienvenue</div>
            <h1 className="mt-2 font-display text-4xl font-semibold leading-[1.05] tracking-apple-tight text-ink-900 dark:text-white sm:text-5xl">
              Se connecter.
            </h1>
            <p className="mt-3 text-base text-ink-600 dark:text-white/55">
              Accédez à votre dashboard sécurisé.
            </p>
          </div>

          <div className="mt-8">
            <Suspense fallback={<div className="skeleton h-32 rounded-2xl" />}>
              <AuthForm mode="login" />
            </Suspense>

            <div className="mt-8 text-center text-sm text-ink-600 dark:text-white/55 lg:text-left">
              Pas de compte ?{" "}
              <Link
                className="font-semibold text-emerald-600 transition hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300"
                href="/signup"
              >
                Créer un compte ›
              </Link>
            </div>
          </div>
        </div>

        <footer className="mx-auto mt-6 w-full max-w-sm text-center text-xs text-ink-500 dark:text-white/40 lg:hidden">
          © {new Date().getFullYear()} DigitPro · Iliass KHOMSI
        </footer>
      </main>
    </div>
  );
}
