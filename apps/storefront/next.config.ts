import path from "node:path"
import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Pin the tracing root to the monorepo root so builds are deterministic
  // even when unrelated lockfiles exist elsewhere on the machine.
  outputFileTracingRoot: path.resolve(process.cwd(), "../.."),
  experimental: {
    // Product image uploads travel through server actions (multipart FormData);
    // the default 1 MB limit is far below the API's 5 MB per-image ceiling.
    serverActions: {
      bodySizeLimit: "50mb",
    },
  },
  // Product images are served from operator-configured hosts (a CDN or the
  // store's own storage), so any HTTPS/HTTP host is allowed. Restrict this to
  // known hostnames per deployment if stricter egress control is required.
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**" },
      { protocol: "http", hostname: "**" },
    ],
  },
}

export default nextConfig
