'use client'

import { FragmentInterpreter } from './fragment-interpreter'
import { FragmentWeb } from './fragment-web'
import { ExecutionResult } from '@/lib/types'
import { useState, useEffect, Suspense } from 'react'
import { selectSandbox, getSandboxComponent } from '@/lib/sandbox-router'
import type { TemplateId } from '@/lib/templates'
import { Card } from './ui/card'

interface FragmentPreviewProps {
  result?: ExecutionResult | null
  fragment?: {
    code: string
    template: string
    file_path?: string
  }
  userId?: string
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

// Loading component for Suspense
function PreviewLoading() {
  return (
    <Card className="flex items-center justify-center h-full bg-muted/30">
      <div className="text-center space-y-3 p-6">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite]"></div>
        <p className="text-muted-foreground">Loading preview environment...</p>
      </div>
    </Card>
  )
}

export function FragmentPreview({ result, fragment, userId }: FragmentPreviewProps) {
  const [transformedCode, setTransformedCode] = useState('')
  const [dependencies, setDependencies] = useState<string[]>([])

  useEffect(() => {
    // Prepare code transformations for instant preview if needed
    if (fragment && !result) {
      setTransformedCode(transformCodeForInstantPreview(fragment.code))
      setDependencies(extractDependencies(fragment.code))
    }
  }, [fragment, result])

  // If we have a result (sandbox already created), use the appropriate viewer
  if (result) {
    if (result.template === 'code-interpreter-v1') {
      return <FragmentInterpreter result={result} />
    }
    return <FragmentWeb result={result} />
  }

  // If no fragment, show loading state
  if (!fragment || !fragment.code) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        <p>Preparing preview...</p>
      </div>
    )
  }

  // Use the sandbox router to determine which preview component to use
  const sandboxType = selectSandbox(fragment, userId)
  const PreviewComponent = getSandboxComponent(sandboxType)

  // For legacy sandbox type, return the original decision tree logic
  if (sandboxType === 'legacy') {
    // This will be removed in a future update once WebContainers is fully implemented
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        <div className="text-center space-y-2">
          <p>Waiting for sandbox...</p>
          <p className="text-xs">Complex apps require full sandbox environment</p>
        </div>
      </div>
    )
  }

  // For all other sandbox types, render the component with Suspense
  return (
    <Suspense fallback={<PreviewLoading />}>
      <div className="h-full flex flex-col">
        <div className="bg-muted/50 px-3 py-1.5 text-xs text-muted-foreground border-b flex items-center justify-between">
          <span>
            {sandboxType === 'webcontainer' && '⚡ WebContainer Preview'}
            {sandboxType === 'browser' && '🌐 Browser Preview'}
            {sandboxType === 'sandpack' && '📦 Sandpack Preview'}
            {sandboxType === 'instant' && '⚡ Instant Preview'}
            {sandboxType === 'e2b' && '🖥️ Sandbox Preview'}
          </span>
        </div>
        <div className="flex-1">
          <PreviewComponent
            fragment={fragment}
            code={fragment.code}
            template={fragment.template as TemplateId}
            transformedCode={transformedCode}
            dependencies={dependencies}
          />
        </div>
      </div>
    </Suspense>
  )
}
