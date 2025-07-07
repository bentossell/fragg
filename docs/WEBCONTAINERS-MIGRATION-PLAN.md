# WebContainers MVP Implementation Plan

## Executive Summary

This MVP plan focuses on implementing WebContainers/Sandpack for Fragg to solve the timeout issues and deliver the best text-to-app experience for single-user testing. The goal is to have apps running in < 3 seconds instead of 20+ minutes.

## MVP Scope & Goals

### Primary Goals
1. **Instant App Generation**: < 3 seconds from prompt to preview
2. **Zero Timeouts**: Eliminate all E2B timeout issues
3. **Superior UX**: Seamless text-to-app experience
4. **Single User Focus**: No auth/database complexity initially

### Out of Scope for MVP
- Multi-user support
- Authentication/authorization
- Database persistence
- Python templates (Streamlit/Gradio)
- Complex deployment features

## Technical Implementation

### Phase 1: Core Setup (Day 1-3)

#### 1.1 Install Dependencies
```bash
pnpm add @webcontainer/api @codesandbox/sandpack-react xterm xterm-addon-fit
```

#### 1.2 Create WebContainer Service
```typescript
// lib/webcontainer/webcontainer-service.ts
import { WebContainer } from '@webcontainer/api';

export class WebContainerService {
  private static instance: WebContainer | null = null;
  private static bootPromise: Promise<WebContainer> | null = null;

  static async getInstance(): Promise<WebContainer> {
    if (!this.bootPromise) {
      this.bootPromise = WebContainer.boot();
    }
    if (!this.instance) {
      this.instance = await this.bootPromise;
    }
    return this.instance;
  }

  static async createReactApp(code: string): Promise<string> {
    const container = await this.getInstance();
    
    // Write package.json
    await container.fs.writeFile('/package.json', JSON.stringify({
      name: 'react-app',
      scripts: { dev: 'vite' },
      dependencies: {
        'react': '^18.2.0',
        'react-dom': '^18.2.0'
      },
      devDependencies: {
        '@vitejs/plugin-react': '^4.0.0',
        'vite': '^4.4.0'
      }
    }));

    // Write vite config
    await container.fs.writeFile('/vite.config.js', `
      import { defineConfig } from 'vite'
      import react from '@vitejs/plugin-react'
      export default defineConfig({
        plugins: [react()],
        server: { port: 3000 }
      })
    `);

    // Write index.html
    await container.fs.writeFile('/index.html', `
      <!DOCTYPE html>
      <html>
        <body>
          <div id="root"></div>
          <script type="module" src="/src/main.jsx"></script>
        </body>
      </html>
    `);

    // Write main.jsx
    await container.fs.writeFile('/src/main.jsx', `
      import React from 'react'
      import ReactDOM from 'react-dom/client'
      import App from './App'
      ReactDOM.createRoot(document.getElementById('root')).render(<App />)
    `);

    // Write App.jsx with user code
    await container.fs.writeFile('/src/App.jsx', code);

    // Install and start
    const install = await container.spawn('npm', ['install']);
    await install.exit;

    const dev = await container.spawn('npm', ['run', 'dev']);
    
    // Wait for server to start
    container.on('server-ready', (port, url) => {
      return url;
    });
  }
}
```

#### 1.3 Create Sandpack Integration
```typescript
// lib/sandpack/sandpack-service.ts
export function canUseSandpack(code: string): boolean {
  // Simple React components without external deps
  const hasExternalImports = /import\s+.*from\s+['"](?!react|react-dom)/g.test(code);
  const hasComplexFeatures = /fetch|axios|localStorage|WebSocket/g.test(code);
  return !hasExternalImports && !hasComplexFeatures;
}

export function transformForSandpack(code: string): SandpackFiles {
  return {
    '/App.js': code,
    '/index.js': `
      import React from 'react';
      import ReactDOM from 'react-dom/client';
      import App from './App';
      
      const root = ReactDOM.createRoot(document.getElementById('root'));
      root.render(<App />);
    `
  };
}
```

### Phase 2: Preview Components (Day 4-5)

#### 2.1 WebContainer Preview
```typescript
// components/webcontainer-preview.tsx
import { useEffect, useState, useRef } from 'react';
import { WebContainerService } from '@/lib/webcontainer/webcontainer-service';

export function WebContainerPreview({ code }: { code: string }) {
  const [status, setStatus] = useState<'booting' | 'installing' | 'running'>('booting');
  const [url, setUrl] = useState<string>('');
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    let mounted = true;

    async function startContainer() {
      try {
        setStatus('booting');
        const previewUrl = await WebContainerService.createReactApp(code);
        
        if (mounted) {
          setStatus('running');
          setUrl(previewUrl);
        }
      } catch (error) {
        console.error('WebContainer error:', error);
      }
    }

    startContainer();
    return () => { mounted = false; };
  }, [code]);

  return (
    <div className="h-full flex flex-col">
      {status !== 'running' && (
        <div className="bg-blue-50 border-b p-3 text-sm">
          <div className="flex items-center gap-2">
            {status === 'booting' && <span>🚀 Starting WebContainer...</span>}
            {status === 'installing' && <span>📦 Installing dependencies...</span>}
          </div>
        </div>
      )}
      {url && (
        <iframe
          ref={iframeRef}
          src={url}
          className="flex-1 w-full border-0"
          title="App Preview"
        />
      )}
    </div>
  );
}
```

