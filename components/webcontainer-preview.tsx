'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { WebContainerService, WebContainerStatus } from '@/lib/sandbox/webcontainer-service';
import { FragmentSchema } from '@/lib/schema';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Alert } from '@/components/ui/alert';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { RefreshCw, ExternalLink, Maximize2, XCircle } from 'lucide-react';
import { CopyButton } from './ui/copy-button';
import { useIframeConsole } from '@/lib/hooks/use-iframe-console';
import { BrowserConsole } from './browser-console';

interface WebContainerPreviewProps {
  fragment: FragmentSchema;
  onError?: (error: Error) => void;
  onReady?: () => void;
  showConsole?: boolean;
  onRefresh?: () => void;
}

export function WebContainerPreview({
  fragment,
  onError,
  onReady,
  showConsole = false,
  onRefresh
}: WebContainerPreviewProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [status, setStatus] = useState<WebContainerStatus>('initializing');
  const [progress, setProgress] = useState(0);
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [iframeKey, setIframeKey] = useState(0);
  
  // Console integration
  const { logs, clearLogs } = useIframeConsole(iframeRef);

  // Status to progress mapping
  const statusToProgress = {
    'initializing': 5,
    'booting': 10,
    'ready': 20,
    'mounting': 40,
    'installing': 60,
    'starting': 80,
    'running': 100,
    'error': 0
  };

  // Status to display message mapping
  const statusToMessage = {
    'initializing': 'Initializing WebContainer...',
    'booting': 'Booting Node.js environment...',
    'ready': 'Preparing files...',
    'mounting': 'Mounting project files...',
    'installing': 'Installing dependencies...',
    'starting': 'Starting development server...',
    'running': 'Application running',
    'error': 'Error starting application'
  };

  // Handle status updates from WebContainerService
  const handleStatusUpdate = useCallback((newStatus: WebContainerStatus, details?: any) => {
    setStatus(newStatus);
    setProgress(statusToProgress[newStatus] || 0);
    
    if (newStatus === 'error') {
      const errorMessage = details instanceof Error 
        ? details.message 
        : typeof details === 'string' 
          ? details 
          : 'Unknown error occurred';
      
      setError(errorMessage);
      onError?.(new Error(errorMessage));
    }
    
    if (newStatus === 'running' && details?.url) {
      setPreviewUrl(details.url);
      setIsRefreshing(false);
      onReady?.();
    }
  }, [onError, onReady]);

  // Initialize WebContainer and create app
  useEffect(() => {
    if (!fragment || !fragment.code || !fragment.template) return;
    
    const initWebContainer = async () => {
      try {
        setStatus('initializing');
        setProgress(5);
        setError(null);
        
        const url = await WebContainerService.createAppFromTemplate(
          fragment.template,
          fragment.code,
          handleStatusUpdate
        );
        
        setPreviewUrl(url);
        setStatus('running');
        setProgress(100);
        onReady?.();
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to initialize WebContainer';
        setError(errorMessage);
        setStatus('error');
        setProgress(0);
        onError?.(new Error(errorMessage));
      }
    };
    
    initWebContainer();
    
    // Cleanup
    return () => {
      WebContainerService.removeStatusListener(handleStatusUpdate);
    };
  }, [fragment?.code, fragment?.template, handleStatusUpdate, onError, onReady]);

  // Handle refresh
  const handleRefresh = useCallback(async () => {
    if (isRefreshing) return;
    
    setIsRefreshing(true);
    setIframeKey(prev => prev + 1);
    
    // If custom refresh handler provided, use it
    if (onRefresh) {
      onRefresh();
      return;
    }
    
    // Otherwise, refresh the iframe
    if (previewUrl && iframeRef.current) {
      iframeRef.current.src = previewUrl;
      setTimeout(() => setIsRefreshing(false), 1000);
    } else {
      // Re-initialize if no URL available
      if (fragment && fragment.code && fragment.template) {
        try {
          const url = await WebContainerService.createAppFromTemplate(
            fragment.template,
            fragment.code,
            handleStatusUpdate
          );
          setPreviewUrl(url);
        } catch (err) {
          const errorMessage = err instanceof Error ? err.message : 'Failed to refresh';
          setError(errorMessage);
          onError?.(new Error(errorMessage));
        } finally {
          setIsRefreshing(false);
        }
      } else {
        setIsRefreshing(false);
      }
    }
  }, [fragment, handleStatusUpdate, isRefreshing, onError, onRefresh, previewUrl]);

  // Handle fullscreen
  const handleFullscreen = useCallback(() => {
    if (iframeRef.current && iframeRef.current.requestFullscreen) {
      iframeRef.current.requestFullscreen().catch(err => {
        console.error('Error attempting to enable fullscreen:', err);
      });
    }
  }, []);

  // Render loading state
  if (status !== 'running' && status !== 'error') {
    return (
      <Card className="flex flex-col h-full overflow-hidden shadow-2xl md:rounded-3xl bg-popover">
        <div className="flex-1 flex flex-col items-center justify-center p-8 space-y-6">
          <div className="w-full max-w-md space-y-4">
            <h3 className="text-lg font-medium text-center">
              {statusToMessage[status]}
            </h3>
            <Progress value={progress} className="w-full" />
            <p className="text-sm text-muted-foreground text-center">
              {status === 'installing' && 'This might take a moment...'}
              {status === 'starting' && 'Almost there...'}
            </p>
          </div>
        </div>
      </Card>
    );
  }

  // Render error state
  if (status === 'error') {
    return (
      <Card className="flex flex-col h-full overflow-hidden shadow-2xl md:rounded-3xl bg-popover">
        <div className="flex-1 flex flex-col items-center justify-center p-8">
          <div className="w-full max-w-md space-y-4">
            <div className="flex items-center justify-center">
              <XCircle className="h-12 w-12 text-destructive" />
            </div>
            <h3 className="text-lg font-medium text-center text-destructive">
              Failed to start application
            </h3>
            <Alert variant="destructive" className="text-sm">
              {error || 'An unknown error occurred'}
            </Alert>
            <div className="flex justify-center pt-4">
              <Button onClick={handleRefresh} variant="outline">
                <RefreshCw className="h-4 w-4 mr-2" />
                Try Again
              </Button>
            </div>
          </div>
        </div>
      </Card>
    );
  }

  // Render running state
  return (
    <Card className="flex flex-col h-full overflow-hidden shadow-2xl md:rounded-3xl bg-popover">
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
          ref={iframeRef}
          src={previewUrl}
          className="w-full h-full border-0"
          sandbox="allow-scripts allow-same-origin allow-forms allow-modals allow-popups allow-presentation allow-downloads"
          allow="accelerometer; camera; encrypted-media; geolocation; gyroscope; microphone; clipboard-write"
        />
      </div>
      
      {/* Console (optional) */}
      {showConsole && (
        <div className="h-1/3 border-t">
          <BrowserConsole logs={logs} onClear={clearLogs} />
        </div>
      )}
      
      {/* Toolbar at bottom */}
      <div className="flex items-center justify-between px-2 py-1 border-t bg-muted/50">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span className="text-xs text-muted-foreground truncate">
            {previewUrl}
          </span>
          <CopyButton content={previewUrl} className="h-6 w-6 flex-shrink-0" />
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
                  onClick={handleFullscreen}
                >
                  <Maximize2 className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Fullscreen</TooltipContent>
            </Tooltip>
          </TooltipProvider>
          
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => window.open(previewUrl, '_blank')}
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Open in new tab</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>
    </Card>
  );
}
