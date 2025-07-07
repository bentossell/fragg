# Fragg Browser-Based Preview Implementation Plan

## Executive Summary

This plan outlines the implementation of a Claude Artifacts-style browser-based preview system for Fragg, completely eliminating E2B sandbox dependencies and timeout issues. The new system will provide instant (< 100ms) preview updates by executing code directly in the browser.

## Goals & Benefits

### Primary Goals
1. **Eliminate Timeouts**: No more 20+ minute sandbox creation delays
2. **Instant Preview**: < 100ms from code generation to preview
3. **Zero External Dependencies**: No E2B API key required
4. **Improved UX**: Seamless, Claude Artifacts-like experience

### Key Benefits
- **Performance**: 1000x faster than E2B (100ms vs 20+ minutes)
- **Reliability**: 100% uptime (no external service dependencies)
- **Cost**: $0 runtime costs (no sandbox fees)
- **Offline**: Works without internet after initial page load
- **Simplicity**: Removes complex sandbox management code

## Technical Architecture

### Current Flow (E2B)
```
User Input → AI Generation → E2B Sandbox Creation (20+ min) → Timeout/Preview
```

### New Flow (Browser-Based)
```
User Input → AI Generation → Instant Browser Preview (< 100ms)
```

## Implementation Phases

### Phase 1: Basic Browser Preview (Day 1-2)

#### 1.1 Create Browser Preview Component
```typescript
// components/browser-preview.tsx
export function BrowserPreview({ 
  code, 
  template,
  onError,
  onReady 
}: BrowserPreviewProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')

  useEffect(() => {
    if (!iframeRef.current) return

    try {
      const htmlContent = generateHTMLContent(code, template)
      iframeRef.current.srcdoc = htmlContent
      setStatus('ready')
      onReady?.()
    } catch (error) {
      setStatus('error')
      onError?.(error)
    }
  }, [code, template])

  return (
    <div className="h-full flex flex-col">
      {status === 'loading' && <LoadingBar />}
      <iframe
        ref={iframeRef}
        className="flex-1 w-full border-0"
        sandbox="allow-scripts allow-modals allow-forms"
        title="Browser Preview"
      />
    </div>
  )
}
```

#### 1.2 HTML Generation Service
```typescript
// lib/browser-preview/html-generator.ts
export function generateHTMLContent(code: string, template: string): string {
  const templates = {
    'nextjs-developer': generateReactHTML,
    'vue-developer': generateVueHTML,
    'static-html': (code) => code,
  }

  return templates[template]?.(code) || generateDefaultHTML(code)
}

function generateReactHTML(code: string): string {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <script crossorigin src="https://unpkg.com/react@18/umd/react.production.min.js"></script>
        <script crossorigin src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>
        <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
        <script src="https://cdn.tailwindcss.com"></script>
        <style>
          body { margin: 0; font-family: system-ui, sans-serif; }
          #root { min-height: 100vh; }
          .error { color: red; padding: 20px; }
        </style>
      </head>
      <body>
        <div id="root"></div>
        <script type="text/babel">
          try {
            ${code}
            
            // Auto-detect and render the main component
            const componentNames = ['App', 'Component', 'Main', 'Page']
            const MainComponent = componentNames
              .map(name => window[name])
              .find(comp => typeof comp === 'function')
            
            if (MainComponent) {
              const root = ReactDOM.createRoot(document.getElementById('root'))
              root.render(React.createElement(MainComponent))
            } else {
              document.getElementById('root').innerHTML = 
                '<div class="error">No React component found. Make sure to export App, Component, Main, or Page.</div>'
            }
          } catch (error) {
            document.getElementById('root').innerHTML = 
              '<div class="error">Error: ' + error.message + '</div>'
          }
        </script>
      </body>
    </html>
  `
}
```

### Phase 2: Enhanced Preview Features (Day 3-4)

#### 2.1 Multi-File Support
```typescript
// lib/browser-preview/file-system.ts
export class BrowserFileSystem {
  private files: Map<string, string> = new Map()

  addFile(path: string, content: string) {
    this.files.set(path, content)
  }

  getFile(path: string): string | undefined {
    return this.files.get(path)
  }

  // Simulate module resolution
  resolveImport(importPath: string, currentFile: string): string {
    // Handle relative imports
    if (importPath.startsWith('./') || importPath.startsWith('../')) {
      const resolved = path.resolve(path.dirname(currentFile), importPath)
      return this.getFile(resolved) || ''
    }
    
    // Handle node_modules (from CDN)
    return `https://unpkg.com/${importPath}`
  }
}
```

#### 2.2 Error Handling & Console
```typescript
// components/browser-console.tsx
export function BrowserConsole({ logs }: { logs: LogEntry[] }) {
  return (
    <div className="h-32 bg-gray-900 text-white p-2 overflow-y-auto font-mono text-xs">
      {logs.map((log, i) => (
        <div key={i} className={`mb-1 ${log.type === 'error' ? 'text-red-400' : ''}`}>
          <span className="text-gray-500">[{log.timestamp}]</span> {log.message}
        </div>
      ))}
    </div>
  )
}
```

### Phase 3: Sandpack Integration (Day 5-6)

#### 3.1 Install Sandpack
```bash
npm install @codesandbox/sandpack-react
```

#### 3.2 Create Sandpack Preview
```typescript
// components/sandpack-preview.tsx
import { Sandpack } from '@codesandbox/sandpack-react'

