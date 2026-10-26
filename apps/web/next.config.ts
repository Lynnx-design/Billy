import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@billy/shared"],
  reactStrictMode: true,
  env: {
    // On Render the public address is known automatically.
    NEXT_PUBLIC_WEB_URL: process.env.NEXT_PUBLIC_WEB_URL ?? process.env.RENDER_EXTERNAL_URL ?? "http://localhost:3000",
  },
  // In the single-service deploy the API runs next to the web app; the browser reaches it at /api.
  async rewrites() {
    const target = process.env.API_PROXY_TARGET;
    return target ? [{ source: "/api/:path*", destination: `${target}/:path*` }] : [];
  },
};

export default nextConfig;
