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
  // BUG FIX: sw.js itself was served with default caching, so browsers
  // could keep running an old service worker script (which controls the
  // caching bug fixed in public/sw.js) even after a redeploy, delaying
  // when the fix above actually takes effect for returning visitors.
  // no-cache forces the browser to always revalidate sw.js with the
  // server before using it, so an updated service worker is picked up on
  // the very next visit instead of whenever the browser feels like
  // re-checking.
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [{ key: "Cache-Control", value: "no-cache, must-revalidate" }],
      },
    ];
  },
};

export default nextConfig;
