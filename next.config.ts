import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**.supabase.co" },
      { protocol: "https", hostname: "**.openai.com" },
      { protocol: "https", hostname: "oaidalleapiprodscus.blob.core.windows.net" },
    ],
  },
  experimental: {
    // Keep server bundles lean for the streaming route.
    serverActions: { bodySizeLimit: "4mb" },
    // Constrain build parallelism — the default (one worker per CPU) can
    // exhaust memory on small containers.
    cpus: 1,
    workerThreads: false,
  },
};

export default nextConfig;
