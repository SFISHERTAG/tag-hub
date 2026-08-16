import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * Standalone output traces the exact server files needed and copies them,
   * plus a minimal node_modules, into `.next/standalone`. The runtime image
   * then carries no package manager, no lockfile and no dev dependencies —
   * a few hundred MB smaller than shipping the repo, and a much smaller
   * surface for anything to be pulled in that was never meant to run in
   * production.
   */
  output: "standalone",
};

export default nextConfig;
