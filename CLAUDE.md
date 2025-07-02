# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

E2B Fragments is an open-source AI code generation and execution platform, similar to Claude Artifacts, Vercel v0, or GPT Engineer. It uses the E2B SDK to securely execute AI-generated code in sandboxed environments.

## Development Commands

### Core Commands
- **Install dependencies**: `npm i`
- **Development server**: `npm run dev --turbo` (runs on http://localhost:3000)
- **Build**: `npm run build`
- **Production server**: `npm start`
- **Lint**: `npm run lint`

### Server Management Rules
- **IMPORTANT**: When starting development servers, ALWAYS check what is running on port 3000 first
- If the project is already running on port 3000, kill the existing process before starting a new one
- Use `lsof -ti:3000 | xargs kill -9` to kill processes on port 3000
- Never start on alternative ports (3001, etc.) without first checking and killing port 3000

### E2B Sandbox Template Commands
When working with sandbox templates:
- **Install E2B CLI**: Follow instructions at https://e2b.dev/docs/cli
- **Initialize template**: `e2b template init` (run in template directory)
- **Build template**: `e2b template build --name <template-name>`
- **Deploy template**: Templates are deployed during the build process

## Architecture

### Tech Stack
- **Framework**: Next.js 14 with App Router and Server Actions
- **UI**: shadcn/ui components with Radix UI primitives
- **Styling**: TailwindCSS with tailwindcss-animate
- **AI Integration**: Vercel AI SDK with support for multiple LLM providers
- **Code Execution**: E2B SDK for secure sandboxed execution
- **Authentication**: Supabase (optional)
- **Analytics**: PostHog (optional)
- **Rate Limiting**: Upstash/Vercel KV (optional)

### Key Directories
- `/app` - Next.js app router pages and API routes
  - `/api/chat` - LLM streaming endpoint
  - `/api/sandbox` - E2B sandbox management
- `/components` - React components
  - `/ui` - shadcn/ui components
  - Fragment components (preview, code view, interpreter)
- `/lib` - Core utilities and configuration
  - `models.json` - LLM model configurations
  - `templates.json` - Sandbox template definitions
  - `schema.ts` - Zod schemas for AI responses
- `/sandbox-templates` - E2B sandbox Dockerfiles and configs
- `/public` - Static assets including provider/template logos

### Key Concepts

1. **Templates**: Pre-configured development environments (Python, Next.js, Vue, Streamlit, Gradio) defined in `/lib/templates.json`. Each template specifies dependencies, entry file, and optional port.

2. **LLM Providers**: Configured in `/lib/models.json` and `/lib/models.ts`. Primary provider is OpenRouter (400+ models with single API key). Also supports direct connections to OpenAI, Anthropic, Google, Mistral, Groq, Fireworks, Together AI, and Ollama.

3. **Fragment Types**: 
   - Code interpreter (Python with data analysis)
   - Web apps (Next.js, Vue with live preview)
   - Data apps (Streamlit, Gradio with hot reload)

4. **E2B Integration**: Sandboxes are created per session, code is executed securely, and results are streamed back to the UI.

## Adding Features

### New Sandbox Template
1. Create folder in `/sandbox-templates/`
2. Add `e2b.Dockerfile` with dependencies
3. Configure `e2b.toml` with start command
4. Build with `e2b template build --name <name>`
5. Add entry to `/lib/templates.json`
6. Optional: Add logo to `/public/thirdparty/templates/`

### New LLM Model
1. Add entry to `/lib/models.json` with id, name, provider, providerId
2. Ensure provider is configured in `/lib/models.ts`

### New LLM Provider
1. Add provider config to `providerConfigs` in `/lib/models.ts`
2. Optional: Configure default output mode in `getDefaultMode`
3. Optional: Add logo to `/public/thirdparty/logos/`

## Environment Variables

Required:
- `E2B_API_KEY` - From https://e2b.dev/
- `OPENROUTER_API_KEY` - From https://openrouter.ai/ (recommended for all models)

Optional LLM Provider Keys (for direct access):
- `OPENAI_API_KEY`
- `ANTHROPIC_API_KEY`
- `GROQ_API_KEY`
- `FIREWORKS_API_KEY`
- `TOGETHER_API_KEY`
- `GOOGLE_AI_API_KEY`
- `MISTRAL_API_KEY`

## Code Patterns

- Use Server Actions for data mutations
- Stream AI responses using Vercel AI SDK
- Validate all inputs with Zod schemas
- Handle rate limiting for public deployments
- Use proper TypeScript types throughout
- Follow Next.js App Router conventions

## MVP Implementation Plan

We are following the incremental MVP plan from `.plans/plan-mvp.md` with these stages:

### Stage 1: Basic Local Setup - COMPLETE ✅
- Initial setup with existing codebase
- Minimal OpenRouter integration to replace multiple providers
- Test basic app generation functionality

### Stage 2: AI SDK in Apps - COMPLETE ✅
- Simple AI injection into generated apps using `lib/inject-ai.ts`
- Basic window.AI object for apps to use with `.ask()` and `.chat()` methods
- Direct OpenRouter API calls from sandboxes (fixed localhost connectivity issue)
- Support for different models (fast, balanced, powerful, cheap, turbo)
- Works across all template types (Next.js, Vue, Streamlit, etc.)
- Python functions for Gradio/Streamlit: `ai_ask()` and `ai_chat()`
- Test page available at `/test-ai` with examples
- **Architecture Fix**: Sandboxes now call OpenRouter API directly instead of localhost proxy

### Stage 3: Database Integration  
- Minimal Supabase setup
- Simple app storage functionality
- "My Apps" page

### Stage 4: Auth & Real Database
- Add Supabase authentication
- Migrate from localStorage to real database
- User-specific app management

### Stage 5: AI Integration in Apps
- Implement AI proxy endpoint
- Connect generated apps to AI capabilities
- Usage tracking

### Stage 6: App Store Features
- Public app gallery
- PWA support and manifest generation
- App sharing capabilities

### Stage 7: Automations
- Simple scheduler using Vercel Cron
- Background execution for automation apps

## MCP Usage Instructions

### Supabase MCP
Use the Supabase MCP for all database and authentication operations:
- `mcp__supabase__list_projects` - Find project IDs
- `mcp__supabase__execute_sql` - Run queries
- `mcp__supabase__apply_migration` - Apply schema changes
- `mcp__supabase__create_project` - Create new projects
- `mcp__supabase__deploy_edge_function` - Deploy edge functions

### Context7 MCP
Use the Context7 MCP to find documentation:
- `mcp__context7__resolve-library-id` - Find library IDs
- `mcp__context7__get-library-docs` - Get documentation
- Useful for: Next.js, Supabase, Vercel AI SDK, etc.

## Current Focus
We are implementing the MVP plan stage by stage. Completed: Stage 1 (Basic Local Setup) and Stage 2 (AI SDK in Apps). Next: Stage 3 (Database Integration).

## Stage Verification Process

After completing each stage implementation, a verification agent MUST be launched to:
1. Verify that all planned features were implemented correctly
2. Test the functionality to ensure it works as expected  
3. Check for any regressions or broken functionality
4. Validate that the implementation matches the plan

Use the Task tool to launch a verification agent with the following prompt:
```
Verify Stage [X] implementation by:
1. Checking all completed tasks match the plan
2. Testing the new functionality works correctly
3. Ensuring no existing features were broken
4. Running any relevant tests or build commands
5. Providing a summary of what works and any issues found
```