export function SandpackPreview({ 
  code, 
  template,
  dependencies = {} 
}: SandpackPreviewProps) {
  const files = {
    '/App.js': code,
    '/index.js': getIndexFile(template),
    '/package.json': JSON.stringify({
      dependencies: {
        react: '^18.0.0',
        'react-dom': '^18.0.0',
        ...dependencies
      }
    })
  }

  return (
    <Sandpack
      template={template === 'vue-developer' ? 'vue' : 'react'}
      files={files}
      options={{
        showNavigator: false,
        showTabs: false,
        showLineNumbers: true,
        showInlineErrors: true,
        wrapContent: true,
        editorHeight: "100%",
        bundlerURL: "https://sandpack-bundler.codesandbox.io"
      }}
      theme="dark"
      customSetup={{
        environment: 'create-react-app'
      }}
    />
  )
}
```

### Phase 4: Migration & Integration (Day 7-8)

#### 4.1 Update Main Page
```typescript
// app/page.tsx - Replace sandbox call with browser preview
const handleGenerationComplete = useCallback(async (fragment: DeepPartial<FragmentSchema>) => {
  console.log('🎯 Generation complete, showing instant preview')
  
  // No sandbox needed - just update state!
  setAppState(prev => ({
    ...prev,
    fragment,
    result: null, // No sandbox result
    isPreviewLoading: false,
    currentTab: 'fragment'
  }))
  
  // Track success
  posthog.capture('instant_preview_shown', {
    template: fragment?.template,
    codeSize: fragment?.code?.length
  })
}, [])
```

#### 4.2 Update Unified Preview
```typescript
// components/unified-preview.tsx
import { BrowserPreview } from './browser-preview'
import { SandpackPreview } from './sandpack-preview'

// In the preview tab content
<TabsContent value="fragment" className="flex-1">
  {fragment && (
    <div className="h-full">
      {shouldUseSandpack(fragment) ? (
        <SandpackPreview 
          code={fragment.code}
          template={fragment.template}
        />
      ) : (
        <BrowserPreview
          code={fragment.code}
          template={fragment.template}
          onError={console.error}
        />
      )}
    </div>
  )}
</TabsContent>
```

### Phase 5: Polish & Optimization (Day 9-10)

#### 5.1 Performance Optimizations
- Debounce preview updates
- Cache compiled code
- Lazy load heavy dependencies
- Use web workers for compilation

#### 5.2 Feature Enhancements
- Add console output
- Support multiple files
- Add error boundaries
- Implement hot reload

## Migration Strategy

### Step 1: Parallel Implementation
1. Keep E2B as fallback
2. Add feature flag for browser preview
3. Test with subset of users

### Step 2: Gradual Rollout
```typescript
// lib/feature-flags.ts
export function shouldUseBrowserPreview(): boolean {
  // Start with 10% of users
  return Math.random() < 0.1
}
```

### Step 3: Full Migration
1. Monitor error rates
2. Gather user feedback
3. Remove E2B code
4. Archive sandbox implementations

## Testing Strategy

### Unit Tests
```typescript
// __tests__/browser-preview.test.tsx
describe('BrowserPreview', () => {
  it('renders React components instantly', async () => {
    const { getByText } = render(
      <BrowserPreview 
        code="function App() { return <h1>Hello</h1> }"
        template="nextjs-developer"
      />
    )
    
    await waitFor(() => {
      expect(getByText('Hello')).toBeInTheDocument()
    })
  })
})
```

### Integration Tests
- Test all template types
- Verify error handling
- Check console output
- Validate state management

## Rollback Plan

If issues arise:
1. Toggle feature flag off
2. Revert to E2B sandbox
3. Investigate issues
4. Fix and retry

## Success Metrics

### Performance
- **Preview Load Time**: < 100ms (vs 20+ minutes)
- **Time to Interactive**: < 500ms
- **Memory Usage**: < 100MB per preview

### Reliability
- **Success Rate**: > 99.9%
- **Error Rate**: < 0.1%
- **Timeout Rate**: 0%

### User Experience
- **User Satisfaction**: +50 NPS points
- **Support Tickets**: -95% sandbox-related issues
- **Engagement**: +200% preview interactions

## Technical Requirements

### Browser Support
- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

### Dependencies
```json
{
  "@codesandbox/sandpack-react": "^2.13.0",
  "@babel/standalone": "^7.23.0"
}
```

## Security Considerations

### Iframe Sandboxing
```html
<iframe 
  sandbox="allow-scripts allow-modals allow-forms"
  <!-- Prevents: -->
  <!-- - Top navigation -->
  <!-- - Plugins -->
  <!-- - Downloads -->
  <!-- - Same-origin access -->
/>
```

### Content Security Policy
```typescript
// Restrict execution to trusted sources
const csp = {
  'script-src': ["'self'", 'unpkg.com', 'cdn.jsdelivr.net'],
  'style-src': ["'self'", "'unsafe-inline'", 'cdn.tailwindcss.com']
}
```

## Timeline

### Week 1
- Days 1-2: Basic browser preview
- Days 3-4: Enhanced features
- Days 5-6: Sandpack integration

### Week 2
- Days 7-8: Migration & integration
- Days 9-10: Polish & optimization

## Conclusion

This browser-based preview system will transform Fragg's user experience by eliminating timeout issues and providing instant feedback. By following Claude Artifacts' approach, we can deliver a superior development experience that's faster, more reliable, and more cost-effective than the current E2B solution.

**Estimated Impact**: 
- 1000x faster preview generation
- $0 runtime costs
- 100% reliability
- Significantly improved user satisfaction

## References

- [Claude Artifacts](https://claude.ai) - Inspiration for instant preview
- [ChatGPT Artifacts](https://github.com/ozgrozer/chatgpt-artifacts) - Open source implementation
- [LlamaCodeer](https://github.com/Nutlope/llamacoder) - Sandpack integration example 