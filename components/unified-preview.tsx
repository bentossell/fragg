'use client'

import { useState, useEffect, useCallback, Dispatch, SetStateAction } from 'react'
import { useLocalStorage } from 'usehooks-ts'
import { GenerationLoading } from './generation-loading'
import { RealTimeCodeStreaming } from './code-streaming'
import { ShareButton } from './share-button'
import { VersionHistory } from './version-history'
import { FragmentCode } from './fragment-code'
import { FragmentPreview } from './fragment-preview'
import { DeployDialog } from './deploy-dialog'
import { DeepPartial } from 'ai'
import { FragmentSchema } from '@/lib/schema'
import { ExecutionResult } from '@/lib/types'
import { Card } from './ui/card'
import { Button } from './ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs'
import { Badge } from './ui/badge'
import { Progress } from './ui/progress'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from './ui/tooltip'
import { 
  Pencil, 
  Check, 
  X, 
  ChevronLeft, 
  ChevronRight, 
  ChevronsRight, 
  LoaderCircle,
  Pause,
  Play,
  Square,
  Volume2,
  VolumeX,
  Maximize2,
  Minimize2,
  Monitor
} from 'lucide-react'
import { shouldUseBrowserPreview, templateSupportsBrowserPreview } from '@/lib/feature-flags'
import type { TemplateId } from '@/lib/templates'

interface FragmentVersion {
  fragment: DeepPartial<FragmentSchema>
  result?: ExecutionResult
  timestamp: number
}

interface StreamingProgress {
  stage: 'connecting' | 'thinking' | 'planning' | 'coding' | 'reviewing' | 'complete' | 'error'
  progress: number
  message: string
  estimatedTime?: number
  elapsedTime?: number
  canPause?: boolean
  isPaused?: boolean
  errors?: string[]
  warnings?: string[]
}

interface UnifiedPreviewProps {
  // Core fragment and result
  fragment?: DeepPartial<FragmentSchema>
  result?: ExecutionResult
  
  // Loading states
  isLoading: boolean
  isGenerating: boolean
  isPreviewLoading?: boolean
  isAutoSaving?: boolean
  
  // Enhanced streaming props
  streamingProgress?: StreamingProgress
  onStreamingPause?: () => void
  onStreamingCancel?: () => void
  enableSoundEffects?: boolean
  onSoundToggle?: () => void
  
  // App and session info
  currentAppId: string | null
  appName: string
  template: string
  messages: any[]
  userId?: string
  
  // Tab management
  selectedTab?: 'code' | 'fragment'
  onSelectedTabChange?: Dispatch<SetStateAction<'code' | 'fragment'>>
  
  // App management
  onAppNameChange?: (name: string) => void
  onSave?: () => void
  canSave?: boolean
  
  // Version management
  fragmentVersions?: FragmentVersion[]
  currentVersionIndex?: number
  onVersionChange?: (index: number) => void
  onPreviousVersion?: () => void
  onNextVersion?: () => void
  
  // Sandbox management
  onSandboxRecreate?: (fragment: DeepPartial<FragmentSchema>) => Promise<ExecutionResult>
  
  // UI options
  showTabs?: boolean
  showClose?: boolean
  onClose?: () => void
  fullScreenMode?: boolean
  onFullScreenToggle?: () => void
  
  // Deploy options
  teamID?: string
  accessToken?: string
}

