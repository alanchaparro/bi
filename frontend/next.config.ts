import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@heroui/react", "@heroui/styles"],
  output: "standalone",
};

export default nextConfig;
