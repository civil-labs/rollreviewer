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

# Install workspace dependencies
RUN pnpm install --frozen-lockfile

# Copy source trees
COPY packages/contracts ./packages/contracts
COPY apps/backend ./apps/backend

# Build contracts followed by backend
RUN pnpm --filter @rollreviewer/contracts build
RUN pnpm --filter @rollreviewer/backend build

# Create isolated production deployment bundle
RUN pnpm deploy --filter @rollreviewer/backend --prod /app/deploy

# Stage 2: Production runtime
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

# Copy self-contained deployed application
COPY --from=builder /app/deploy ./

EXPOSE 3001

CMD ["node", "dist/index.js"]
