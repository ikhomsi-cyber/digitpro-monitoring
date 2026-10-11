/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  distDir: process.env.NEXT_BUILD_DIR || ".next",
  async headers() {
    return [{ source: "/api/:path*", headers: [{ key: "Cache-Control", value: "private, no-store" }] }, { source: "/:path*", headers: [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "X-Frame-Options", value: "DENY" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
      { key: "Content-Security-Policy", value: "frame-ancestors 'none'; base-uri 'self'; object-src 'none'" }
    ] }];
  },
  /** Évite erreurs de chunk / `.call` avec certains builds Recharts + App Router. */
  transpilePackages: ["recharts"],
  webpack(config) {
    /**
     * Masque les warnings internes du cache Webpack du type
     * "Serializing big strings ... impacts deserialization performance".
     * Ils ne signalent pas une erreur applicative et polluent fortement le serveur dev.
     */
    config.infrastructureLogging = {
      ...config.infrastructureLogging,
      level: "error"
    };
    return config;
  },
  experimental: {
    serverActions: {
      // CSV imports can exceed the default 1MB limit.
      bodySizeLimit: "4mb"
    }
  }
};

export default nextConfig;

