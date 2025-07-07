'use client'

import { FragmentInterpreter } from './fragment-interpreter'
import { FragmentWeb } from './fragment-web'
import { InstantPreview } from './instant-preview-v2'
import { BrowserPreview } from './browser-preview'
import { ExecutionResult } from '@/lib/types'
import { useState, useEffect } from 'react'
import { shouldUseBrowserPreview, templateSupportsBrowserPreview } from '@/lib/feature-flags'
import type { TemplateId } from '@/lib/templates'

interface FragmentPreviewProps {
  result?: ExecutionResult | null
  fragment?: {
    code: string
    template: string
    file_path?: string
  }
  userId?: string
}

// Check if code is simple enough for instant preview
function canUseInstantPreview(code: string, template: string): boolean {
  // Only for React-based templates
  if (!['nextjs-developer', 'react'].includes(template)) {
    return false
  }

  // Check if code is self-contained React
  const hasReact = code.includes('React') || code.includes('function App') || code.includes('const App')
  const hasComplexImports = code.match(/import .* from ['"](?!react|react-dom|lucide-react)/g)
  const hasServerCode = code.includes('use server') || code.includes('export async function') || code.includes('getServerSideProps')
  const hasFileSystem = code.includes('fs.') || code.includes("require('fs')")
  const hasNodeModules = code.includes('node:') || code.includes('path.') || code.includes('process.')
  
  // Can use instant preview if:
  // 1. Has React code
  // 2. No complex imports (only react, react-dom, lucide-react allowed)
  // 3. No server-side code
  // 4. No file system or Node.js specific code
  return hasReact && !hasComplexImports && !hasServerCode && !hasFileSystem && !hasNodeModules
}

// Extract dependencies from code
function extractDependencies(code: string): string[] {
  const deps: string[] = []
  
  if (code.includes('lucide-react') || code.includes('LucideIcons')) {
    deps.push('lucide-react')
  }
  
  return deps
}

// Transform code for instant preview
function transformCodeForInstantPreview(code: string): string {
  // Remove import statements (we load via CDN)
  let transformed = code.replace(/^import .* from ['"].*['"];?\s*$/gm, '')
  
  // Transform lucide-react imports to use global
  if (code.includes('lucide-react')) {
    // Replace specific icon imports with destructuring from global
    transformed = transformed.replace(
      /import\s*{\s*([^}]+)\s*}\s*from\s*['"]lucide-react['"];?/g,
      (match, icons) => {
        const iconList = icons.split(',').map((i: string) => i.trim()).filter(Boolean)
        return `const { ${iconList.join(', ')} } = window.LucideIcons || {};`
      }
    )
  }
  
  // Ensure App component is rendered if defined
  if (!transformed.includes('ReactDOM.render') && !transformed.includes('ReactDOM.createRoot')) {
    transformed += `
      
// Auto-render App component if defined
if (typeof App !== 'undefined') {
  const root = ReactDOM.createRoot(document.getElementById('root'));
  root.render(<App />);
}
`
  }
  
  return transformed
}

export function FragmentPreview({ result, fragment, userId }: FragmentPreviewProps) {
  const [useInstant, setUseInstant] = useState(false)
  const [transformedCode, setTransformedCode] = useState('')
  const [dependencies, setDependencies] = useState<string[]>([])
  const [browserPreviewError, setBrowserPreviewError] = useState<Error | null>(null)

  useEffect(() => {
    // Check if we can use instant preview when fragment changes
    if (fragment && !result) {
      const canUseInstant = canUseInstantPreview(fragment.code, fragment.template)
      setUseInstant(canUseInstant)
      
      if (canUseInstant) {
        setTransformedCode(transformCodeForInstantPreview(fragment.code))
        setDependencies(extractDependencies(fragment.code))
      }
    } else {
      setUseInstant(false)
    }
  }, [fragment, result])

  // If we have a result (sandbox created), use the appropriate viewer
  if (result) {
    if (result.template === 'code-interpreter-v1') {
      return <FragmentInterpreter result={result} />
    }
    return <FragmentWeb result={result} />
  }

  // Check if we should use browser preview
  if (fragment && shouldUseBrowserPreview(userId) && templateSupportsBrowserPreview(fragment.template as TemplateId)) {
    return (
      <div className="h-full flex flex-col">
        <div className="bg-muted/50 px-3 py-1.5 text-xs text-muted-foreground border-b flex items-center justify-between">
          <span>🌐 Browser Preview (Experimental)</span>
          {browserPreviewError && (
            <span className="text-red-500">Error loading preview</span>
          )}
        </div>
        <div className="flex-1">
          <BrowserPreview 
            code={fragment.code}
            template={fragment.template as TemplateId}
            onError={(error) => {
              console.error('Browser preview error:', error)
              setBrowserPreviewError(error)
            }}
            onReady={() => {
              setBrowserPreviewError(null)
            }}
          />
        </div>
      </div>
    )
  }

  // If we can use instant preview and have fragment data, show it
  if (useInstant && fragment && transformedCode) {
    return (
      <div className="h-full flex flex-col">
        <div className="bg-muted/50 px-3 py-1.5 text-xs text-muted-foreground border-b">
          ⚡ Instant Preview (CDN-based)
        </div>
        <div className="flex-1">
          <InstantPreview 
            code={transformedCode} 
            dependencies={dependencies}
          />
        </div>
      </div>
    )
  }

  // Loading state or fallback to sandbox when no instant preview available
  if (fragment && !canUseInstantPreview(fragment.code, fragment.template)) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        <div className="text-center space-y-2">
          <p>Waiting for sandbox...</p>
          <p className="text-xs">Complex apps require full sandbox environment</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-center justify-center h-full text-muted-foreground">
      <p>Preparing preview...</p>
    </div>
  )
}
