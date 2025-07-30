# ConvConv - FFmpeg Converter Service

[![Docker Build](https://github.com/YOUR_USERNAME/convconv/actions/workflows/docker-publish.yml/badge.svg)](https://github.com/YOUR_USERNAME/convconv/actions/workflows/docker-publish.yml)
[![Docker Image Version](https://img.shields.io/docker/v/YOUR_USERNAME/convconv?label=ghcr.io)](https://github.com/YOUR_USERNAME/convconv/pkgs/container/convconv)

A web-based FFmpeg conversion service with a modern UI, built with Bun, React, and TypeScript.

## Features

- 🎥 Video and audio file conversion using FFmpeg
- 📊 Real-time conversion progress via WebSocket
- 🎨 Modern React UI with Mantine components
- 🚀 Fast backend powered by Bun runtime
- 🐳 Docker support with health checks
- 🔄 Multi-platform support (linux/amd64, linux/arm64)

## Quick Start with Docker

### Using GitHub Container Registry

```bash
# Pull the latest image
docker pull ghcr.io/YOUR_USERNAME/convconv:latest

# Run with docker-compose
GITHUB_USERNAME=YOUR_USERNAME docker-compose -f docker-compose.ghcr.yml up -d

# Or run directly with docker
docker run -d \
  -p 3000:3000 \
  -v $(pwd)/uploads:/app/backend/uploads \
  --name convconv \
  ghcr.io/YOUR_USERNAME/convconv:latest
```

### Building Locally

```bash
# Clone the repository
git clone https://github.com/YOUR_USERNAME/convconv.git
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