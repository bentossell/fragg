import { CopyButton } from './ui/copy-button'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { ExecutionResultWeb } from '@/lib/types'
import { RotateCw, ExternalLink, ShieldAlert } from 'lucide-react'
import { useState, useEffect } from 'react'

export function FragmentWeb({ result }: { result: ExecutionResultWeb }) {
  const [iframeKey, setIframeKey] = useState(0)
  const [isBlocked, setIsBlocked] = useState(false)
  
  // Check for iframe blocking after a short delay
  useEffect(() => {
    if (!result?.url) return
    
    let mounted = true
    const timer = setTimeout(() => {
      if (!mounted) return
      
      // Check if iframe exists and try to access contentWindow
      const iframe = document.querySelector('iframe') as HTMLIFrameElement
      if (iframe) {
        try {
          // This will throw if blocked by CORS or content blocker
          const test = iframe.contentWindow?.location.href
        } catch (e) {
          // If we can't access the iframe content, it's likely blocked
          setIsBlocked(true)
        }
      }
    }, 3000) // Give iframe time to load
    
    return () => {
      mounted = false
      clearTimeout(timer)
    }
  }, [result?.url, iframeKey])
  
  if (!result) return null
  
  // Check if URL is valid
  if (!result.url) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-8">
        <div className="text-muted-foreground space-y-2">
          <p className="text-lg font-semibold">Sandbox not found</p>
          <p className="text-sm">The sandbox URL is not available. This might be due to:</p>
          <ul className="text-sm mt-2 space-y-1">
            <li>• Sandbox creation failed</li>
            <li>• Template access denied</li>
            <li>• Network connectivity issues</li>
          </ul>
          <p className="text-sm mt-4">Please try generating the app again.</p>
        </div>
      </div>
    )
  }
  
  function refreshIframe() {
    setIframeKey((prevKey) => prevKey + 1)
    setIsBlocked(false)
  }

  return (
    <div className="flex flex-col w-full h-full">
      {isBlocked ? (
        <div className="flex flex-col items-center justify-center h-full text-center p-8">
          <div className="text-muted-foreground space-y-4">
            <ShieldAlert className="h-12 w-12 mx-auto text-yellow-500" />
            <p className="text-lg font-semibold">Content Blocked</p>
            <p className="text-sm max-w-md">
              The preview is being blocked by your browser or an extension (like an ad blocker).
            </p>
            <div className="space-y-3 mt-6">
              <p className="text-sm font-medium">To view the preview:</p>
              <ol className="text-sm text-left space-y-2 max-w-md mx-auto">
                <li>1. Disable any ad blockers or content blockers for this site</li>
                <li>2. Allow e2b.app domains in your browser settings</li>
                <li>3. Or open the sandbox directly in a new tab:</li>
              </ol>
              <Button
                variant="default"
                className="mt-4"
                onClick={() => window.open(result.url, '_blank')}
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                Open in New Tab
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <iframe
          key={iframeKey}
          className="h-full w-full"
          sandbox="allow-forms allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"
          loading="lazy"
          src={result.url}
          onError={() => setIsBlocked(true)}
        />
      )}
      <div className="p-2 border-t">
        <div className="flex items-center bg-muted dark:bg-white/10 rounded-2xl">
          <TooltipProvider>
            <Tooltip delayDuration={0}>
              <TooltipTrigger asChild>
                <Button
                  variant="link"
                  className="text-muted-foreground"
                  onClick={refreshIframe}
                >
                  <RotateCw className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Refresh</TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <span className="text-muted-foreground text-xs flex-1 text-ellipsis overflow-hidden whitespace-nowrap">
            {result.url}
          </span>
          <TooltipProvider>
            <Tooltip delayDuration={0}>
              <TooltipTrigger asChild>
                <CopyButton
                  variant="link"
                  content={result.url}
                  className="text-muted-foreground"
                />
              </TooltipTrigger>
              <TooltipContent>Copy URL</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>
    </div>
  )
}
