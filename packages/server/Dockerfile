FROM node:20-alpine AS builder
WORKDIR /app
RUN npm install -g pnpm
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/core/package.json ./packages/core/
COPY packages/server/package.json ./packages/server/
RUN pnpm install --frozen-lockfile
COPY packages/core ./packages/core
COPY packages/server ./packages/server
RUN pnpm --filter @tsmobiledevice/core build
RUN pnpm --filter @tsmobiledevice/server build

FROM node:20-alpine
WORKDIR /app
RUN npm install -g pnpm
COPY --from=builder /app/packages/server/dist ./dist
COPY --from=builder /app/packages/server/package.json ./
COPY --from=builder /app/packages/core/dist ./node_modules/@tsmobiledevice/core/dist
COPY --from=builder /app/packages/core/package.json ./node_modules/@tsmobiledevice/core/
RUN pnpm install --prod
EXPOSE 3000
CMD ["node", "dist/main.js"]
