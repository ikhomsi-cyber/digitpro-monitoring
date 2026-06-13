import "./globals.css";
import type { Metadata } from "next";
import { Inter, Plus_Jakarta_Sans } from "next/font/google";
import { Toaster } from "sonner";
import { DARK_MODE_LOCAL_STORAGE_KEY } from "@/lib/dark-mode-flag";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-sans"
});

const display = Plus_Jakarta_Sans({
  subsets: ["latin"],
  display: "swap",
  weight: ["500", "600", "700", "800"],
  variable: "--font-display"
});

export const metadata: Metadata = {
  title: "DigitPro Consultion Monitoring (by Iliass KHOMSI)",
  description:
    "Pilotage financier DigitPro — transactions, indicateurs et simulation. Interface SaaS premium."
};

/** Inline script : privacy + thème sombre avant paint (évite flash). */
const htmlBootstrap = `try{var d=document.documentElement;if(localStorage.getItem('privacyBlur')==='1')d.classList.add('privacy-blur');if(localStorage.getItem('${DARK_MODE_LOCAL_STORAGE_KEY}')==='1')d.classList.add('dark')}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <head>
        <meta name="color-scheme" content="light dark" />
        <script dangerouslySetInnerHTML={{ __html: htmlBootstrap }} />
        <link rel="icon" href="/icons/favicon.svg" type="image/svg+xml" />
        <link rel="manifest" href="/site.webmanifest" />
        <link rel="apple-touch-icon" href="/icons/digitpro-icon.svg" />
        <meta name="theme-color" content="#06242b" media="(prefers-color-scheme: dark)" />
        <meta name="theme-color" content="#F5F5F7" media="(prefers-color-scheme: light)" />
      </head>
      <body
        className={`${inter.variable} ${display.variable} font-sans bg-ink-100 text-ink-900 transition-colors duration-200 dark:bg-[#06242b] dark:text-ink-50`}
        suppressHydrationWarning
      >
        <div className="min-h-dvh">{children}</div>
        <Toaster
          position="top-center"
          closeButton
          toastOptions={{
            classNames: {
              toast:
                "rounded-2xl border border-ink-200 bg-white shadow-card dark:border-cyan-100/[0.12] dark:bg-[#0b3038] dark:shadow-[0_24px_80px_-28px_rgba(0,22,28,0.72)]",
              title: "font-semibold text-ink-900 dark:text-white",
              description: "text-ink-600 dark:text-white/55"
            }
          }}
        />
      </body>
    </html>
  );
}
