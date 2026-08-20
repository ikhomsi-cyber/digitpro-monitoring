import "./globals.css";
import type { Metadata, Viewport } from "next";
import { Toaster } from "sonner";
import { AppLaunchOverlay } from "@/components/ui/AppLaunchOverlay";
import { DARK_MODE_LOCAL_STORAGE_KEY } from "@/lib/dark-mode-flag";
import { APP_LAUNCH_BG_LIGHT, APP_LAUNCH_BG_DARK, APP_THEME_COLOR_DARK } from "@/lib/app-launch-theme";
import { APP_COLOR_THEME_STORAGE_KEY } from "@/lib/app-color-theme";


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
const htmlBootstrap = `try{var d=document.documentElement;var dark=localStorage.getItem('${DARK_MODE_LOCAL_STORAGE_KEY}')==='1';var themes={emerald:['${APP_LAUNCH_BG_LIGHT}','${APP_LAUNCH_BG_DARK}','${APP_THEME_COLOR_DARK}'],sapphire:['#F5F7FF','#07152f','#123f7a'],amethyst:['#F8F5FF','#1c1033','#4c277a'],coral:['#FFF6F5','#2a1119','#74293d']};var c=localStorage.getItem('${APP_COLOR_THEME_STORAGE_KEY}');if(!themes[c])c='emerald';d.dataset.colorTheme=c;if(localStorage.getItem('privacyBlur')==='1')d.classList.add('privacy-blur');var palette=themes[c];if(dark){d.classList.add('dark');d.style.backgroundColor=palette[1]}else{d.style.backgroundColor=palette[0]}var theme=dark?palette[2]:palette[0];d.style.colorScheme=dark?'dark':'light';var m=document.querySelector('meta[name="theme-color"]');if(m){m.content=theme}else{m=document.createElement('meta');m.name='theme-color';m.content=theme;document.head.appendChild(m)}}catch(e){}`;

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
        className="font-sans text-ink-900 transition-colors duration-200 dark:text-ink-50"
        suppressHydrationWarning
      >
        <div className="app-page-background" aria-hidden />
        <AppLaunchOverlay />
        <div className="app-shell relative z-[1] min-h-dvh min-h-[100dvh] bg-transparent">{children}</div>
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
