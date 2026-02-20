# ── Stage 1: build ────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Install deps first (better layer caching)
COPY package.json package-lock.json* ./
RUN npm ci

COPY . .

# next.config.ts has output: "standalone"
RUN npm run build

# ── Stage 2: run ──────────────────────────────────────────────────────────────
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
# Bind to all interfaces so Docker port mapping works
ENV HOSTNAME=0.0.0.0
ENV PORT=3000
# DATA_DIR is overridden at runtime via docker-compose environment
ENV DATA_DIR=/data

# Copy standalone output
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

EXPOSE 3000

CMD ["node", "server.js"]
