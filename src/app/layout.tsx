import "./globals.css";
import type { Metadata, Viewport } from "next";
import { Inter, Plus_Jakarta_Sans } from "next/font/google";
import { Toaster } from "sonner";
import { DARK_MODE_LOCAL_STORAGE_KEY } from "@/lib/dark-mode-flag";
import { APP_LAUNCH_BG_LIGHT, APP_THEME_COLOR_DARK } from "@/lib/app-launch-theme";

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
    "Pilotage financier DigitPro — transactions, indicateurs et simulation. Interface SaaS premium.",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "DigitPro"
  }
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: APP_LAUNCH_BG_LIGHT
};

/** Inline script : privacy + thème + theme-color avant le premier paint (fond via CSS sur html). */
const htmlBootstrap = `try{var d=document.documentElement;var dark=localStorage.getItem('${DARK_MODE_LOCAL_STORAGE_KEY}')==='1';if(localStorage.getItem('privacyBlur')==='1')d.classList.add('privacy-blur');if(dark)d.classList.add('dark');var theme=dark?'${APP_THEME_COLOR_DARK}':'${APP_LAUNCH_BG_LIGHT}';d.style.colorScheme=dark?'dark':'light';var m=document.querySelector('meta[name="theme-color"]');if(m){m.content=theme}else{m=document.createElement('meta');m.name='theme-color';m.content=theme;document.head.appendChild(m)}}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <head>
        <meta name="color-scheme" content="light dark" />
        <script dangerouslySetInnerHTML={{ __html: htmlBootstrap }} />
        <link rel="icon" href="/icons/favicon.svg" type="image/svg+xml" />
        <link rel="manifest" href="/site.webmanifest" />
        <link rel="apple-touch-icon" href="/icons/digitpro-icon.svg" />
        <meta name="theme-color" content={APP_LAUNCH_BG_LIGHT} />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
      </head>
      <body
        className={`${inter.variable} ${display.variable} font-sans text-ink-900 transition-colors duration-200 dark:text-ink-50`}
        suppressHydrationWarning
      >
        <div className="min-h-dvh min-h-[100dvh] bg-transparent">{children}</div>
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
