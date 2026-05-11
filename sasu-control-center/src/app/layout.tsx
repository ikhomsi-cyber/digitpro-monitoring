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
      </head>
      <body
        className={`${inter.variable} ${display.variable} font-sans bg-white text-ink-900 transition-colors duration-200 dark:bg-ink-950 dark:text-ink-100`}
      >
        <div className="min-h-dvh">{children}</div>
        <Toaster
          position="top-center"
          closeButton
          toastOptions={{
            classNames: {
              toast:
                "rounded-2xl border border-ink-200 bg-white shadow-card dark:border-ink-700 dark:bg-ink-900 dark:shadow-none",
              title: "font-semibold text-ink-900 dark:text-ink-50",
              description: "text-ink-600 dark:text-ink-400"
            }
          }}
        />
      </body>
    </html>
  );
}
