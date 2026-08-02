import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  // PERF: drops the `X-Powered-By: Next.js` response header — trivial, but
  // free (one less header on every response).
  poweredByHeader: false,
  // PERF: these packages ship many small modules; without this, importing
  // one icon/chart/component from them can pull in more than necessary.
  // Next.js rewrites the imports to only include what's actually used,
  // on top of the route-level code-splitting done via next/dynamic.
  experimental: {
    optimizePackageImports: [
      "lucide-react",
      "recharts",
      "framer-motion",
      "react-markdown",
      "@radix-ui/react-icons",
    ],
  },
};

export default nextConfig;
