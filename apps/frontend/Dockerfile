# Stage 1: Build the frontend application
FROM node:20-alpine AS builder

# Enable Corepack and prepare pnpm
RUN corepack enable && corepack prepare pnpm@9.15.4 --activate

WORKDIR /app

# Copy monorepo manifests
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml nx.json tsconfig.json ./
COPY packages/contracts/package.json ./packages/contracts/
COPY apps/backend/package.json ./apps/backend/
COPY apps/frontend/package.json ./apps/frontend/

# Install workspace dependencies
RUN pnpm install --frozen-lockfile

# Copy source trees
COPY packages/contracts ./packages/contracts
COPY apps/backend ./apps/backend
COPY apps/frontend ./apps/frontend

# Build contracts followed by frontend
RUN pnpm --filter @rollreviewer/contracts build
RUN pnpm --filter @rollreviewer/frontend build

# Stage 2: Serve using Nginx
FROM nginx:alpine

# Copy custom Nginx configuration with reverse proxy for /api and SPA fallback
COPY apps/frontend/nginx.conf /etc/nginx/conf.d/default.conf

# Copy compiled static assets from builder stage
COPY --from=builder /app/apps/frontend/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
