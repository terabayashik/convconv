# Build stage for frontend
FROM oven/bun:1.1.38 AS frontend-builder

WORKDIR /app

# Copy monorepo structure
COPY package.json bun.lockb ./
COPY frontend/package.json ./frontend/
COPY backend/package.json ./backend/
COPY shared/package.json ./shared/

# Install dependencies
RUN bun install --frozen-lockfile

# Copy source code
COPY shared ./shared
COPY frontend ./frontend

# Build frontend
WORKDIR /app/frontend
RUN bun run build

# Production stage
FROM oven/bun:1.1.38

# Install FFmpeg
RUN apt-get update && \
    apt-get install -y ffmpeg && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy monorepo structure
COPY package.json bun.lockb ./
COPY frontend/package.json ./frontend/
COPY backend/package.json ./backend/
COPY shared/package.json ./shared/

# Install production dependencies
RUN bun install --frozen-lockfile --production

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

# Start backend server
WORKDIR /app/backend
CMD ["bun", "run", "main.ts"]