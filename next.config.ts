import type { NextConfig } from "next";

// Static export: the app is a pure client of the Base44 backend (auth, entities,
// realtime sockets, storage and the `agentChat` function). The same `out/`
// folder is hosted on the web AND bundled into the Android APK by Capacitor, so
// the mobile app works without depending on any separately hosted web server.
const nextConfig: NextConfig = {
  reactStrictMode: true,
  output: "export",
  trailingSlash: true,
  images: { unoptimized: true },
  experimental: {
    // Constrain build parallelism for small containers / CI runners.
    cpus: 1,
    workerThreads: false,
  },
};

export default nextConfig;
