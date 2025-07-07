# FRAGG 2.0: Master Plan for Ultra-Fast App Generation

## Executive Summary

The current Fragg implementation treats every app as if it needs a full development environment, resulting in 30-60 second wait times. This plan outlines a complete architectural redesign to achieve:

- **<2 second initial preview** for most apps
- **<500ms iterations** using smart diffs
- **Instant library app loading** (like native apps)
- **Scale to thousands of users** with minimal infrastructure

## Core Problem

Current flow: User request → Generate code → Create Docker container → Install dependencies → Build app → Wait for server → Show preview

**This takes 30-60 seconds because we're building a full dev environment for a simple preview.**

## New Architecture: Progressive Enhancement

### 1. Three-Tier App System

```
Tier 1: Instant (0-2 seconds)
- Pure HTML/CSS/JS
- React/Vue via CDN
- No build step
- Runs in iframe with Babel standalone

Tier 2: Fast (2-5 seconds)  
- Pre-warmed containers
- Cached dependencies
- Hot reload ready
- WebContainers or Sandpack

Tier 3: Full (5-10 seconds)
- Complex apps needing backend
- Custom dependencies
- Full dev environment
- E2B or similar
```

### 2. Smart Routing Based on Complexity

```javascript
// AI-powered complexity detection
const detectComplexity = (userPrompt, generatedCode) => {
  // Tier 1: Simple frontend
  if (hasOnlyFrontend(code) && usesCommonLibs(code)) {
    return 'instant'
  }
  
  // Tier 2: Standard web app
  if (needsNodeModules(code) && !hasBackend(code)) {
    return 'fast'
  }
  
  // Tier 3: Full stack
  return 'full'
}
```

## Implementation Plan

### Phase 1: Instant Preview (Week 1)

**Goal: Get something on screen in <2 seconds**

#### 1.1 Simple Iframe Renderer

```javascript
// New component: InstantPreview.tsx
export function InstantPreview({ code, template }: { code: string, template: string }) {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  
  useEffect(() => {
    const html = buildHTMLDocument(code, template)
    const blob = new Blob([html], { type: 'text/html' })
    const url = URL.createObjectURL(blob)
    
    if (iframeRef.current) {
      iframeRef.current.src = url
    }
    
    return () => URL.revokeObjectURL(url)
  }, [code, template])
  
  return <iframe ref={iframeRef} sandbox="allow-scripts" />
}

function buildHTMLDocument(code: string, template: string) {
  if (template === 'react') {
    return `
<!DOCTYPE html>
<html>
<head>
  <script crossorigin src="https://unpkg.com/react@18/umd/react.production.min.js"></script>
  <script crossorigin src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>
  <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body>
  <div id="root"></div>
  <script type="text/babel">
    ${code}
  </script>
</body>
</html>`
  }
  // Handle other templates...
}
```

#### 1.2 AI Agent Updates

Update the code generation to produce CDN-friendly code:

```javascript
// ai-prompts.ts
export const INSTANT_REACT_PROMPT = `
Generate a React component that:
1. Works with React/ReactDOM from CDN (available as globals)
2. Uses inline Tailwind classes
3. Renders to document.getElementById('root')
4. Is a single self-contained component

Example:
const App = () => {
  const [count, setCount] = React.useState(0)
  return (
    <div className="p-4">
      <button onClick={() => setCount(count + 1)}>
        Count: {count}
      </button>
    </div>
  )
}

ReactDOM.render(<App />, document.getElementById('root'))
`
```

### Phase 2: Smart Code Updates (Week 1-2)

**Goal: <500ms for code changes**

#### 2.1 Enhanced Diff System

```javascript
// code-diff-engine.ts
export class CodeDiffEngine {
  private codeCache = new Map<string, string>()
  
  async applyUpdate(appId: string, userRequest: string, currentCode: string) {
    // 1. Generate minimal diff
    const diff = await generateSmartDiff(userRequest, currentCode)
    
    // 2. Apply diff client-side
    const newCode = applyDiff(currentCode, diff)
    
    // 3. Hot reload in iframe
    await hotReloadIframe(appId, newCode)
    
    return newCode
  }
  
  async generateSmartDiff(request: string, code: string) {
    // Use fast model for diff generation
    const prompt = `
Current code:
${code}

User wants: ${request}

Generate ONLY the minimal changes needed as a JSON diff.
`
    
    const diff = await ai.generate({
      model: 'gpt-4o-mini', // Fast model for diffs
      prompt,
      format: 'json'
    })
    
    return diff
  }
}
```

#### 2.2 Hot Reload System

```javascript
// hot-reload.ts
export function setupHotReload(iframe: HTMLIFrameElement) {
  // Inject hot reload script into iframe
  iframe.contentWindow.postMessage({
    type: 'INJECT_HOT_RELOAD',
    script: `
      window.addEventListener('message', (e) => {
        if (e.data.type === 'HOT_UPDATE') {
          // Re-evaluate the new code
          eval(Babel.transform(e.data.code, {
            presets: ['react']
          }).code)
        }
      })
    `
  }, '*')
}
```

### Phase 3: Multi-Agent Orchestration (Week 2)

**Goal: Parallel processing for complex apps**

#### 3.1 Agent System Design

