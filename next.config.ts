import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Live coordination data is request-driven mock or API state.
  // Skip Cache Components so pages are not forced through a static shell.
  cacheComponents: false,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
