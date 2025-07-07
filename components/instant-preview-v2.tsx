'use client'

import { useEffect, useRef, useState } from 'react'
import { Loader2, AlertCircle } from 'lucide-react'

interface InstantPreviewProps {
  code: string
  dependencies?: string[]
}

export function InstantPreview({ code, dependencies = [] }: InstantPreviewProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const [isInitialized, setIsInitialized] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loadTime, setLoadTime] = useState<number | null>(null)
  const initStartTime = useRef(Date.now())
  
  // Initialize iframe once
  useEffect(() => {
    if (!iframeRef.current || isInitialized) return
    
    const iframe = iframeRef.current
    const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document
    
    if (!iframeDoc) {
      setError('Failed to access iframe document')
      return
    }
    
    // Build the HTML content with CDN-loaded React
    const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Instant Preview</title>
  <script crossorigin src="https://unpkg.com/react@18/umd/react.development.js"></script>
  <script crossorigin src="https://unpkg.com/react-dom@18/umd/react-dom.development.js"></script>
  <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
  <script src="https://cdn.tailwindcss.com"></script>
  ${dependencies.map(dep => {
    if (dep === 'lucide-react') {
      return '<script src="https://unpkg.com/lucide@latest/dist/umd/lucide.js"></script>'
    }
    return ''
  }).join('\n')}
  <style>
    body {
      margin: 0;
      padding: 16px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    }
    #root {
      width: 100%;
      height: 100%;
    }
    .error {
      color: red;
      padding: 16px;
      border: 1px solid red;
      border-radius: 4px;
      background: #fee;
    }
  </style>
</head>
<body>
  <div id="root"></div>
  <script>
    // Function to update code
    window.updatePreviewCode = function(newCode) {
      const startTime = Date.now();
      
      // Clear existing content
      document.getElementById('root').innerHTML = '';
      
      // Make Lucide icons available globally
      if (window.lucide) {
        window.LucideIcons = window.lucide;
      }
      
      try {
        // Transform and execute the code
        const transformedCode = Babel.transform(newCode + '\\n\\n' + 
          "if (typeof App !== 'undefined') { " +
          "  const root = ReactDOM.createRoot(document.getElementById('root')); " +
          "  root.render(<App />); " +
          "}", {
          presets: ['react']
        }).code;
        
        // Execute the transformed code
        eval(transformedCode);
        
        // Notify parent of success
        window.parent.postMessage({ 
          type: 'preview-loaded',
          loadTime: Date.now() - startTime
        }, '*');
      } catch (error) {
        document.getElementById('root').innerHTML = 
          '<div class="error">Error: ' + error.message + '</div>';
        console.error('Preview error:', error);
        window.parent.postMessage({ 
          type: 'preview-error', 
          error: error.message 
        }, '*');
      }
    };
    
    // Notify parent that iframe is ready
    window.parent.postMessage({ type: 'iframe-ready' }, '*');
  </script>
</body>
</html>
`
    
    // Write the content to iframe
    iframeDoc.open()
    iframeDoc.write(htmlContent)
    iframeDoc.close()
    
    // Listen for iframe ready message
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'iframe-ready') {
        setIsInitialized(true)
        window.removeEventListener('message', handleMessage)
      }
    }
    
    window.addEventListener('message', handleMessage)
    
    // Timeout after 5 seconds
    const timeout = setTimeout(() => {
      if (!isInitialized) {
        setError('Iframe initialization timed out')
        window.removeEventListener('message', handleMessage)
      }
    }, 5000)
    
    return () => {
      window.removeEventListener('message', handleMessage)
      clearTimeout(timeout)
    }
  }, [isInitialized, dependencies])
  
  // Update code when it changes
  useEffect(() => {
    if (!isInitialized || !iframeRef.current?.contentWindow) return
    
    // Listen for preview messages
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'preview-loaded') {
        setLoadTime(event.data.loadTime)
        setError(null)
      } else if (event.data?.type === 'preview-error') {
        setError(event.data.error || 'Preview error')
      }
    }
    
    window.addEventListener('message', handleMessage)
    
    // Send code update to iframe
    iframeRef.current.contentWindow.postMessage({
      type: 'update-code',
      code: code
    }, '*')
    
    // Call the update function directly
    try {
      (iframeRef.current.contentWindow as any).updatePreviewCode(code)
    } catch (err) {
      console.error('Failed to update preview code:', err)
    }
    
    return () => {
      window.removeEventListener('message', handleMessage)
    }
  }, [code, isInitialized])
  
  return (
    <div className="flex flex-col h-full relative">
      {!isInitialized && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/80 z-10">
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="h-8 w-8 animate-spin" />
            <p className="text-sm text-muted-foreground">Initializing preview...</p>
          </div>
        </div>
      )}
      
      {error && (
        <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-md m-4">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-destructive" />
            <p className="text-sm text-destructive">{error}</p>
          </div>
        </div>
      )}

      <iframe
        ref={iframeRef}
        className="flex-1 w-full border-0"
        sandbox="allow-scripts allow-same-origin"
        title="Instant Preview"
        style={{ minHeight: '400px' }}
      />

      {loadTime !== null && (
        <div className="p-2 border-t bg-muted/50 text-center">
          <p className="text-xs text-muted-foreground">
            Updated in {loadTime}ms
          </p>
        </div>
      )}
    </div>
  )
}