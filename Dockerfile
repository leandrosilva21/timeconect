FROM node:20-alpine AS builder
WORKDIR /app
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ARG BACKEND_URL
ENV BACKEND_URL=$BACKEND_URL
COPY package.json package-lock.json* ./
RUN --mount=type=cache,id=minutor-npm,target=/root/.npm \
    npm ci --cache /root/.npm
COPY . .
RUN --mount=type=cache,id=minutor-next,target=/app/.next/cache \
    npm run build

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/package.json ./
COPY --from=builder /app/package-lock.json* ./
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/next.config.ts ./
EXPOSE 3000
CMD ["npm", "start"]
