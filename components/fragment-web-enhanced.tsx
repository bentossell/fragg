'use client'

import { useState, useCallback } from 'react'
import { RefreshCw, ExternalLink, Maximize2 } from 'lucide-react'
import { CopyButton } from './ui/copy-button'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { ExecutionResultWeb } from '@/lib/types'
import { Card } from './ui/card'

export function FragmentWebEnhanced({ 
  result,
  onSandboxRefresh 
}: { 
  result: ExecutionResultWeb
  onSandboxRefresh?: (newSandboxId: string) => void
}) {
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [iframeKey, setIframeKey] = useState(0)
  
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true)
    
    try {
      // Force iframe reload
      setIframeKey(prev => prev + 1)
      
      // Optionally recreate sandbox if needed
      if (onSandboxRefresh) {
        // Call parent to handle sandbox recreation
        onSandboxRefresh(result.sbxId)
      }
    } finally {
      setTimeout(() => setIsRefreshing(false), 1000)
    }
  }, [result.sbxId, onSandboxRefresh])
  
  const handleFullscreen = () => {
    const iframe = document.getElementById('sandbox-iframe') as HTMLIFrameElement
    if (iframe && iframe.requestFullscreen) {
      iframe.requestFullscreen()
    }
  }
  
  return (
    <Card className="flex flex-col h-full overflow-hidden shadow-2xl md:rounded-tl-3xl md:rounded-bl-3xl md:border-l md:border-y bg-popover">
      {/* Preview */}
      <div className="flex-1 relative bg-white">
        {isRefreshing && (
          <div className="absolute inset-0 bg-background/80 z-10 flex items-center justify-center">
            <div className="flex flex-col items-center gap-2">
              <RefreshCw className="h-6 w-6 animate-spin" />
              <span className="text-sm text-muted-foreground">Refreshing...</span>
            </div>
          </div>
        )}
        <iframe
          key={iframeKey}
          id="sandbox-iframe"
          src={result.url}
          className="w-full h-full border-0"
          sandbox="allow-scripts allow-same-origin allow-forms allow-modals allow-popups allow-presentation allow-downloads"
          allow="accelerometer; camera; encrypted-media; geolocation; gyroscope; microphone; clipboard-write"
        />
      </div>
      {/* Toolbar at bottom */}
      <div className="flex items-center justify-between px-2 py-1 border-t bg-muted/50">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span className="text-xs text-muted-foreground truncate">
            {result.url}
          </span>
          <CopyButton content={result.url} className="h-6 w-6 flex-shrink-0" />
        </div>
        <div className="flex items-center gap-1">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={handleRefresh}
                  disabled={isRefreshing}
                >
                  <RefreshCw
                    className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin' : ''}`}
                  />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Refresh preview</TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => window.open(result.url, '_blank')}
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Open in new tab</TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={handleFullscreen}
                >
                  <Maximize2 className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Fullscreen</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>
    </Card>
  )
} 