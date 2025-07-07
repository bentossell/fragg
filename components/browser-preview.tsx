'use client'

import React, { useRef, useState, useEffect, useCallback, forwardRef, useImperativeHandle, memo } from 'react'
import { Progress } from '@/components/ui/progress'
import { Alert } from '@/components/ui/alert'
import type { TemplateId } from '@/lib/templates'
import { useIframeConsole } from '@/lib/hooks/use-iframe-console'
import { useDebounce } from '@/lib/hooks/use-debounce'
import { BrowserConsole } from './browser-console'
import { 
  generateCachedHTML, 
  trackPerformance, 
  shouldUpdatePreview,
  performanceUtils 
} from '@/lib/browser-preview/performance'

interface BrowserPreviewProps {
  code: string
  template: TemplateId
  onError?: (error: Error) => void
  onReady?: () => void
  showConsole?: boolean
}

export interface BrowserPreviewHandle {
  iframe: HTMLIFrameElement | null
  refreshPreview: () => void
}

type PreviewStatus = 'loading' | 'ready' | 'error'

// HTML generation function - basic implementation for Phase 1.1
function generateHTMLContent(code: string, template: TemplateId): string {
  const templates: Record<string, (code: string) => string> = {
    'nextjs-developer': generateReactHTML,
    'vue-developer': generateVueHTML,
    'static-html': (code) => code,
    'streamlit-developer': generatePythonHTML,
    'gradio-developer': generatePythonHTML,
  }

  const generator = templates[template] || generateDefaultHTML
  return generator(code)
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
          .error { color: red; padding: 20px; font-family: monospace; }
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
            console.error('React render error:', error)
          }
        </script>
      </body>
    </html>
  `
}

function generateVueHTML(code: string): string {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <script src="https://unpkg.com/vue@3/dist/vue.global.js"></script>
        <script src="https://cdn.tailwindcss.com"></script>
        <style>
          body { margin: 0; font-family: system-ui, sans-serif; }
          #app { min-height: 100vh; }
          .error { color: red; padding: 20px; font-family: monospace; }
        </style>
      </head>
      <body>
        <div id="app"></div>
        <script>
          try {
            const { createApp } = Vue
            ${code}
            
            // Try to find the Vue app configuration
            if (typeof App !== 'undefined') {
              createApp(App).mount('#app')
            } else {
              document.getElementById('app').innerHTML = 
                '<div class="error">No Vue app found. Make sure to define an App object.</div>'
            }
          } catch (error) {
            document.getElementById('app').innerHTML = 
              '<div class="error">Error: ' + error.message + '</div>'
            console.error('Vue render error:', error)
          }
        </script>
      </body>
    </html>
  `
}

function generatePythonHTML(code: string): string {
  // For Python templates, show a message that browser preview isn't supported
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <script src="https://cdn.tailwindcss.com"></script>
        <style>
          body { 
            margin: 0; 
            font-family: system-ui, sans-serif;
            background: #f3f4f6;
          }
        </style>
      </head>
      <body>
        <div class="min-h-screen flex items-center justify-center p-4">
          <div class="bg-white rounded-lg shadow-lg p-8 max-w-md">
            <h2 class="text-2xl font-bold mb-4">Python Preview Not Available</h2>
            <p class="text-gray-600 mb-4">
              Browser-based preview is not available for Python templates (Streamlit/Gradio).
              These require a Python runtime environment.
            </p>
            <pre class="bg-gray-100 p-4 rounded overflow-x-auto">
              <code>${code.slice(0, 200)}${code.length > 200 ? '...' : ''}</code>
            </pre>
          </div>
        </div>
      </body>
    </html>
  `
}

function generateDefaultHTML(code: string): string {
  // Default fallback - try to detect the content type
  if (code.trim().startsWith('<!DOCTYPE') || code.trim().startsWith('<html')) {
    return code // Already valid HTML
  }
  
  // Wrap in basic HTML structure
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>
          body { 
            margin: 20px; 
            font-family: system-ui, sans-serif;
            line-height: 1.6;
          }
          pre {
            background: #f3f4f6;
            padding: 16px;
            border-radius: 8px;
            overflow-x: auto;
          }
        </style>
      </head>
      <body>
        ${code}
      </body>
    </html>
  `
}

