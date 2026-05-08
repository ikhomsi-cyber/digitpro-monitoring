import "./globals.css";
import type { Metadata } from "next";
import { Inter, Plus_Jakarta_Sans } from "next/font/google";
import { Toaster } from "sonner";

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

/** Inline script that applies the privacy class before paint to avoid flicker. */
const privacyBootstrap = `try{if(localStorage.getItem('privacyBlur')==='1'){document.documentElement.classList.add('privacy-blur')}}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <head>
        <script dangerouslySetInnerHTML={{ __html: privacyBootstrap }} />
      </head>
      <body className={`${inter.variable} ${display.variable} font-sans`}>
        <div className="min-h-dvh">{children}</div>
        <Toaster
          position="top-center"
          closeButton
          toastOptions={{
            classNames: {
              toast: "rounded-2xl border border-ink-200 bg-white shadow-card",
              title: "font-semibold text-ink-900",
              description: "text-ink-600"
            }
          }}
        />
      </body>
    </html>
  );
}
