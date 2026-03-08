# Multi-stage Dockerfile for SvelteKit (adapter-node)
# Builder stage
FROM node:25-alpine AS builder
WORKDIR /app

# Install deps (use package-lock if present)
COPY package.json package-lock.json ./
RUN npm ci --unsafe-perm

# Copy source and build
COPY . .
RUN npm run build

# Production stage
FROM node:25-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV BODY_SIZE_LIMIT=1G

# Copy only production deps
COPY package.json package-lock.json ./
RUN npm ci --only=production --unsafe-perm

# Copy built app from builder
COPY --from=builder /app/build ./build
COPY --from=builder /app/static ./static

# Expose port and run
EXPOSE 3000
CMD ["node", "build"]