const BrowserPreviewInner = forwardRef<BrowserPreviewHandle, BrowserPreviewProps>(({ 
  code, 
  template,
  onError,
  onReady,
  showConsole = false
}, ref) => {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const [status, setStatus] = useState<PreviewStatus>('loading')
  const [error, setError] = useState<Error | null>(null)
  const [loadProgress, setLoadProgress] = useState(0)
  const blobUrlRef = useRef<string | null>(null)
  
  // Use debounced code for updates (500ms delay)
  const debouncedCode = useDebounce(code, 500)
  
  // Use console capture hook
  const { messages: consoleMessages, clearMessages } = useIframeConsole(iframeRef)

  // Expose methods via ref
  useImperativeHandle(ref, () => ({
    iframe: iframeRef.current,
    refreshPreview: () => {
      if (iframeRef.current) {
        // Force refresh by recreating the blob URL
        if (blobUrlRef.current) {
          URL.revokeObjectURL(blobUrlRef.current)
        }
        generateAndSetContent()
        clearMessages()
      }
    }
  }), [clearMessages])

  // Handle iframe load event
  const handleIframeLoad = useCallback(() => {
    setStatus('ready')
    setLoadProgress(100)
    onReady?.()
  }, [onReady])

  // Handle iframe error event
  const handleIframeError = useCallback((event: ErrorEvent) => {
    const error = new Error(event.message || 'Failed to load preview')
    setStatus('error')
    setError(error)
    onError?.(error)
  }, [onError])

  // Generate and set HTML content with caching
  const generateAndSetContent = useCallback(() => {
    if (!iframeRef.current) return

    const startTime = performance.now()
    setStatus('loading')
    setError(null)
    setLoadProgress(10)

    try {
      // Generate HTML content with caching
      const { html, cacheHit } = generateCachedHTML(
        debouncedCode, 
        template, 
        generateHTMLContent
      )
      setLoadProgress(50)

      // Clean up previous blob URL
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current)
      }

      // Create a new blob URL
      const blob = new Blob([html], { type: 'text/html' })
      const blobUrl = URL.createObjectURL(blob)
      blobUrlRef.current = blobUrl
      
      // Set iframe source
      iframeRef.current.src = blobUrl
      setLoadProgress(80)

      // Track performance
      const endTime = performance.now()
      trackPerformance({
        compilationTime: 0,
        renderTime: endTime - startTime,
        cacheHit,
        totalTime: endTime - startTime,
        timestamp: Date.now()
      })
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to generate preview')
      setStatus('error')
      setError(error)
      onError?.(error)
    }
  }, [debouncedCode, template, onError])

  // Generate and set HTML content when debounced code changes
  useEffect(() => {
    if (!debouncedCode) return
    generateAndSetContent()
  }, [debouncedCode, template, generateAndSetContent])

  // Cleanup blob URL on unmount
  useEffect(() => {
    return () => {
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current)
      }
    }
  }, [])

  // Add error boundary for iframe
  useEffect(() => {
    const iframe = iframeRef.current
    if (!iframe) return

    // Listen for load and error events
    iframe.addEventListener('load', handleIframeLoad)
    iframe.addEventListener('error', handleIframeError as any)

    // Listen for errors from within the iframe
    const handleMessage = (event: MessageEvent) => {
      if (event.source === iframe.contentWindow && event.data?.type === 'error') {
        const error = new Error(event.data.message)
        setStatus('error')
        setError(error)
        onError?.(error)
      }
    }
    window.addEventListener('message', handleMessage)

    return () => {
      iframe.removeEventListener('load', handleIframeLoad)
      iframe.removeEventListener('error', handleIframeError as any)
      window.removeEventListener('message', handleMessage)
    }
  }, [handleIframeLoad, handleIframeError, onError])

  return (
    <div className="h-full flex flex-col bg-gray-50 dark:bg-gray-900">
      {/* Loading state */}
      {status === 'loading' && (
        <div className="p-4 border-b border-gray-200 dark:border-gray-800">
          <div className="flex items-center space-x-3">
            <span className="text-sm text-gray-600 dark:text-gray-400">Loading preview...</span>
            <div className="flex-1">
              <Progress value={loadProgress} className="h-1" />
            </div>
          </div>
        </div>
      )}

      {/* Error state */}
      {status === 'error' && error && (
        <Alert className="m-4" variant="destructive">
          <span className="font-semibold">Preview Error:</span> {error.message}
        </Alert>
      )}

      {/* Preview iframe */}
      <div className={`flex-1 relative ${showConsole ? 'h-2/3' : ''}`}>
        <iframe
          ref={iframeRef}
          className={`
            absolute inset-0 w-full h-full border-0 bg-white
            ${status === 'loading' ? 'opacity-0' : 'opacity-100'}
            transition-opacity duration-300
          `}
          sandbox="allow-scripts allow-modals allow-forms allow-popups allow-same-origin"
          title="Browser Preview"
          aria-label="Code preview"
        />
      </div>

      {/* Console output */}
      {showConsole && (
        <div className="h-1/3 border-t border-gray-200 dark:border-gray-800">
          <BrowserConsole messages={consoleMessages} onClear={clearMessages} />
        </div>
      )}
    </div>
  )
})

BrowserPreviewInner.displayName = 'BrowserPreviewInner'

// Memoized component with custom comparison
export const BrowserPreview = memo(BrowserPreviewInner, (prevProps, nextProps) => {
  // Use the shouldUpdatePreview utility for intelligent updates
  return !shouldUpdatePreview(
    prevProps.code,
    nextProps.code,
    prevProps.template,
    nextProps.template
  ) && 
  prevProps.showConsole === nextProps.showConsole &&
  prevProps.onError === nextProps.onError &&
  prevProps.onReady === nextProps.onReady
})

BrowserPreview.displayName = 'BrowserPreview'

// Error boundary wrapper for additional safety
export class BrowserPreviewErrorBoundary extends React.Component<
  { children: React.ReactNode; onError?: (error: Error) => void },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: any) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('BrowserPreview error:', error, errorInfo)
    this.props.onError?.(error)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="h-full flex items-center justify-center p-8">
          <Alert variant="destructive" className="max-w-md">
            <h3 className="font-semibold mb-2">Preview Component Error</h3>
            <p className="text-sm">{this.state.error?.message || 'An unexpected error occurred'}</p>
          </Alert>
        </div>
      )
    }

    return this.props.children
  }
}

// Export wrapped component
export function BrowserPreviewWithErrorBoundary(props: BrowserPreviewProps) {
  return (
    <BrowserPreviewErrorBoundary onError={props.onError}>
      <BrowserPreview {...props} />
    </BrowserPreviewErrorBoundary>
  )
} 