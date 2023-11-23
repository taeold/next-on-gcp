FROM node:18-alpine AS base

FROM base AS runner
WORKDIR /app

ARG BUILD_ID
ENV NODE_ENV=production \
    BUILD_ID=$BUILD_ID \
    NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

RUN mkdir .next
RUN chown nextjs:nodejs .next

COPY --chown=nextjs:nodejs .next/standalone ./
COPY --chown=nextjs:nodejs .next/static ./.next/static

USER nextjs
ENV HOSTNAME "0.0.0.0"
CMD ["node", "server.js"]
