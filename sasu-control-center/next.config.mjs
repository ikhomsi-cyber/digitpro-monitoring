/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  /** Évite erreurs de chunk / `.call` avec certains builds Recharts + App Router. */
  transpilePackages: ["recharts"],
  experimental: {
    serverActions: {
      // CSV imports can exceed the default 1MB limit.
      bodySizeLimit: "10mb"
    }
  }
};

export default nextConfig;

