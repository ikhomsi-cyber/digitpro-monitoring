/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  /**
   * Le lint tourne en local (`npm run lint`) et en CI, pas pendant le build de
   * production : évite l'échec de chargement de « next/core-web-vitals » sur Vercel
   * (ESLint 9 + config legacy) qui polluait les logs sans bloquer le déploiement.
   */
  eslint: {
    ignoreDuringBuilds: true
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
      bodySizeLimit: "10mb"
    }
  }
};

export default nextConfig;

