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
   * so a request for a real endpoint reaches its handler and a hashed bundle
   * asset resolves out of `public/`. Everything left is a client-side route and
   * gets the SPA shell, which is what lets Angular own its routing on a hard
   * refresh rather than 404ing.
   *
   * `/api` is excluded explicitly, and the reason is not symmetry. `afterFiles`
   * only runs for paths nothing else matched, so the exclusion changes nothing
   * for endpoints that exist — it changes what happens to one that does not. A
   * blanket `/:path*` handed every misspelled, unbuilt or since-removed API path
   * the SPA shell under `200 text/html`. A client asking for JSON got a
   * document, a monitor asking for a health check got a success, and a typo in a
   * fetch URL looked like a parsing bug rather than a wrong address. With the
   * exclusion those 404, which is both true and debuggable.
   */
  async rewrites() {
    return {
      beforeFiles: [],
      afterFiles: [{ source: "/:path((?!api/).*)", destination: "/index.html" }],
      fallback: [],
    };
  },
};

export default nextConfig;
