# E2B Sandbox Implementation in Fragg

## Overview

The E2B sandbox implementation in Fragg provides secure, isolated environments for executing AI-generated code. It supports multiple languages and frameworks (Next.js, Vue, Streamlit, Gradio) with hot-reload capabilities and persistent sandbox sessions.

## Architecture Components

### 1. Sandbox Route API (`/app/api/sandbox/route.ts`)

The main API endpoint that handles sandbox creation, code execution, and session management.

**Key Features:**
- **POST** - Creates/reuses sandboxes, executes code, returns preview URLs
- **DELETE** - Releases sandbox sessions
- Maximum execution duration: 60 seconds
- Supports both anonymous and authenticated sessions

**Request Flow:**
1. Receives fragment (code + metadata) and optional sessionId/appId
2. Gets or creates sandbox using manager hierarchy
3. Installs dependencies (if new sandbox)
4. Injects AI capabilities into code
5. Writes code to sandbox filesystem
6. Executes code based on template type
7. Returns execution results or preview URL

### 2. Sandbox Managers

#### 2.1 AppSandboxManager (`lib/sandbox/app-sandbox-manager.ts`)
**Purpose:** Manages app-specific sandboxes for persistent apps ("My Apps" feature)

**Key Features:**
- Keeps sandboxes alive between edits
- Tracks code changes via hash comparison
- Caches app URLs for instant preview
- Auto-cleanup of idle sandboxes (5 min timeout)
- Enables instant responses when code hasn't changed

**Performance Optimization:**
- Returns cached URL if code unchanged (⚡ <100ms response)
- Reuses running sandbox for code updates
- Maintains app state between sessions

#### 2.2 SandboxReconnectionManager (`lib/sandbox/reconnect.ts`)
**Purpose:** Manages sandbox reconnection for chat sessions

**Key Features:**
- Maps sessions to sandbox IDs
- Attempts reconnection up to 3 times
- Falls back to pool or creates new sandbox
- Integrates with sandbox pool for warm instances

**Hierarchy:**
1. Check sandbox pool for session
2. Check if session has active sandbox
3. Try to reconnect to previous sandbox
4. Get from pool or create new

#### 2.3 SingleActiveSandboxManager (`lib/sandbox/single-active-manager.ts`)
**Purpose:** Ensures only one active sandbox per session (cost optimization)

**Key Features:**
- Tracks current active sandbox
- Automatically closes previous sandbox when switching
- Releases sandboxes back to pool instead of killing
- Handles cleanup on errors

#### 2.4 SandboxPool (`lib/sandbox-pool.ts`)
**Purpose:** Pre-warms sandboxes for instant availability

**Key Features:**
- Maintains min/max pool sizes per template
- Pre-creates sandboxes in background
- Tracks usage statistics and hit rates
- Automatic maintenance cycle (30s intervals)
- LRU eviction for expired sandboxes (10 min timeout)

**Default Configuration:**
- Min size: 2 sandboxes per template
- Max size: 5 sandboxes per template
- Templates: nextjs-developer, streamlit-developer, vue-developer

### 3. Code Execution Flow

#### 3.1 Web Applications (Next.js, Vue)
1. **Code Injection**: AI capabilities injected via `injectAI()` function
2. **File Writing**: Code written to appropriate path (e.g., `/home/user/app/page.tsx`)
3. **Process Management**: 
   - Kills existing processes on port
   - Executes template-specific start command
   - Waits for app to be accessible (up to 60s)
4. **URL Generation**: Returns HTTPS URL for preview

#### 3.2 Python Applications (Streamlit, Gradio)
1. **Python-specific AI injection**: Adds `ai_ask()` and `ai_chat()` functions
2. **Direct execution**: Runs Python file with framework CLI
3. **Hot reload**: Frameworks auto-reload on code changes

#### 3.3 Code Interpreter
1. **Direct execution**: Uses E2B's `runCode()` method
2. **Returns**: stdout, stderr, runtime errors, cell results
3. **No preview URL**: Results shown inline

### 4. AI Integration (`lib/inject-ai.ts`)

Injects AI capabilities into generated code:

**Web Apps (HTML/JS):**
- Adds `window.AI` object with `.ask()` and `.chat()` methods
- Direct OpenRouter API calls from sandboxes
- Model selection: fast, balanced, powerful, cheap, turbo

**Python Apps:**
- `ai_ask(prompt, model)` - Simple question/answer
- `ai_chat(messages, model)` - Multi-turn conversations
- `AI_MODELS` dictionary for model selection

