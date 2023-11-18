FROM node:18-alpine AS base

FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ARG BUILD_ID
ARG FIREBASE_CONFIG
ENV FIREBASE_CONFIG=$FIREBASE_CONFIG \
    BUILD_ID=$BUILD_ID \
    NEXT_TELEMETRY_DISABLED=1
RUN npm run build


FROM base AS runner
WORKDIR /app

ARG BUILD_ID
ENV NODE_ENV=production \
    BUILD_ID=$BUILD_ID \
    NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public

RUN mkdir .next
RUN chown nextjs:nodejs .next

COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
USER nextjs
ENV HOSTNAME "0.0.0.0"
CMD ["node", "server.js"]
