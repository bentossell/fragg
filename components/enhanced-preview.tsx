'use client'

import { useState, useEffect } from 'react'
import { GenerationLoading } from './generation-loading'
import { CodeStreaming } from './code-streaming'
import { ShareButton } from './share-button'
import { VersionHistory } from './version-history'
import { FragmentWebEnhanced } from './fragment-web-enhanced'
import { FragmentCode } from './fragment-code'
import { DeepPartial } from 'ai'
import { FragmentSchema } from '@/lib/schema'
import { ExecutionResult } from '@/lib/types'
import { Card } from './ui/card'
import { Button } from './ui/button'
import { sandboxRefreshManager } from '@/lib/sandbox/refresh-manager'
import { Pencil, Check, X, ChevronLeft, ChevronRight } from 'lucide-react'

interface FragmentVersion {
  fragment: DeepPartial<FragmentSchema>
  result?: ExecutionResult
  timestamp: number
}

interface EnhancedPreviewProps {
  fragment?: DeepPartial<FragmentSchema>
  result?: ExecutionResult
  isLoading: boolean
  isGenerating: boolean
  currentAppId: string | null
  appName: string
  template: string
  messages: any[]
  userId?: string
  onAppNameChange?: (name: string) => void
  onSave?: () => void
  onSandboxRecreate?: (fragment: DeepPartial<FragmentSchema>) => Promise<ExecutionResult>
  fragmentVersions?: FragmentVersion[]
  currentVersionIndex?: number
  onVersionChange?: (index: number) => void
}

export function EnhancedPreview({
  fragment,
  result,
  isLoading,
  isGenerating,
  currentAppId,
  appName,
  template,
  messages,
  userId,
  onAppNameChange,
  onSave,
  onSandboxRecreate,
  fragmentVersions,
  currentVersionIndex,
  onVersionChange
}: EnhancedPreviewProps) {
  const [generationStage, setGenerationStage] = useState<'analyzing' | 'generating' | 'building' | 'deploying'>('analyzing')
  const [generationProgress, setGenerationProgress] = useState(0)
  const [isCodeStreaming, setIsCodeStreaming] = useState(false)
  const [streamedCode, setStreamedCode] = useState('')
  const [isEditingName, setIsEditingName] = useState(false)
  const [editingName, setEditingName] = useState(appName || '')
  const [justSaved, setJustSaved] = useState(false)
  
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
  
  // Simulate generation stages
  useEffect(() => {
    if (isGenerating) {
      setGenerationStage('analyzing')
      setGenerationProgress(0)
      setIsCodeStreaming(false)
      
      const stages: Array<{ stage: typeof generationStage; duration: number; progress: number }> = [
        { stage: 'analyzing', duration: 1000, progress: 25 },
        { stage: 'generating', duration: 2000, progress: 50 },
        { stage: 'building', duration: 1500, progress: 75 },
        { stage: 'deploying', duration: 1000, progress: 100 }
      ]
      
      let currentStageIndex = 0
      
      const advanceStage = () => {
        if (currentStageIndex < stages.length) {
          const { stage, duration, progress } = stages[currentStageIndex]
          setGenerationStage(stage)
          setGenerationProgress(progress)
          
          // Start code streaming on generating stage
          if (stage === 'generating') {
            setIsCodeStreaming(true)
          }
          
          currentStageIndex++
          if (currentStageIndex < stages.length) {
            setTimeout(advanceStage, duration)
          }
        }
      }
      
      advanceStage()
    } else {
      setIsCodeStreaming(false)
    }
  }, [isGenerating])
  
  // Stream code effect
  useEffect(() => {
    if (isCodeStreaming && fragment?.code) {
      setStreamedCode('')
      // Simulate code streaming - in real app, this would come from the AI stream
      let index = 0
      const code = fragment.code as string
      const interval = setInterval(() => {
        if (index < code.length) {
          setStreamedCode(code.substring(0, index + 1))
          index += Math.floor(Math.random() * 10) + 5 // Random speed
        } else {
          setIsCodeStreaming(false)
          clearInterval(interval)
        }
      }, 20)
      
      return () => clearInterval(interval)
    }
  }, [isCodeStreaming, fragment?.code])
  
  const handleSandboxRefresh = async (sandboxId: string) => {
    if (!fragment || !onSandboxRecreate) return
    
    const newResult = await sandboxRefreshManager.refreshSandbox(
      sandboxId,
      async () => {
        const result = await onSandboxRecreate(fragment)
        return { 
          sandbox: result as any, // Type casting for example
          url: 'url' in result ? result.url : undefined 
        }
      }
    )
    
    if (newResult) {
      console.log('Sandbox refreshed:', newResult)
    }
  }
  
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
  
  // Show loading state
  if (isGenerating || isLoading) {
    return (
      <Card className="h-full flex items-center justify-center">
        <GenerationLoading 
          stage={generationStage} 
          progress={generationProgress}
        />
      </Card>
    )
  }
  
  // Show streaming code if in generating phase
  if (isCodeStreaming && streamedCode) {
    return (
      <Card className="h-full">
        <CodeStreaming 
          code={streamedCode}
          isStreaming={isCodeStreaming}
          language={fragment?.template === 'code-interpreter-python' ? 'python' : 'typescript'}
        />
      </Card>
    )
  }
  
  // Show regular preview with enhanced features
  return (
    <div className="h-full flex flex-col gap-2">
      {/* Action bar */}
      {fragment && currentAppId && (
        <div className="flex items-center justify-between px-2 py-1">
          <div className="flex items-center gap-2">
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
            {fragmentVersions && fragmentVersions.length > 1 && currentVersionIndex !== undefined && onVersionChange && (
              <div className="flex items-center gap-1 ml-4">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => onVersionChange(currentVersionIndex - 1)}
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
                  onClick={() => onVersionChange(currentVersionIndex + 1)}
                  disabled={currentVersionIndex === fragmentVersions.length - 1}
                >
                  <ChevronRight className="h-3 w-3" />
                </Button>
              </div>
            )}
          </div>
          
          <div className="flex items-center gap-2">
            <ShareButton 
              appData={{
                name: appName || 'Untitled App',
                description: messages[0]?.content[0]?.text || '',
                code: fragment,
                template: template,
                sandboxId: result && 'url' in result ? result.sbxId : undefined
              }}
            />
            
            {currentAppId && (
              <VersionHistory 
                appId={currentAppId}
                userId={userId}
                onRevert={(version) => {
                  // Handle version revert
                  console.log('Reverting to version:', version)
                }}
              />
            )}
          </div>
        </div>
      )}
      
      {/* Enhanced preview */}
      {result && 'url' in result ? (
        <FragmentWebEnhanced 
          result={result} 
          onSandboxRefresh={handleSandboxRefresh}
        />
      ) : (
        <div className="flex items-center justify-center h-full">
          <p className="text-muted-foreground">Preview not available for this type</p>
        </div>
      )}
    </div>
  )
} 