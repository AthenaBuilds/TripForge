# syntax=docker/dockerfile:1
# Build from the repo root:  docker build -f server/Dockerfile -t tripforge-api .

# ---------- build: install, generate Prisma client, compile ----------
FROM node:24-alpine AS build
# bcrypt compiles a native addon on Alpine (musl).
RUN apk add --no-cache python3 make g++
WORKDIR /app

COPY package.json package-lock.json ./
COPY shared/package.json shared/
COPY server/package.json server/
# postinstall runs `prisma generate`, which needs the schema and config.
COPY server/prisma server/prisma
COPY server/prisma.config.ts server/
RUN npm ci -w @tripforge/server -w @tripforge/shared --include-workspace-root

COPY tsconfig.base.json ./
COPY shared shared
COPY server server
RUN npm run build -w @tripforge/server

# Production dependencies only (keeps the compiled bcrypt addon and the Prisma CLI for migrations).
RUN npm prune --omit=dev

# ---------- runtime ----------
FROM node:24-alpine
ENV NODE_ENV=production PORT=3000
WORKDIR /app

COPY --from=build --chown=node:node /app/package.json ./
COPY --from=build --chown=node:node /app/node_modules node_modules
# shared is loaded as raw .ts via Node 24 type stripping (no build step).
COPY --from=build --chown=node:node /app/shared shared
COPY --from=build --chown=node:node /app/server/package.json server/
# npm keeps some server deps (e.g. the Prisma CLI) under server/node_modules instead of hoisting them.
COPY --from=build --chown=node:node /app/server/node_modules server/node_modules
COPY --from=build --chown=node:node /app/server/dist server/dist
COPY --from=build --chown=node:node /app/server/prisma server/prisma
COPY --from=build --chown=node:node /app/server/prisma.config.ts server/

USER node
WORKDIR /app/server
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/health >/dev/null || exit 1

# Migrations run as a one-off ECS task with the command overridden to:
#   npx prisma migrate deploy
CMD ["node", "dist/index.js"]
