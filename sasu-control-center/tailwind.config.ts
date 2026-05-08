import type { Config } from "tailwindcss";

/**
 * Apple-inspired design system.
 * - Two-tone neutral surfaces (#fff / #f5f5f7)
 * - SF Pro stack via -apple-system, with Inter as the cross-platform fallback
 * - Apple CTA blue (#0071E3) as the only accent
 * - Almost-flat shadows, generous whitespace, subtle borders
 */
const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          '"SF Pro Text"',
          "-apple-system",
          "BlinkMacSystemFont",
          '"Helvetica Neue"',
          "var(--font-sans)",
          "Helvetica",
          "Arial",
          "sans-serif"
        ],
        display: [
          '"SF Pro Display"',
          "-apple-system",
          "BlinkMacSystemFont",
          '"Helvetica Neue"',
          "var(--font-display)",
          "Helvetica",
          "Arial",
          "sans-serif"
        ]
      },
      colors: {
        /** Apple CTA blue scale */
        brand: {
          50: "#E6F2FF",
          100: "#CCE5FF",
          200: "#99CAFF",
          300: "#66B0FF",
          400: "#3395FB",
          500: "#0071E3",
          600: "#0066CC",
          700: "#0055AA",
          800: "#004488",
          900: "#003366"
        },
        /** Neutral / surfaces tuned to Apple's web palette */
        ink: {
          50: "#FBFBFD",
          100: "#F5F5F7", // signature Apple section bg
          200: "#E8E8ED",
          300: "#D2D2D7", // borders
          400: "#A1A1A6",
          500: "#86868B", // subtle text
          600: "#6E6E73", // muted text
          700: "#424245",
          800: "#2C2C2E",
          900: "#1D1D1F", // primary text
          950: "#000000"
        }
      },
      backgroundImage: {
        "brand-gradient": "linear-gradient(180deg, #0071E3 0%, #0066CC 100%)"
      },
      boxShadow: {
        card: "0 1px 2px rgba(0,0,0,0.04), 0 4px 16px rgba(0,0,0,0.04)",
        glass: "0 1px 2px rgba(0,0,0,0.05), 0 8px 24px rgba(0,0,0,0.06)",
        ring: "0 0 0 4px rgba(0,113,227,0.18)"
      },
      borderRadius: {
        xl: "0.875rem",
        "2xl": "1.125rem",
        "3xl": "1.5rem"
      },
      keyframes: {
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" }
        },
        floatIn: {
          "0%": { opacity: "0", transform: "translateY(6px)" },
          "100%": { opacity: "1", transform: "translateY(0)" }
        }
      },
      animation: {
        shimmer: "shimmer 1.4s linear infinite",
        floatIn: "floatIn 0.4s ease-out both"
      },
      letterSpacing: {
        tightest: "-0.02em",
        "apple-tight": "-0.022em"
      }
    }
  },
  plugins: []
};

export default config;
