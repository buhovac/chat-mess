# PRODUCTION image — this is what Railway (or any Docker-based host) builds
# and runs. Build context = repo root. It compiles the React client and serves
# it as static files from the same Express process that runs the API +
# Socket.IO, so there is only ONE service to deploy.
#
# Local dev does NOT use this file — see docker-compose.yml + */Dockerfile.dev.

# ---- stage 1: build the React client ----
FROM node:22-bookworm-slim AS client-build
WORKDIR /client
COPY client/package*.json ./
RUN npm ci
COPY client/ ./
RUN npm run build   # -> /client/dist

# ---- stage 2: install server deps + generate the Prisma client ----
FROM node:22-bookworm-slim AS server-deps
RUN apt-get update && apt-get install -y --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY server/package*.json ./
COPY server/prisma ./prisma
RUN npm ci --omit=dev && npx prisma generate

# ---- stage 3: final runtime image ----
FROM node:22-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/* \
    && useradd --create-home appuser
WORKDIR /app
ENV NODE_ENV=production

COPY --from=server-deps /app/node_modules ./node_modules
COPY server/ ./
COPY --from=client-build /client/dist ./public

USER appuser
EXPOSE 3001
# "npm start" = prisma migrate deploy && node src/index.js  (see server/package.json)
CMD ["npm", "start"]
