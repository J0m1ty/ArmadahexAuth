# Built by .github/workflows/docker.yml and pushed to ghcr.io/j0m1ty/auth.
FROM node:24-slim@sha256:dc26ae92c9fb15cf6b1d63e20f0944b2efe0f115b20e00be48fb23fceb061c54 AS build
# git for the uWebSockets.js GitHub dependency, build tools in case
# better-sqlite3 has no prebuilt binary for this Node version
RUN apt-get update && apt-get install -y --no-install-recommends git ca-certificates python3 make g++ \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

FROM node:24-slim@sha256:dc26ae92c9fb15cf6b1d63e20f0944b2efe0f115b20e00be48fb23fceb061c54
ENV NODE_ENV=production DB_PATH=/data/json.sqlite PORT=3030
WORKDIR /app
COPY --from=build /app/node_modules ./node_modules
COPY package.json tsconfig.json blacklist.txt ./
COPY src ./src
# /data is where the database lives; mount a volume or host folder there
RUN install -d -o node -g node /data
USER node
EXPOSE 3030
CMD ["node", "--import", "tsx", "src/index.ts"]
