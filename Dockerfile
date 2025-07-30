# Build stage for frontend
# Uses Bun base image but installs Node.js for Vite compatibility
# This is necessary because Vite uses Rollup which has platform-specific native bindings
FROM oven/bun:1 AS frontend-builder

# Install Node.js for Vite/Rollup compatibility
RUN apt-get update && \
    apt-get install -y curl && \
    curl -fsSL https://deb.nodesource.com/setup_18.x | bash - && \
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
RUN bun install

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
RUN apt-get update && \
    apt-get install -y ffmpeg curl && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy monorepo structure and lock file
COPY package.json bun.lock ./
COPY frontend/package.json ./frontend/
COPY backend/package.json ./backend/
COPY shared/package.json ./shared/

# Install production dependencies
RUN bun install --production

# Copy source code
COPY shared ./shared
COPY backend ./backend

# Copy built frontend from builder stage
COPY --from=frontend-builder /app/frontend/dist ./backend/public

# Create uploads directory
RUN mkdir -p ./backend/uploads

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
CMD ["bun", "src/main.ts"]
