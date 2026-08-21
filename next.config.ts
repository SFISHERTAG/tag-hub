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

  /**
   * Next no longer renders pages. It is an API host that also serves the
   * Angular bundle same-origin, which is not incidental: `hub_session` is
   * httpOnly and SameSite=lax and only survives that topology.
   *
   * `afterFiles` runs after Next's own filesystem routes and after `public/`,
   * so this cannot shadow anything real. An `/api/**` request resolves to its
   * route handler first; a request for a hashed bundle asset resolves out of
   * `public/` first; everything left is a client-side route and gets the SPA
   * shell, which is what lets Angular own its own routing on a hard refresh
   * rather than 404ing.
   */
  async rewrites() {
    return {
      beforeFiles: [],
      afterFiles: [{ source: "/:path*", destination: "/index.html" }],
      fallback: [],
    };
  },
};

export default nextConfig;
