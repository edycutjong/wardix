import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  // Removed outputFileTracingRoot: path.join(process.cwd(), "../")
  // Vercel breaks if this points outside the repo root for standalone deployments.
};

export default nextConfig;
