# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Key Commands

### Development

- `bun dev` - Start development server with Next.js Turbo mode (http://localhost:3000)
- `bun run build` - Create production build
- `bun start` - Start production server
- `bun lint` - Run ESLint for code quality checks and import sorting
- `bun typecheck` - Run TypeScript type checking
- `bun format` - Format code with Prettier
- `bun format:check` - Check code formatting without modifying files
- `bun migrate` - Run database migrations
- `bun test` - Run tests with Vitest
- `bun test:watch` - Run tests in watch mode

### Docker

- `docker compose up -d` - Run the application with Docker
- `docker pull ghcr.io/miurla/morphic:latest` - Pull prebuilt Docker image

## Architecture Overview

### Tech Stack

- **Next.js 15.2.3** with App Router and React Server Components
- **React 19.0.0** with TypeScript for type safety
- **Vercel AI SDK 5.0.0-alpha.2** for AI streaming and GenerativeUI
- **Supabase** for authentication and backend services
- **PostgreSQL** with Drizzle ORM for database
- **Redis** (Upstash or local) for chat history storage
- **Tailwind CSS** with shadcn/ui components

### Core Architecture

1. **App Router Structure** (`/app`)
   - `/api/` - Backend API routes for chat, search, and auth endpoints
   - `/auth/` - Authentication pages (login, signup, password reset)
   - `/search/` - Search functionality and results display
   - `/share/` - Sharing functionality for search results

2. **AI Integration** (`/lib`)
   - `/lib/agents/` - AI agents for research and question generation
   - `/lib/config/` - Model configuration management
   - `/lib/streaming/` - Stream handling for AI responses
   - `/lib/tools/` - Search and retrieval tool implementations
   - Models configured in `public/config/models.json`

3. **Database** (`/lib/db`)
   - PostgreSQL database with Drizzle ORM
   - Schema defined in `/lib/db/schema.ts`
   - Migrations in `/lib/db/migrations/`
   - Database actions in `/lib/actions/chat-db.ts`

4. **Search System**
   - Multiple providers: Tavily (default), SearXNG (self-hosted), Exa (neural)
   - Video search support via Serper API
   - URL-specific search capabilities
   - Configurable search depth and result limits

5. **Component Organization** (`/components`)
   - `/artifact/` - Search result and AI response display components
   - `/sidebar/` - Chat history and navigation
   - `/ui/` - Reusable UI components from shadcn/ui
   - Feature-specific components (auth forms, chat interfaces)

6. **State Management**
   - Server-side state via React Server Components
   - Client-side hooks in `/hooks/`
   - Redis for persistent chat history
   - Supabase for user data

## Environment Configuration

### Required Variables

```bash
OPENAI_API_KEY=      # Default AI provider
TAVILY_API_KEY=      # Default search provider
DATABASE_URL=        # PostgreSQL connection string
```

### Optional Features

- Chat history: Set `ENABLE_SAVE_CHAT_HISTORY=true` and configure Redis
- Alternative AI providers: Add corresponding API keys (ANTHROPIC_API_KEY, GOOGLE_GENERATIVE_AI_API_KEY, etc.)
- Alternative search: Configure SEARCH_API and provider-specific settings
- Sharing: Set `NEXT_PUBLIC_ENABLE_SHARE=true`

## Key Development Patterns

1. **AI Streaming**: Uses Vercel AI SDK's streaming capabilities for real-time responses
2. **GenerativeUI**: Dynamic UI components generated based on AI responses
3. **Type Safety**: Strict TypeScript configuration with comprehensive type definitions in `/lib/types/`
4. **Schema Validation**: Zod schemas in `/lib/schema/` for data validation
5. **Error Handling**: Comprehensive error boundaries and fallback UI components

## Testing Approach

- Unit and integration tests with Vitest
- Test files located alongside source files with `.test.ts` or `.test.tsx` extension
- Run `bun test` to execute all tests
- Run `bun test:watch` for development

## Pre-PR Requirements

Before creating a pull request, you MUST ensure all of the following checks pass:

1. **Linting**: Run `bun lint` and fix all ESLint errors and warnings (includes import sorting)
2. **Type checking**: Run `bun typecheck` to ensure no TypeScript errors
3. **Formatting**: Run `bun format:check` to verify code formatting (or `bun format` to auto-fix)
4. **Build**: Run `bun run build` to ensure the application builds successfully
5. **Tests**: Run `bun test` to ensure all tests pass

These checks are enforced in CI/CD and PRs will fail if any of these steps don't pass.

Note: Import sorting is handled by ESLint using `eslint-plugin-simple-import-sort`. Run `bun lint --fix` to automatically sort imports according to the configured order.

## Model Configuration

Models are defined in `public/config/models.json` with:

- `id`: Model identifier
- `provider`: Display name
- `providerId`: Provider key for API routing
- `enabled`: Toggle availability
- `toolCallType`: "native" or "manual" for function calling
- `toolCallModel`: Optional override for tool calls

## Database Management

- Run `bun migrate` to apply database migrations
- Migrations are located in `/lib/db/migrations/`
- Schema changes should be made in `/lib/db/schema.ts`
- Use Drizzle Kit for generating migrations
