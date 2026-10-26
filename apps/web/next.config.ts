import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@billy/shared"],
  reactStrictMode: true,
};

export default nextConfig;
