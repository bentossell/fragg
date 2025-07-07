# Instant Preview Integration Plan for Fragg

## Executive Summary

This document outlines a comprehensive plan to integrate instant preview functionality into the core Fragg app, enabling near-instantaneous (<2 seconds) preview for simple React applications while maintaining full E2B sandbox support for complex applications.

## Current Architecture Analysis

### 1. AI Generation Flow

The current flow consists of several key components:

#### a. Chat Endpoint (`/api/chat/route.ts`)
- Receives user prompts and configuration
- Routes between optimized AI orchestrator and standard generation
- Streams fragment objects with code and metadata
- Supports both full generation and diff-based updates

#### b. AI Orchestrator (`/lib/ai-orchestrator.ts`)
- Manages multi-agent code generation
- Provides streaming updates during generation
- Supports diff mode for incremental updates
- Implements caching for repeated requests

#### c. Sandbox Management (`/api/sandbox/route.ts`)
- Creates and manages E2B sandboxes
- Handles dependency installation
- Manages sandbox pooling and reconnection
- Returns preview URLs for web applications

### 2. Frontend Components

#### a. Main Page (`app/page.tsx`)
- Manages chat history and messages
- Handles fragment versioning
- Coordinates between chat and preview
- Manages app persistence and loading

#### b. Preview Components
- `EnhancedPreview`: Main preview container with version control
- `FragmentPreviewInstant`: Hybrid preview component (already exists!)
- `InstantPreview`: CDN-based React renderer
- `FragmentWeb`: E2B sandbox preview

### 3. Existing Instant Preview Implementation

The codebase already includes a working instant preview system:

#### `FragmentPreviewInstant` Component
- Detects if code is suitable for instant preview
- Checks for React-based templates
- Validates against complex imports and server-side code
- Falls back to E2B for complex apps

#### `InstantPreview` Component
- Renders React code using CDN-loaded dependencies
- Supports React, React-DOM, Babel, and Tailwind CSS
- Handles lucide-react icons via CDN
- Provides load time metrics

## Integration Points

### 1. Chat Flow Integration

**Current State**: The chat endpoint generates code and immediately creates a sandbox.

**Proposed Change**: Add a decision point before sandbox creation:

```typescript
// In /api/chat/route.ts onFinish callback
onFinish: async ({ object: fragment, error }) => {
  if (!error && fragment) {
    // NEW: Check if instant preview is suitable
    const canUseInstant = isInstantPreviewEligible(fragment)
    
    if (canUseInstant) {
      // Skip sandbox creation, let frontend handle instant preview
      setResult({ 
        type: 'instant', 
        fragment,
        template: fragment.template 
      })
    } else {
      // Continue with existing sandbox flow
      const result = await getSandbox(...)
    }
  }
}
```

### 2. Frontend Preview Decision

**Current State**: `EnhancedPreview` always expects a sandbox result.

**Proposed Change**: Modify to support both instant and sandbox modes:

```typescript
// In EnhancedPreview component
if (!result && fragment && canUseInstantPreview(fragment.code, fragment.template)) {
  return <InstantPreview code={transformedCode} dependencies={deps} />
} else if (result || isLoading) {
  return <FragmentWeb result={result} />
}
```

### 3. Hybrid Approach Design

#### Phase 1: Initial Preview (0-2 seconds)
1. AI generates code
2. System checks instant preview eligibility
3. If eligible, render immediately in browser
4. Show "⚡ Instant Preview" indicator

#### Phase 2: Background Sandbox Creation (2-10 seconds)
1. Create E2B sandbox in background
2. Install dependencies
3. Build and start application
4. Keep instant preview active during this process

#### Phase 3: Seamless Transition
1. Once sandbox is ready, offer upgrade option
2. User can switch to full sandbox for:
   - Server-side functionality
   - File system access
   - Database connections
   - API endpoints

## Implementation Phases

### Phase 1: Enhanced Detection Logic

Improve the instant preview detection to support more patterns:

```typescript
function canUseInstantPreview(code: string, template: string): boolean {
  // Existing checks...
  
  // NEW: Support more patterns
  const supportedLibraries = [
    'react', 'react-dom', 'lucide-react', 
    '@heroicons/react', 'framer-motion',
    'recharts', 'react-hook-form'
  ]
  
  // NEW: Check for supported CDN libraries
  const usesOnlyCDNLibraries = checkImports(code, supportedLibraries)
  
  // NEW: Support simple API calls
  const hasSimpleAPIOnly = !hasComplexBackend(code)
  
  return hasReact && usesOnlyCDNLibraries && hasSimpleAPIOnly
}
```

### Phase 2: Streaming Integration

Modify the streaming flow to support instant preview:

