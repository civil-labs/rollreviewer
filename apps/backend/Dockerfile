# Stage 1: Build the backend application
FROM node:20-alpine AS builder

# Enable Corepack and prepare pnpm
RUN corepack enable && corepack prepare pnpm@9.15.4 --activate

WORKDIR /app

# Copy monorepo manifests
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml nx.json tsconfig.json ./
COPY packages/contracts/package.json ./packages/contracts/
COPY apps/backend/package.json ./apps/backend/
COPY apps/frontend/package.json ./apps/frontend/

# Install workspace dependencies with BuildKit cache
RUN --mount=type=cache,id=pnpm-store,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile

# Copy source trees
COPY packages/contracts ./packages/contracts
COPY apps/backend ./apps/backend

# Build backend using Nx (automatically resolves dependency graph and builds @rollreviewer/contracts)
RUN --mount=type=cache,id=nx-cache,target=/app/.nx/cache \
    pnpm exec nx build @rollreviewer/backend

# Create isolated production deployment bundle with pnpm
RUN pnpm deploy --filter @rollreviewer/backend --prod /app/deploy

# Stage 2: Production runtime
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

# Copy self-contained deployed application
COPY --from=builder /app/deploy ./

EXPOSE 3001

CMD ["node", "dist/index.js"]
