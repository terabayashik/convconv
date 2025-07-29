# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Structure

This is a monorepo with three main components:
- `backend/` - Bun-based backend service for FFmpeg execution
- `frontend/` - React + TypeScript + Vite frontend application
- `shared/` - Shared types and schemas using Zod validation

## Development Commands

### Backend
- **Run the backend**: `cd backend && bun run src/main.ts`
- **Install dependencies**: `cd backend && bun install`
- **Lint/format code**: `cd backend && bun run check`

### Frontend
- **Start dev server**: `cd frontend && bun dev`
- **Build for production**: `cd frontend && bun build`
- **Preview production build**: `cd frontend && bun preview`
- **Install dependencies**: `cd frontend && bun install`
- **Lint/format code**: `cd frontend && bun run check`

### Workspace Commands (from root)
- **Install all dependencies**: `bun install`
- **Run all checks**: `bun run check`
- **Start backend**: `bun backend:dev`
- **Start frontend**: `bun frontend:dev`

## Tech Stack & Key Information

### Backend
- **Runtime**: Bun (not Node.js) - see backend/CLAUDE.md for Bun-specific guidance
- **TypeScript**: Direct execution with Bun, no compilation needed
- **Code formatting**: Biome with specific rules (120 char line width, spaces not tabs)
- **FFmpeg integration**: Executes FFmpeg commands for media conversion

### Frontend
- **Framework**: React 19 with TypeScript
- **Build tool**: Vite
- **UI Library**: Mantine (@mantine/core)
- **Styling**: PostCSS with Mantine preset
- **Code formatting**: Biome (same config as backend)

### Shared
- **Validation**: Zod for runtime schema validation
- **Types**: Shared TypeScript types for API contracts
- **No barrel exports**: Direct imports only (e.g., `@convconv/shared/types/api`)

## Code Style & Standards

Both frontend and backend use Biome for linting and formatting with these key rules:
- Line width: 120 characters
- Indent style: Spaces (not tabs)
- Use const assertions where possible
- Use self-closing elements for empty tags
- Initialize enums explicitly
- No unused template literals
- Single var declarator pattern
- **Arrow functions only** - no function declarations
- **No barrel files** - use direct imports

## Import Patterns

```typescript
// ✅ Good - direct imports
import { ConvertRequest } from "@convconv/shared/types/api";
import { FFmpegCommand } from "@convconv/shared/types/ffmpeg";
import { ConvertRequestSchema } from "@convconv/shared/schemas/api";

// ❌ Bad - barrel imports
import { ConvertRequest, FFmpegCommand } from "@convconv/shared";
```

## Configuration

The backend uses a `config.json` file for runtime configuration. This file is:
- **NOT included in git** (listed in .gitignore)
- **Auto-generated on first run** from `config.example.json` or with defaults
- **Customizable** for each environment

To customize configuration:
1. Run the backend once to generate `config.json`
2. Edit `backend/config.json` as needed
3. Changes take effect on next restart

## Important Notes

1. **Always use Bun** instead of npm/yarn/pnpm for package management
2. **Run `bun run check` before committing** to ensure code meets style standards
3. **Backend uses Bun's built-in features** - avoid Node.js-specific modules when possible
4. **Frontend uses Vite** for development and building - hot module replacement is enabled by default
5. **Use Zod schemas** for all API payloads and external data validation
6. **No function declarations** - always use arrow functions: `const myFunc = () => {}`
7. **Config files** - `config.json` is environment-specific and not tracked in git