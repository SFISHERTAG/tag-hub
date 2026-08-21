# syntax=docker/dockerfile:1

# ---------- deps ----------
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
# `npm ci` from the lockfile, so a build is reproducible and cannot silently
# pick up a newer transitive dependency between the local build and the one
# Cloud Build runs.
RUN npm ci

# ---------- web deps ----------
# The Angular workspace has its own lockfile and its own node_modules. Since
# the cutover, `npm run build` builds the Angular bundle before `next build`,
# so these are build-time requirements rather than an optional extra.
#
# A separate stage on purpose: web/ dependencies change on a different cadence
# from the host's, and keeping them apart means editing one lockfile does not
# invalidate the other's cached layer.
FROM node:24-alpine AS web-deps
WORKDIR /app/web
COPY web/package.json web/package-lock.json ./
RUN npm ci

# ---------- build ----------
FROM node:24-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=web-deps /app/web/node_modules ./web/node_modules
COPY . .

# NEXT_PUBLIC_* are inlined into the client bundle at build time, so they must
# be present here rather than at runtime. These are publishable by design —
# Firebase web config is not a secret, it is the public identifier of the
# project, and access is governed by Firebase rules and the session cookie.
# Nothing secret belongs in this list.
ARG NEXT_PUBLIC_FIREBASE_API_KEY
ARG NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
ARG NEXT_PUBLIC_FIREBASE_PROJECT_ID
ENV NEXT_PUBLIC_FIREBASE_API_KEY=$NEXT_PUBLIC_FIREBASE_API_KEY \
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=$NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN \
    NEXT_PUBLIC_FIREBASE_PROJECT_ID=$NEXT_PUBLIC_FIREBASE_PROJECT_ID \
    NEXT_TELEMETRY_DISABLED=1

RUN npm run build

# ---------- runtime ----------
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=8080

# Non-root. Cloud Run does not require it, but a container that never needs to
# write outside /tmp has no reason to run as root, and this costs nothing.
RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001

# `standalone` already contains the traced server and its minimal node_modules.
# `static` and `public` are not traced and must be copied alongside it — miss
# either and the app boots fine but serves no CSS and no logo.
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

USER nextjs
EXPOSE 8080

# Bind all interfaces: Cloud Run routes to the container's external address,
# and a server listening only on 127.0.0.1 fails its health check with no
# obvious cause.
ENV HOSTNAME=0.0.0.0

CMD ["node", "server.js"]