```typescript
// In AI orchestrator streaming
switch (update.type) {
  case 'generating':
    if (update.data.partialCode && canUseInstantPreview(update.data.partialCode)) {
      // Stream to instant preview
      sendInstantPreviewUpdate(update.data.partialCode)
    }
    break
}
```

### Phase 3: Progressive Enhancement

Implement background sandbox creation:

```typescript
class ProgressivePreviewManager {
  async startProgressive(fragment: FragmentSchema) {
    // 1. Start with instant preview
    this.showInstantPreview(fragment)
    
    // 2. Create sandbox in background
    this.createBackgroundSandbox(fragment).then(result => {
      // 3. Notify UI that full sandbox is ready
      this.onSandboxReady(result)
    })
  }
}
```

### Phase 4: User Experience Enhancements

#### Loading States
```typescript
type PreviewState = 
  | { type: 'instant', ready: true }
  | { type: 'sandbox-preparing', progress: number }
  | { type: 'sandbox-ready', url: string }
  | { type: 'error', message: string }
```

#### UI Indicators
- "⚡ Instant Preview" badge for CDN mode
- Progress bar for sandbox creation
- "🚀 Full Preview Ready" notification
- Smooth transition between modes

## Performance Optimizations

### 1. CDN Strategy

Preload common libraries:
```html
<link rel="preload" href="https://unpkg.com/react@18/umd/react.production.min.js" as="script">
<link rel="preload" href="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js" as="script">
```

### 2. Code Caching

Cache transformed code:
```typescript
const codeCache = new Map<string, string>()

function getTransformedCode(code: string): string {
  const hash = createHash(code)
  if (codeCache.has(hash)) return codeCache.get(hash)
  
  const transformed = transformCodeForInstantPreview(code)
  codeCache.set(hash, transformed)
  return transformed
}
```

### 3. Sandbox Pool Integration

Leverage existing sandbox pool for complex apps:
```typescript
// Pre-warm sandboxes when instant preview is shown
when(showingInstantPreview).then(() => {
  sandboxPool.prewarm('nextjs-developer')
})
```

## Maintaining Functionality

### 1. Feature Parity Checklist

- [x] Chat history preserved
- [x] Version management works
- [x] App saving/loading functions
- [x] Share functionality maintained
- [x] Error handling consistent
- [x] AI injection still works

### 2. Fallback Mechanisms

```typescript
try {
  // Try instant preview
  return renderInstantPreview(code)
} catch (error) {
  // Fallback to sandbox
  console.warn('Instant preview failed, using sandbox:', error)
  return createSandbox(fragment)
}
```

### 3. Testing Strategy

1. **Unit Tests**: Test detection logic
2. **Integration Tests**: Test preview transitions
3. **E2E Tests**: Test full user flows
4. **Performance Tests**: Measure load times

## Migration Path

### Step 1: Enable Feature Flag
```typescript
const ENABLE_INSTANT_PREVIEW = process.env.NEXT_PUBLIC_INSTANT_PREVIEW === 'true'
```

### Step 2: Gradual Rollout
1. Start with 10% of users
2. Monitor performance metrics
3. Check error rates
4. Increase to 50%, then 100%

### Step 3: Remove Feature Flag
Once stable, make instant preview the default behavior

## Success Metrics

### Performance Targets
- **Instant Preview**: < 2 seconds to first render
- **Sandbox Fallback**: < 10 seconds for complex apps
- **Transition Time**: < 500ms between modes

### User Experience Metrics
- **Engagement**: Increased code iterations per session
- **Satisfaction**: Reduced bounce rate
- **Completion**: Higher app completion rate

### Technical Metrics
- **Cache Hit Rate**: > 30% for instant preview
- **Fallback Rate**: < 20% need full sandbox
- **Error Rate**: < 1% preview failures

## Risk Mitigation

### 1. Security Considerations
- Sandbox all user code in iframes
- Validate CDN URLs
- Limit execution context
- No access to parent window

### 2. Performance Risks
- Monitor CDN availability
- Implement timeout mechanisms
- Cache aggressively
- Provide offline fallbacks

### 3. Compatibility Issues
- Test across browsers
- Handle CSP restrictions
- Support various React versions
- Graceful degradation

## Conclusion

This integration plan provides a clear path to implementing instant preview in Fragg while maintaining all existing functionality. The hybrid approach ensures users get the fastest possible experience for simple apps while retaining full E2B sandbox capabilities for complex applications.

The implementation can be done incrementally, with each phase providing value while maintaining system stability. The existing instant preview components provide a solid foundation, requiring mainly integration work rather than building from scratch.

By following this plan, Fragg can offer a significantly improved user experience with near-instantaneous previews for the majority of use cases, while seamlessly upgrading to full sandboxes when needed.