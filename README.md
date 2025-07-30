# ConvConv - FFmpeg Converter Service

[![Docker Build](https://github.com/terabayashik/convconv/actions/workflows/docker-publish.yml/badge.svg)](https://github.com/terabayashik/convconv/actions/workflows/docker-publish.yml)
[![Docker Image Version](https://img.shields.io/docker/v/terabayashik/convconv?label=ghcr.io)](https://github.com/terabayashik/convconv/pkgs/container/convconv)

A web-based FFmpeg conversion service with a modern UI, built with Bun, React, and TypeScript.

## Features

- 🎥 Video and audio file conversion using FFmpeg
- 📊 Real-time conversion progress via WebSocket
- 🎨 Modern React UI with Mantine components
- 🚀 Fast backend powered by Bun runtime
- 🐳 Docker support with health checks
- 🔄 Multi-platform support (linux/amd64, linux/arm64)

## Quick Start with Docker

### Temporary Usage (Auto-cleanup)

For one-time use without leaving containers or volumes:

```bash
# Run temporarily with auto-cleanup on exit
docker run --rm -it \
  -p 3000:3000 \
  -v $(pwd)/uploads:/tmp/uploads \
  ghcr.io/terabayashik/convconv:latest

# Or run in background with auto-cleanup on stop
docker run --rm -d \
  -p 3000:3000 \
  -v $(pwd)/uploads:/tmp/uploads \
  --name convconv-temp \
  ghcr.io/terabayashik/convconv:latest

# Stop and auto-remove
docker stop convconv-temp
```

### Persistent Usage

```bash
# Pull the latest image
docker pull ghcr.io/terabayashik/convconv:latest

# Run with docker-compose
docker-compose -f docker-compose.ghcr.yml up -d

# Or run directly with docker
docker run -d \
  -p 3000:3000 \
  -v $(pwd)/uploads:/app/backend/uploads \
  --name convconv \
  ghcr.io/terabayashik/convconv:latest
```

### Building Locally

```bash
# Clone the repository
git clone https://github.com/terabayashik/convconv.git
cd convconv

# Build and run with docker-compose
docker-compose up -d --build
```

## Development Setup

### Prerequisites

- Bun 1.x
- FFmpeg
- Node.js 18+ (for frontend build only)

### Installation

```bash
# Install dependencies
bun install

# Start backend development server
bun backend:dev

# Start frontend development server (in another terminal)
bun frontend:dev
```

## Configuration

The application can be configured via `config.json`. See `backend/config.example.json` for available options.

### Docker Configuration

- Port: 3000 (customizable via environment variable)
- Volumes:
  - `/app/backend/uploads` - Upload directory
  - `/app/backend/config.json` - Optional custom configuration

## Architecture

- **Frontend**: React + TypeScript + Vite + Mantine UI
- **Backend**: Bun + Hono framework
- **Shared**: Common types and Zod schemas
- **Container**: Multi-stage Docker build with health checks

## License

[Add your license here]