```typescript
// agents/orchestrator.ts
export class AppOrchestrator {
  async generateApp(prompt: string) {
    // 1. Triage agent determines complexity
    const complexity = await this.triageAgent.analyze(prompt)
    
    if (complexity.tier === 'instant') {
      // Single agent, fast generation
      return await this.instantAgent.generate(prompt)
    }
    
    // 2. Planner agent creates task breakdown
    const plan = await this.plannerAgent.createPlan(prompt)
    
    // 3. Parallel execution
    const results = await Promise.all([
      this.uiAgent.generateUI(plan.ui),
      this.logicAgent.generateLogic(plan.logic),
      this.styleAgent.generateStyles(plan.style)
    ])
    
    // 4. Assembly agent combines results
    return await this.assemblyAgent.combine(results)
  }
}

// Model configuration for different tasks
const AGENT_MODELS = {
  triage: 'gemini-2.0-flash-preview', // Fast classification
  planner: 'claude-3.5-sonnet',       // Smart planning
  ui: 'gpt-4o-mini',                  // Quick UI generation
  logic: 'gpt-4o-mini',               // Quick logic generation
  style: 'gpt-4o-mini',               // Quick styling
  assembly: 'gemini-2.0-flash'        // Fast assembly
}
```

### Phase 4: Progressive Enhancement (Week 2-3)

**Goal: Seamless upgrade from instant to full apps**

#### 4.1 Upgrade Detection

```javascript
// upgrade-manager.ts
export class UpgradeManager {
  async checkIfUpgradeNeeded(code: string, userRequest: string) {
    // Detect if user needs features beyond current tier
    const needs = {
      backend: /api|database|server/i.test(userRequest),
      packages: /install|npm|import/i.test(userRequest),
      build: /typescript|scss|webpack/i.test(userRequest)
    }
    
    if (Object.values(needs).some(v => v)) {
      return await this.upgradeToNextTier()
    }
  }
  
  async upgradeToNextTier() {
    // Seamlessly transition to WebContainers or E2B
    // while keeping the preview visible
  }
}
```

### Phase 5: Persistent App Sessions (Week 3)

**Goal: Apps stay running, instant access from library**

#### 5.1 App State Manager

```javascript
// app-state-manager.ts
export class AppStateManager {
  private runningApps = new Map<string, AppInstance>()
  
  async loadApp(appId: string) {
    // 1. Check if already running
    const running = this.runningApps.get(appId)
    if (running && running.isAlive) {
      return { url: running.url, instant: true }
    }
    
    // 2. Check if can use instant tier
    const app = await this.storage.getApp(appId)
    if (app.tier === 'instant') {
      return { code: app.code, instant: true }
    }
    
    // 3. Otherwise warm start from cache
    return await this.warmStart(appId)
  }
  
  keepAlive(appId: string) {
    // Keep popular apps warm in background
  }
}
```

## Technology Stack Decision

### Frontend Preview: Hybrid Approach

1. **Tier 1**: Custom iframe solution with CDN React/Vue
   - Pros: Instant, no dependencies
   - Cons: Limited to client-side

2. **Tier 2**: Sandpack for moderate complexity
   - Pros: Good DX, handles npm packages
   - Cons: Some limitations

3. **Tier 3**: Keep E2B for full-stack apps
   - Pros: Full Node.js environment
   - Cons: Slower startup

### Code Generation: Multi-Model Strategy

```javascript
const MODEL_STRATEGY = {
  triage: 'gemini-2.0-flash-preview',    // 100ms response
  planning: 'claude-3.5-sonnet',         // Smart decisions
  implementation: 'gpt-4o-mini',         // Fast coding
  review: 'gemini-2.0-flash'             // Quick validation
}
```

## Implementation Timeline

### Week 1: Instant Preview
- [ ] Build iframe renderer component
- [ ] Update AI prompts for CDN-friendly code
- [ ] Create instant preview UI
- [ ] Test with simple React/HTML apps

### Week 2: Smart Updates
- [ ] Implement diff engine
- [ ] Add hot reload to iframe
- [ ] Create update UI flow
- [ ] Test iteration speed

### Week 3: Multi-Agent System
- [ ] Build orchestrator
- [ ] Implement parallel agents
- [ ] Add smart routing
- [ ] Performance testing

### Week 4: Polish & Scale
- [ ] Add persistent sessions
- [ ] Implement app library caching
- [ ] Load testing
- [ ] Documentation

## Success Metrics

1. **Initial Load**: <2 seconds for 80% of apps
2. **Iterations**: <500ms for code changes
3. **Library Apps**: Instant (<100ms) if still warm
4. **Scale**: Support 1000 concurrent users
5. **User Satisfaction**: >90% success rate

## Migration Strategy

1. **Keep existing system running**
2. **Add feature flag for new renderer**
3. **Gradually migrate users based on app complexity**
4. **Monitor performance metrics**
5. **Full cutover once stable**

## Key Innovations

1. **Progressive Enhancement**: Start fast, upgrade as needed
2. **Smart Routing**: Right tool for the right job
3. **Client-First**: Do as much as possible in browser
4. **Parallel Processing**: Multi-agent for complex apps
5. **Persistent Sessions**: Apps stay alive like native

This architecture will deliver the "wow" experience users expect - instant apps that just work.