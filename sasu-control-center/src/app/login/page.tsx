import Link from "next/link";
import { Suspense } from "react";
import { CheckCircle2, Sparkles, ShieldCheck, LineChart } from "lucide-react";
import { AuthForm } from "@/components/AuthForm";
import { Logo } from "@/components/ui/Logo";

const FEATURES: { icon: React.ComponentType<{ className?: string }>; label: string }[] = [
  { icon: LineChart, label: "Pilotez votre chiffre d’affaires en temps réel" },
  { icon: Sparkles, label: "Assistant IA qui analyse vos transactions" },
  { icon: ShieldCheck, label: "Vos données restent privées et chiffrées" }
];

export default function LoginPage() {
  return (
    <div className="grid min-h-dvh grid-cols-1 lg:grid-cols-2">
      {/* ───────────── BRAND PANEL ─────────────────────────────── */}
      <aside
        aria-hidden="true"
        className="relative hidden overflow-hidden bg-ink-100 lg:flex lg:flex-col lg:items-center lg:justify-center lg:px-12 lg:py-16"
      >
        {/* Soft halo backgrounds */}
        <div className="pointer-events-none absolute -left-32 -top-32 h-[480px] w-[480px] rounded-full bg-[radial-gradient(circle,rgba(0,113,227,0.18),transparent_65%)]" />
        <div className="pointer-events-none absolute -right-32 bottom-0 h-[420px] w-[420px] rounded-full bg-[radial-gradient(circle,rgba(0,113,227,0.10),transparent_65%)]" />
        <div className="pointer-events-none absolute inset-0 opacity-[0.04] [background-image:linear-gradient(rgba(0,0,0,1)_1px,transparent_1px),linear-gradient(90deg,rgba(0,0,0,1)_1px,transparent_1px)] [background-size:40px_40px]" />

        <div className="relative flex w-full max-w-md flex-col items-center">
          <Logo
            hero
            tagline="Pilotage financier moderne pour freelances et SASU. Conçu pour la clarté."
          />

          <ul className="mt-12 w-full space-y-3">
            {FEATURES.map((f) => (
              <li
                key={f.label}
                className="flex items-center gap-3 rounded-2xl border border-ink-200 bg-white/80 px-4 py-3 backdrop-blur-sm"
              >
                <span className="grid h-8 w-8 place-items-center rounded-full bg-brand-50 text-brand-600">
                  <f.icon className="h-4 w-4" />
                </span>
                <span className="text-sm font-medium text-ink-800">{f.label}</span>
                <CheckCircle2 className="ml-auto h-4 w-4 text-brand-500" aria-hidden />
              </li>
            ))}
          </ul>
        </div>

        <div className="absolute bottom-6 left-0 right-0 text-center text-xs text-ink-500">
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
            <h1 className="mt-2 font-display text-4xl font-semibold leading-[1.05] tracking-apple-tight text-ink-900 sm:text-5xl">
              Se connecter.
            </h1>
            <p className="mt-3 text-base text-ink-600">
              Accédez à votre dashboard sécurisé.
            </p>
          </div>

          <div className="mt-8">
            <Suspense fallback={<div className="skeleton h-32 rounded-2xl" />}>
              <AuthForm mode="login" />
            </Suspense>

            <div className="mt-8 text-center text-sm text-ink-600 lg:text-left">
              Pas de compte ?{" "}
              <Link className="btn-link" href="/signup">
                Créer un compte ›
              </Link>
            </div>
          </div>
        </div>

        <footer className="mx-auto mt-6 w-full max-w-sm text-center text-xs text-ink-500 lg:hidden">
          © {new Date().getFullYear()} DigitPro · Iliass KHOMSI
        </footer>
      </main>
    </div>
  );
}
