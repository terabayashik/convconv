# Build stage for frontend
# Uses Bun base image but installs Node.js for Vite compatibility
# This is necessary because Vite uses Rollup which has platform-specific native bindings
FROM oven/bun:1 AS frontend-builder

# Build arguments for cache invalidation
ARG BUILDKIT_INLINE_CACHE=1

# Install Node.js for Vite/Rollup compatibility (multi-platform aware)
RUN apt-get update && \
    apt-get install -y curl && \
    if [ "$(dpkg --print-architecture)" = "amd64" ]; then \
        curl -fsSL https://deb.nodesource.com/setup_18.x | bash -; \
    else \
        curl -fsSL https://deb.nodesource.com/setup_18.x | bash -; \
    fi && \
    apt-get install -y nodejs && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy monorepo structure
COPY package.json bun.lock ./
COPY frontend/package.json ./frontend/
COPY backend/package.json ./backend/
COPY shared/package.json ./shared/

# Install dependencies with Bun (handles workspace:* protocol)
RUN bun install --frozen-lockfile

# Copy source code
COPY shared ./shared
COPY frontend ./frontend

# Build frontend
WORKDIR /app/frontend
ENV NODE_ENV=production
# Run the build script which includes TypeScript compilation and Vite build
RUN bun run build

# Production stage
FROM oven/bun:1

# Install FFmpeg and curl for healthcheck
# Use --no-install-recommends to reduce image size
RUN apt-get update && \
    apt-get install -y --no-install-recommends ffmpeg curl ca-certificates && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy monorepo structure and lock file
COPY package.json bun.lock ./
COPY frontend/package.json ./frontend/
COPY backend/package.json ./backend/
COPY shared/package.json ./shared/

# Install production dependencies
# Use frozen lockfile to ensure reproducible builds
RUN bun install --production --frozen-lockfile

# Copy source code
COPY shared ./shared
COPY backend ./backend

# Copy built frontend from builder stage
COPY --from=frontend-builder /app/frontend/dist ./backend/public

# Create necessary directories
RUN mkdir -p ./backend/uploads ./backend/outputs

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3000

# Expose port
EXPOSE 3000

# Create a Docker-specific config that binds to all interfaces
RUN echo '{\
  "server": {\
    "port": 3000,\
    "host": "0.0.0.0"\
  },\
  "storage": {\
    "uploadDir": "./uploads",\
    "outputDir": "./outputs",\
    "retentionHours": 24,\
    "cleanupIntervalMinutes": 60\
  },\
  "ffmpeg": {\
    "defaultThreads": 4\
  }\
}' > /app/backend/config.json

# Start backend server
WORKDIR /app/backend

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD curl -f http://localhost:3000/api/health || exit 1

CMD ["bun", "src/main.ts"]
