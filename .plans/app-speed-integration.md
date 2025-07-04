# App Speed Integration Plan

This document details how the performance improvements from `app-speed.md` will be integrated into our development roadmap.

## Overview

The app-speed.md document proposes three major improvements:
1. **Speed Optimization** - <10 second app generation via sandbox pooling
2. **Chat Sessions** - Persistent sandboxes to prevent "sandbox not found" errors  
3. **CDN Approach** - Ultra-fast loading using CDN-delivered libraries

## Integration Timeline

### Phase 1: MVP Foundation (Immediate)
**When**: During Stage 3 (Database Integration)
**What**: Basic infrastructure for chat sessions

- ✅ Add database tables:
  - `chat_sessions` - Store session metadata and sandbox references
  - `chat_messages` - Store conversation history
- Store `sandbox_id` with each session for reconnection
- Basic session persistence (no UI changes yet)
- Prevents "sandbox not found" errors on page refresh

**Implementation**:
```typescript
// When creating a new chat
const session = await supabase
  .from('chat_sessions')
  .insert({
    title: 'New Chat',
    sandbox_id: sandbox.id,
    template: selectedTemplate,
    last_code: generatedCode
  })
  .select()
  .single()

// When reconnecting
const sandbox = await Sandbox.reconnect(session.sandbox_id)
```

### Phase 2: Session Management (Near-term)
**When**: After Stage 4 (Auth & Real Database)
**What**: Full chat session UI and management

- ChatGPT-style sidebar showing all sessions
- Session switching and management
- Persistent sandbox connections
- Incremental code updates (diffs only)
- Session-based undo/redo

**Benefits**:
- Users can switch between multiple app projects
- Sandboxes stay warm between edits
- Faster iteration cycles (3-7 seconds vs 30-60)

### Phase 3: Performance Optimization (Post-MVP)
**When**: After core features are stable
**What**: Advanced performance features

#### 3.1 Sandbox Pooling
- Pre-warm 3 sandboxes per template type
- Queue-based allocation system
- Background replenishment
- Health checks and auto-recovery

```typescript
class SandboxPool {
  private pools: Map<string, Sandbox[]>
  
  async getSandbox(template: string): Promise<Sandbox> {
    const pool = this.pools.get(template) || []
    const sandbox = pool.shift() || await this.createSandbox(template)
    this.replenishPool(template)
    return sandbox
  }
}
```

#### 3.2 CDN-First Templates
- HTML templates that load React/Vue from CDN
- Smart dependency resolution
- Pre-bundled common combinations
- No build step for simple apps

```html
<!-- CDN-based React template -->
<!DOCTYPE html>
<html>
<head>
  <script crossorigin src="https://unpkg.com/react@18/umd/react.production.min.js"></script>
  <script crossorigin src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>
  <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
</head>
<body>
  <div id="root"></div>
  <script type="text/babel">
    // User's React code here
  </script>
</body>
</html>
```

#### 3.3 Edge Caching
- Cache popular templates at edge locations
- Intelligent cache warming
- Version-based invalidation

## Expected Performance Gains

### Current State
- Initial app generation: 30-60 seconds
- Subsequent edits: 30-60 seconds (full recreation)
- Common "sandbox not found" errors

### With Full Implementation
- CDN-based apps: 2-5 seconds
- Pooled sandbox apps: <10 seconds  
- Updates to existing apps: 3-7 seconds
- Zero "sandbox not found" errors
- 90%+ reduction in perceived latency

## Technical Considerations

### Database Impact
- Minimal overhead for chat tables
- Consider indexes on `session_id` for message queries
- Periodic cleanup of old sessions

### Cost Considerations
- Sandbox pooling increases E2B usage (~3x idle sandboxes)
- Consider time-based pool scaling
- CDN approach reduces sandbox usage for simple apps

### Migration Path
1. Deploy database changes
2. Update API to store session data
3. Add reconnection logic
4. Implement UI changes
5. Roll out performance features gradually

## Success Metrics

- App generation time P95 < 10 seconds
- Edit/update time P95 < 5 seconds  
- Zero "sandbox not found" errors
- User session retention increase
- Positive user feedback on speed

## Next Steps

1. Complete MVP Stage 3 with chat session tables
2. Test basic session persistence
3. Gather performance baseline metrics
4. Plan Phase 2 UI implementation
5. Research E2B sandbox pooling best practices