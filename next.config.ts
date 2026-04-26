import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      { source: "/benchmark", destination: "/benchmark/index.html" },
    ];
  },
};

export default nextConfig;