### 5. Performance Characteristics

#### Current Bottlenecks:
1. **Cold Start**: ~10-15s for new sandbox creation
2. **Dependency Installation**: +5-10s for complex dependencies
3. **App Startup**: ~5-10s for Next.js build/start
4. **Total Time**: 20-35s for first generation

#### Optimizations Implemented:
1. **Sandbox Pool**: Pre-warmed sandboxes reduce cold start to <1s
2. **Session Persistence**: Reuse sandboxes across chat messages
3. **App Caching**: Keep app sandboxes running for instant edits
4. **Dependency Tracking**: Skip reinstall if already installed
5. **URL Caching**: Return cached URL if code unchanged

### 6. Code Generation Pipeline

#### 6.1 Chat API (`/app/api/chat/route.ts`)
1. Receives user prompt and chat history
2. Routes to either:
   - **AI Orchestrator** (optimized path) for new generation
   - **Standard streaming** (fallback) for complex requests

#### 6.2 AI Orchestrator (`lib/ai-orchestrator.ts`)
**Multi-agent system for fast code generation:**

1. **Triage Stage**: Analyzes request, selects stack/template
2. **Agent Execution**: Runs specialized agents in parallel
3. **Assembly Stage**: Combines agent outputs
4. **Diff Mode**: For iterations, generates only changes

**Performance Features:**
- Result caching with LRU eviction
- Parallel agent execution
- Incremental updates via diff mode
- Fallback mechanisms for reliability

### 7. Preview System

#### 7.1 Standard Preview Flow
1. User sends message → AI generates code
2. Code sent to sandbox API → Sandbox created/reused
3. App starts in sandbox → URL returned
4. Preview component loads URL in iframe

#### 7.2 Instant Preview (Experimental)
For simple React apps without complex dependencies:
1. Detects if code is CDN-compatible
2. Transforms imports to use global objects
3. Renders directly in browser without sandbox
4. Falls back to sandbox for complex apps

### 8. Session and State Management

#### Chat Sessions:
- Each chat has a unique sessionId
- Sessions mapped to sandbox instances
- Sandboxes persist across messages in same chat
- Automatic cleanup on session end

#### App Persistence:
- Apps have unique appId
- Sandboxes kept running between edits
- State preserved across browser refreshes
- Manual save triggers version storage

### 9. Error Handling and Recovery

1. **Sandbox Creation Failures**: Falls back to pool or retries
2. **Connection Losses**: Attempts reconnection before creating new
3. **Timeout Handling**: 60s timeout with graceful error messages
4. **Resource Cleanup**: Automatic cleanup of orphaned sandboxes
5. **Pool Maintenance**: Removes expired sandboxes, refills pool

### 10. Future Optimization Opportunities

1. **Edge Deployment**: Deploy popular templates to edge locations
2. **Container Snapshots**: Pre-built container images with dependencies
3. **Incremental Builds**: Cache Next.js build artifacts
4. **WebContainer Integration**: Client-side execution for simple apps
5. **Streaming Execution**: Stream output as code generates

## Usage Patterns

### Typical User Flow:
1. User types request
2. AI generates code (1-3s with orchestrator)
3. Sandbox created/reused (1-30s depending on cache)
4. Preview URL returned
5. User iterates with changes
6. Same sandbox reused for fast updates

### Performance by Scenario:
- **First Generation**: 20-35s (cold start + build)
- **Subsequent in Session**: 5-10s (warm sandbox)
- **Saved App Edit**: <1s if code unchanged, 5s if changed
- **Simple React Apps**: <1s with instant preview

## Debugging Tips

1. Check sandbox logs: `[Sandbox STDOUT/STDERR]` in console
2. Monitor pool stats: `sandboxPool.getPoolStats()`
3. Track session flow: `sessionId` → `sandboxId` mapping
4. Verify AI injection: Check for `window.AI` in generated code
5. Test reconnection: Refresh page, should reconnect to same sandbox

## Configuration

Environment variables:
- `E2B_API_KEY`: Required for sandbox creation
- `OPENROUTER_API_KEY`: Required for AI features in sandboxes

Template configuration: `/lib/templates.json`
- Defines start commands, ports, dependencies per template
- Maps template IDs to E2B template names

This implementation provides a robust foundation for code execution while maintaining security through sandboxing and enabling rapid iteration through intelligent caching and session management.