export function UnifiedPreview({
  fragment,
  result,
  isLoading,
  isGenerating,
  isPreviewLoading = false,
  isAutoSaving = false,
  streamingProgress,
  onStreamingPause,
  onStreamingCancel,
  enableSoundEffects = false,
  onSoundToggle,
  currentAppId,
  appName,
  template,
  messages,
  userId,
  selectedTab = 'code',
  onSelectedTabChange,
  onAppNameChange,
  onSave,
  canSave,
  fragmentVersions,
  currentVersionIndex,
  onVersionChange,
  onPreviousVersion,
  onNextVersion,
  onSandboxRecreate,
  showTabs = true,
  showClose = false,
  onClose,
  fullScreenMode = false,
  onFullScreenToggle,
  teamID,
  accessToken,
}: UnifiedPreviewProps) {
  const [isEditingName, setIsEditingName] = useState(false)
  const [editingName, setEditingName] = useState(appName || '')
  const [justSaved, setJustSaved] = useState(false)
  const [localProgress, setLocalProgress] = useState(0)
  const [showGenerationDetails, setShowGenerationDetails] = useState(true)
  
  // Panel state for dual-panel layout
  const [leftPanelCollapsed, setLeftPanelCollapsed] = useLocalStorage('left-panel-collapsed', false)
  const [rightPanelCollapsed, setRightPanelCollapsed] = useLocalStorage('right-panel-collapsed', false)
  
  // Suppress unused variable warnings - these are used for localStorage but not directly in render
  void leftPanelCollapsed
  void setLeftPanelCollapsed
  void rightPanelCollapsed
  void setRightPanelCollapsed
  void canSave
  
  useEffect(() => {
    setEditingName(appName || '')
  }, [appName])
  
  const handleSaveName = () => {
    if (onAppNameChange && editingName.trim()) {
      onAppNameChange(editingName.trim())
      if (onSave) {
        onSave()
        setJustSaved(true)
        setTimeout(() => setJustSaved(false), 2000)
      }
      setIsEditingName(false)
    }
  }
  
  const handleCancelEdit = () => {
    setEditingName(appName || '')
    setIsEditingName(false)
  }
  
  // Handle version navigation
  const handleVersionChange = useCallback((index: number) => {
    if (onVersionChange) {
      onVersionChange(index)
    }
  }, [onVersionChange])
  
  // Enhanced generation progress tracking
  useEffect(() => {
    if (streamingProgress) {
      setLocalProgress(streamingProgress.progress)
    } else if (isGenerating) {
      // Fallback progress simulation
      const interval = setInterval(() => {
        setLocalProgress(prev => {
          const increment = Math.random() * 5 + 1
          return Math.min(prev + increment, 90)
        })
      }, 500)
      
      return () => clearInterval(interval)
    } else {
      setLocalProgress(0)
    }
  }, [streamingProgress, isGenerating])
  
  // Sandbox refresh handler
  const handleSandboxRefresh = useCallback(async (sandboxId: string) => {
    if (!fragment || !onSandboxRecreate) return
    
    try {
      const newResult = await onSandboxRecreate(fragment)
      console.log('Sandbox refreshed:', newResult)
    } catch (error) {
      console.error('Failed to refresh sandbox:', error)
    }
  }, [fragment, onSandboxRecreate])
  
  // Cleanup effect
  useEffect(() => {
    return () => {
      // Cleanup when component unmounts
      if (result?.sbxId && fragment?.template) {
        // Release sandbox back to pool
        fetch('/api/sandbox', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            sandboxId: result.sbxId, 
            template: fragment.template 
          })
        }).catch(err => console.error('Failed to release sandbox:', err))
      }
    }
  }, [result?.sbxId, fragment?.template])
  
  // Suppress unused variable warning
  void handleSandboxRefresh
  
  // Determine if preview should be enabled
  const canShowPreview = !!result || (
    fragment && shouldUseBrowserPreview(userId) && templateSupportsBrowserPreview(fragment.template as TemplateId)
  );
  
  if (!fragment && !isGenerating && !isLoading) {
    return null
  }
  
  // Enhanced loading state with streaming progress
  if (isGenerating || isLoading) {
    return (
      <Card className={`h-full flex flex-col ${fullScreenMode ? 'fixed inset-0 z-50' : ''}`}>
        {/* Enhanced generation header */}
        <div className="flex items-center justify-between p-4 border-b bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20">
          <div className="flex items-center gap-3">
            <Badge variant="secondary" className="animate-pulse">
              <div className="w-2 h-2 bg-green-500 rounded-full mr-2 animate-ping" />
              {streamingProgress?.stage || 'Generating'}
            </Badge>
            
            {streamingProgress && (
              <span className="text-sm font-medium">
                {Math.round(streamingProgress.progress)}%
              </span>
            )}
          </div>
          
          <div className="flex items-center gap-2">
            {/* Sound toggle */}
            {onSoundToggle && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onSoundToggle}
                className="h-8 w-8 p-0"
              >
                {enableSoundEffects ? (
                  <Volume2 className="h-4 w-4" />
                ) : (
                  <VolumeX className="h-4 w-4" />
                )}
              </Button>
            )}
            
            {/* Streaming controls */}
            {streamingProgress?.canPause && onStreamingPause && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onStreamingPause}
                className="h-8 w-8 p-0"
              >
                {streamingProgress.isPaused ? (
                  <Play className="h-4 w-4" />
                ) : (
                  <Pause className="h-4 w-4" />
                )}
              </Button>
            )}
            
            {onStreamingCancel && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onStreamingCancel}
                className="h-8 w-8 p-0 text-red-500"
              >
                <Square className="h-4 w-4" />
              </Button>
            )}
            
            {/* Full screen toggle */}
            {onFullScreenToggle && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onFullScreenToggle}
                className="h-8 w-8 p-0"
              >
                {fullScreenMode ? (
                  <Minimize2 className="h-4 w-4" />
                ) : (
                  <Maximize2 className="h-4 w-4" />
                )}
              </Button>
            )}
          </div>
        </div>
        
        {/* Enhanced progress display */}
        {streamingProgress && (
          <div className="px-4 py-3 bg-muted/50">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">
                {streamingProgress.message}
              </span>
              {streamingProgress.estimatedTime && streamingProgress.elapsedTime && (
                <span className="text-xs text-muted-foreground">
                  {Math.max(0, streamingProgress.estimatedTime - streamingProgress.elapsedTime / 1000)}s remaining
                </span>
              )}
            </div>
            <Progress value={streamingProgress.progress} className="h-2" />
            
            {/* Error/Warning display */}
            {streamingProgress.errors && streamingProgress.errors.length > 0 && (
              <div className="mt-2 text-sm text-red-600 dark:text-red-400">
                {streamingProgress.errors[streamingProgress.errors.length - 1]}
              </div>
            )}
            
            {streamingProgress.warnings && streamingProgress.warnings.length > 0 && (
              <div className="mt-2 text-sm text-yellow-600 dark:text-yellow-400">
                {streamingProgress.warnings[streamingProgress.warnings.length - 1]}
              </div>
            )}
          </div>
        )}
        
        {/* Generation stage visualization */}
        <div className="flex-1 flex items-center justify-center p-8">
          <GenerationLoading 
            stage={
              streamingProgress?.stage === 'connecting' ? 'analyzing' :
              streamingProgress?.stage === 'thinking' ? 'thinking' :
              streamingProgress?.stage === 'planning' ? 'planning' :
              streamingProgress?.stage === 'coding' ? 'generating' :
              streamingProgress?.stage === 'reviewing' ? 'reviewing' :
              streamingProgress?.stage === 'complete' ? 'complete' :
              streamingProgress?.stage === 'error' ? 'analyzing' :
              'analyzing'
            }
            progress={streamingProgress?.progress || localProgress}
            message={streamingProgress?.message}
            showDetails={showGenerationDetails}
            showEstimatedTime={!!streamingProgress?.estimatedTime}
            estimatedTime={streamingProgress?.estimatedTime}
          />
        </div>
        
        {/* Show streaming code if available */}
        {fragment?.code && (
          <div className="border-t p-4 max-h-40 overflow-y-auto bg-muted/30">
            <div className="text-xs text-muted-foreground mb-2">Generated Code (Streaming...)</div>
            <pre className="text-xs bg-background p-2 rounded border overflow-x-auto">
              <code>{fragment.code.substring(0, 500)}{fragment.code.length > 500 ? '...' : ''}</code>
            </pre>
          </div>
        )}
        
        {/* Generation details toggle */}
        <div className="p-4 border-t flex justify-center">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowGenerationDetails(!showGenerationDetails)}
            className="text-xs"
          >
            {showGenerationDetails ? 'Hide Details' : 'Show Details'}
          </Button>
        </div>
      </Card>
    )
  }
  
  // Show placeholder if no fragment and not generating
  if (!fragment && !isGenerating && !isLoading) {
    return (
      <Card className={`h-full flex flex-col items-center justify-center ${fullScreenMode ? 'fixed inset-0 z-50' : ''}`}>
        <div className="text-center p-8">
          <div className="text-muted-foreground mb-4">
            <Maximize2 className="h-12 w-12 mx-auto mb-2 opacity-50" />
          </div>
          <h3 className="text-lg font-medium mb-2">No Code Generated Yet</h3>
          <p className="text-sm text-muted-foreground">
            Start a conversation to generate your first application.
          </p>
        </div>
      </Card>
    )
  }
  
  const isLinkAvailable = result?.template !== 'code-interpreter-v1'
  
  // Enhanced tab-based layout
  if (showTabs) {
    return (
      <div className={`h-full overflow-hidden shadow-2xl md:rounded-tl-3xl md:rounded-bl-3xl md:border-l md:border-y bg-popover ${fullScreenMode ? 'fixed inset-0 z-50 rounded-none border-0' : ''}`}>
        <Tabs
          value={selectedTab}
          onValueChange={(value) =>
            onSelectedTabChange && onSelectedTabChange(value as 'code' | 'fragment')
          }
          className="h-full flex flex-col"
        >
          <div className="w-full p-2 grid grid-cols-3 items-center border-b flex-shrink-0">
            {/* Close button */}
            {showClose && onClose && (
              <TooltipProvider>
                <Tooltip delayDuration={0}>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-muted-foreground justify-self-start"
                      onClick={onClose}
                    >
                      <ChevronsRight className="h-5 w-5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Close sidebar</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
            
            {/* Center: Tabs and version navigation */}
            <div className="flex justify-center items-center gap-2">
              <TabsList className="px-1 py-0 border h-8">
                <TabsTrigger
                  className="font-normal text-xs py-1 px-2 gap-1 flex items-center"
                  value="code"
                >
                  {isGenerating && (
                    <LoaderCircle
                      strokeWidth={3}
                      className="h-3 w-3 animate-spin"
                    />
                  )}
                  Code
                  {fragment?.code && (
                    <Badge variant="secondary" className="h-4 px-1 text-xs">
                      {Math.round((fragment.code.length / 1000)).toFixed(0)}k
                    </Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger
                  disabled={!canShowPreview}
                  className="font-normal text-xs py-1 px-2 gap-1 flex items-center"
                  value="fragment"
                >
                  Preview
                  {isPreviewLoading && (
                    <LoaderCircle
                      strokeWidth={3}
                      className="h-3 w-3 animate-spin"
                    />
                  )}
                  {result && 'url' in result && (
                    <Badge variant="secondary" className="h-4 px-1 text-xs">
                      Live
                    </Badge>
                  )}
                </TabsTrigger>
              </TabsList>
              
              {/* Version navigation */}
              {fragmentVersions && fragmentVersions.length > 1 && currentVersionIndex !== undefined && (
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={onPreviousVersion || (() => handleVersionChange(currentVersionIndex - 1))}
                    disabled={currentVersionIndex === 0}
                  >
                    <ChevronLeft className="h-3 w-3" />
                  </Button>
                  <span className="text-xs text-muted-foreground">
                    {currentVersionIndex + 1} / {fragmentVersions.length}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={onNextVersion || (() => handleVersionChange(currentVersionIndex + 1))}
                    disabled={currentVersionIndex === fragmentVersions.length - 1}
                  >
                    <ChevronRight className="h-3 w-3" />
                  </Button>
                </div>
              )}
            </div>
            
            {/* Right: App name and actions */}
            <div className="flex items-center justify-end gap-2">
              {/* Full screen toggle */}
              {onFullScreenToggle && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onFullScreenToggle}
                  className="h-8 w-8 p-0"
                >
                  {fullScreenMode ? (
                    <Minimize2 className="h-4 w-4" />
                  ) : (
                    <Maximize2 className="h-4 w-4" />
                  )}
                </Button>
              )}
              
              {isAutoSaving && (
                <div className="flex items-center gap-1 px-2 py-1 bg-muted rounded-md animate-pulse">
                  <LoaderCircle className="h-3 w-3 animate-spin text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">Auto-saving...</span>
                </div>
              )}
              
              {/* App name editing */}
              {onAppNameChange && (
                <div className="flex items-center gap-1 group relative">
                  {isEditingName ? (
                    <>
                      <input
                        type="text"
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault()
                            handleSaveName()
                          } else if (e.key === 'Escape') {
                            handleCancelEdit()
                          }
                        }}
                        placeholder="App name..."
                        className="px-2 py-1 text-xs border rounded-md max-w-[120px]"
                        autoFocus
                      />
                      <Button
                        onClick={handleSaveName}
                        size="icon"
                        variant="ghost"
                        className="h-6 w-6"
                      >
                        <Check className="h-3 w-3 text-green-600" />
                      </Button>
                      <Button
                        onClick={handleCancelEdit}
                        size="icon"
                        variant="ghost"
                        className="h-6 w-6"
                      >
                        <X className="h-3 w-3 text-red-600" />
                      </Button>
                    </>
                  ) : (
                    <>
                      <span className="text-xs px-2 py-1 max-w-[120px] truncate">
                        {appName || 'Untitled App'}
                      </span>
                      <Button
                        onClick={() => setIsEditingName(true)}
                        size="icon"
                        variant="ghost"
                        className={`h-6 w-6 ${justSaved ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'} transition-opacity`}
                      >
                        {justSaved ? (
                          <Check className="h-3 w-3 text-green-600" />
                        ) : (
                          <Pencil className="h-3 w-3" />
                        )}
                      </Button>
                    </>
                  )}
                </div>
              )}
              
              {/* Deploy dialog */}
              {result && isLinkAvailable && teamID && accessToken && (
                <DeployDialog
                  url={result.url!}
                  sbxId={result.sbxId!}
                  teamID={teamID}
                  accessToken={accessToken}
                />
              )}
            </div>
          </div>
          
          {/* Tab content */}
          <div className="overflow-y-auto w-full h-full">
            <TabsContent value="code" className="h-full m-0">
              {fragment?.code && fragment?.file_path ? (
                <FragmentCode
                  files={[
                    {
                      name: fragment.file_path,
                      content: fragment.code,
                    },
                  ]}
                />
              ) : (
                <div className="h-full flex items-center justify-center p-8">
                  <div className="text-center">
                    <div className="text-muted-foreground mb-4">
                      <LoaderCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {isGenerating ? 'Generating code...' : 'No code available'}
                    </p>
                  </div>
                </div>
              )}
            </TabsContent>
            <TabsContent value="fragment" className="h-full m-0">
              {fragment ? (
                <FragmentPreview 
                  result={result || undefined} 
                  fragment={fragment ? {
                    code: fragment.code || '',
                    template: fragment.template || template || 'nextjs-developer',
                    file_path: fragment.file_path
                  } : undefined}
                  userId={userId}
                />
              ) : (
                <div className="h-full flex items-center justify-center p-8">
                  <div className="text-center">
                    <div className="text-muted-foreground mb-4">
                      <Monitor className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {isPreviewLoading ? 'Creating preview...' : 'No preview available'}
                    </p>
                  </div>
                </div>
              )}
            </TabsContent>
          </div>
        </Tabs>
      </div>
    )
  }
  
  // Enhanced layout (no tabs)
  return (
    <div className={`h-full flex flex-col gap-2 ${fullScreenMode ? 'fixed inset-0 z-50 bg-background p-4' : ''}`}>
      {/* Enhanced action bar */}
      {fragment && currentAppId && (
        <div className="flex items-center justify-between px-2 py-1">
          <div className="flex items-center gap-2">
            {/* App name editing */}
            {onAppNameChange && (
              <div className="flex items-center gap-1 group relative">
                {isEditingName ? (
                  <>
                    <input
                      type="text"
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          handleSaveName()
                        } else if (e.key === 'Escape') {
                          handleCancelEdit()
                        }
                      }}
                      placeholder="App name..."
                      className="px-2 py-1 text-sm border rounded-md min-w-[120px] max-w-[200px]"
                      autoFocus
                    />
                    <Button
                      onClick={handleSaveName}
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7"
                    >
                      <Check className="h-3 w-3 text-green-600" />
                    </Button>
                    <Button
                      onClick={handleCancelEdit}
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7"
                    >
                      <X className="h-3 w-3 text-red-600" />
                    </Button>
                  </>
                ) : (
                  <>
                    <span className="text-sm px-2 py-1 min-w-[120px] max-w-[200px] truncate font-medium">
                      {appName || 'Untitled App'}
                    </span>
                    <Button
                      onClick={() => setIsEditingName(true)}
                      size="icon"
                      variant="ghost"
                      className={`h-7 w-7 ${justSaved ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'} transition-opacity`}
                    >
                      {justSaved ? (
                        <Check className="h-3 w-3 text-green-600" />
                      ) : (
                        <Pencil className="h-3 w-3" />
                      )}
                    </Button>
                  </>
                )}
              </div>
            )}
            
            {/* Version navigation */}
            {fragmentVersions && fragmentVersions.length > 1 && currentVersionIndex !== undefined && (
              <div className="flex items-center gap-1 ml-4">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={onPreviousVersion || (() => handleVersionChange(currentVersionIndex - 1))}
                  disabled={currentVersionIndex === 0}
                >
                  <ChevronLeft className="h-3 w-3" />
                </Button>
                <span className="text-xs text-muted-foreground px-2">
                  v{currentVersionIndex + 1} / {fragmentVersions.length}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={onNextVersion || (() => handleVersionChange(currentVersionIndex + 1))}
                  disabled={currentVersionIndex === fragmentVersions.length - 1}
                >
                  <ChevronRight className="h-3 w-3" />
                </Button>
              </div>
            )}
          </div>
          
          <div className="flex items-center gap-2">
            {/* Full screen toggle */}
            {onFullScreenToggle && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onFullScreenToggle}
                className="h-7 w-7 p-0"
              >
                {fullScreenMode ? (
                  <Minimize2 className="h-4 w-4" />
                ) : (
                  <Maximize2 className="h-4 w-4" />
                )}
              </Button>
            )}
            
            {/* Share button */}
            <ShareButton 
              appData={{
                name: appName || 'Untitled App',
                description: messages[0]?.content[0]?.text || '',
                code: fragment,
                template: template,
                sandboxId: result && 'url' in result ? result.sbxId : undefined
              }}
            />
            
            {/* Version history */}
            {currentAppId && (
              <VersionHistory 
                appId={currentAppId}
                userId={userId}
                onRevert={(version) => {
                  console.log('Reverting to version:', version)
                }}
              />
            )}
          </div>
        </div>
      )}
      
      {/* Enhanced preview */}
      <div className="flex-1">
        <FragmentPreview 
          result={result || undefined} 
          fragment={fragment ? {
            code: fragment.code || '',
            template: fragment.template || template || 'nextjs-developer',
            file_path: fragment.file_path
          } : undefined}
          userId={userId}
        />
      </div>
    </div>
  )
} 