/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
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

