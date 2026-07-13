import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pin the workspace root to this app. A stray package-lock.json in the repo
  // root otherwise makes Next infer ../ as the root, which breaks tailwindcss
  // resolution in dev.
  turbopack: {
    root: path.join(__dirname),
  },
};

export default nextConfig;