#### 2.2 Sandpack Preview
```typescript
// components/sandpack-preview.tsx
import { Sandpack } from '@codesandbox/sandpack-react';
import { transformForSandpack } from '@/lib/sandpack/sandpack-service';

export function SandpackPreview({ code }: { code: string }) {
  const files = transformForSandpack(code);

  return (
    <Sandpack
      template="react"
      files={files}
      options={{
        showNavigator: false,
        showTabs: false,
        showLineNumbers: true,
        showInlineErrors: true,
        wrapContent: true,
        editorHeight: "100%",
      }}
      theme="dark"
      customSetup={{
        dependencies: {
          "react": "^18.2.0",
          "react-dom": "^18.2.0"
        }
      }}
    />
  );
}
```

### Phase 3: Integration (Day 6-7)

#### 3.1 Hybrid Preview Selector
```typescript
// components/hybrid-preview.tsx
import { canUseSandpack } from '@/lib/sandpack/sandpack-service';
import { SandpackPreview } from './sandpack-preview';
import { WebContainerPreview } from './webcontainer-preview';
import { UnifiedPreview } from './unified-preview';

export function HybridPreview({ 
  fragment,
  result 
}: { 
  fragment: FragmentSchema;
  result?: ExecutionResult;
}) {
  // Decision logic
  if (fragment.template === 'code-interpreter-v1') {
    return <div>Code interpreter not supported in MVP</div>;
  }

  if (canUseSandpack(fragment.code)) {
    // Simple React components - use Sandpack
    return <SandpackPreview code={fragment.code} />;
  }

  if (['nextjs-developer', 'vue-developer'].includes(fragment.template)) {
    // Complex web apps - use WebContainers
    return <WebContainerPreview code={fragment.code} />;
  }

  // Fallback to existing E2B for unsupported templates
  return <UnifiedPreview fragment={fragment} result={result} />;
}
```

#### 3.2 Update Main Page
```typescript
// app/page.tsx - Update preview component
const previewComponent = useMemo(() => {
  if (!messages.length || !lastFragment) return null;

  // Use new hybrid preview system
  return (
    <HybridPreview 
      fragment={lastFragment}
      result={executionResult}
    />
  );
}, [lastFragment, executionResult]);
```

### Phase 4: Performance Optimization (Day 8-9)

#### 4.1 Preboot WebContainers
```typescript
// app/providers.tsx
export function Providers({ children }: ProvidersProps) {
  useEffect(() => {
    // Preboot WebContainer on app load
    if (typeof window !== 'undefined') {
      WebContainerService.getInstance().catch(console.error);
    }
  }, []);

  return (
    <ThemeProvider>
      {children}
    </ThemeProvider>
  );
}
```

#### 4.2 Code Caching
```typescript
// lib/webcontainer/code-cache.ts
export class CodeCache {
  private cache = new Map<string, string>();

  hash(code: string): string {
    // Simple hash for MVP
    return btoa(code).slice(0, 16);
  }

  get(code: string): string | null {
    return this.cache.get(this.hash(code)) || null;
  }

  set(code: string, url: string): void {
    this.cache.set(this.hash(code), url);
    
    // Limit cache size
    if (this.cache.size > 10) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
  }
}
```

## Testing Strategy

### Manual Testing Checklist
- [ ] Simple React component renders in < 1s
- [ ] Complex Next.js app loads in < 3s
- [ ] Code updates reflect immediately
- [ ] No timeout errors occur
- [ ] Browser memory stays under 500MB
- [ ] Works offline after initial load

### Test Cases
1. **Hello World**: Basic React component
2. **Todo App**: Interactive with state
3. **API Integration**: Fetch data (mock)
4. **Complex UI**: Multiple components
5. **Next.js App**: Full framework test

## Rollout Plan

### Day 1-3: Foundation
- Setup WebContainer infrastructure
- Basic React app support
- Initial testing

### Day 4-7: Integration
- Sandpack for simple components
- WebContainers for complex apps
- Hybrid preview system

### Day 8-10: Polish
- Performance optimization
- Error handling
- User feedback

## Success Metrics

### Performance
- **Boot Time**: < 1s for Sandpack, < 3s for WebContainers
- **Code Update**: < 500ms
- **Memory Usage**: < 500MB
- **Success Rate**: > 99%

### User Experience
- Zero timeout errors
- Instant feedback
- Smooth transitions
- Clear status indicators

## Future Enhancements

After MVP success:
1. Add terminal/console output
2. Support more frameworks
3. Implement file explorer
4. Add debugging capabilities
5. Enable app export/download

## Conclusion

This MVP implementation will eliminate the timeout issues and provide a superior text-to-app experience. By using WebContainers for complex apps and Sandpack for simple components, we can achieve < 3 second generation times while maintaining full functionality. 