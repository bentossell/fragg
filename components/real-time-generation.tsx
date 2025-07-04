'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, Zap, Clock, Code, Eye, Download, Play } from 'lucide-react'

interface GenerationMetadata {
  method: 'instant-template' | 'ai-orchestrator' | 'fallback-template'
  cached: boolean
  triageTime: number
  generationTime: number
  assemblyTime?: number
  totalAgents: number
  priority: 'ultra-fast' | 'fast' | 'standard'
  errors?: string[]
  fallbacks?: number
  agentResults?: Array<{
    agent: string
    executionTime: number
    codeLength: number
    success: boolean
  }>
}

interface GenerationResult {
  code: string
  template: string
  dependencies: string[]
  executionTime: number
  metadata: GenerationMetadata
  sandbox?: {
    template: string
    available: number
    total: number
    averageInitTime: number
    hitRate: number
  }
}

interface StreamingUpdate {
  type: 'triage' | 'agent_start' | 'agent_complete' | 'assembly' | 'complete'
  data: any
  timestamp: number
}

interface GenerationProgress {
  stage: 'idle' | 'triage' | 'generation' | 'assembly' | 'complete' | 'error'
  progress: number
  message: string
  agents: Array<{
    name: string
    status: 'pending' | 'running' | 'complete' | 'error'
    executionTime?: number
  }>
  triageResult?: any
  errors: string[]
}

export function RealTimeGeneration() {
  const [prompt, setPrompt] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [progress, setProgress] = useState<GenerationProgress>({
    stage: 'idle',
    progress: 0,
    message: 'Ready to generate',
    agents: [],
    errors: []
  })
  const [result, setResult] = useState<GenerationResult | null>(null)
  const [previewMode, setPreviewMode] = useState<'code' | 'preview'>('code')
  
  const eventSourceRef = useRef<EventSource | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close()
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  }, [])
  
  const handleStreamingGeneration = useCallback(async (userPrompt: string) => {
    setIsGenerating(true)
    setResult(null)
    setProgress({
      stage: 'triage',
      progress: 10,
      message: 'Analyzing your request...',
      agents: [],
      errors: []
    })
    
    try {
      // Use Server-Sent Events for real-time updates
      const eventSource = new EventSource(`/api/generate?prompt=${encodeURIComponent(userPrompt)}`)
      eventSourceRef.current = eventSource
      
      eventSource.onmessage = (event) => {
        try {
          const update: StreamingUpdate = JSON.parse(event.data)
          
          switch (update.type) {
            case 'triage':
              setProgress(prev => ({
                ...prev,
                stage: 'triage',
                progress: 25,
                message: `Selected ${update.data.result?.stack} stack (${update.data.executionTime}ms)`,
                triageResult: update.data.result
              }))
              break
              
            case 'agent_start':
              setProgress(prev => ({
                ...prev,
                stage: 'generation',
                progress: 40,
                message: `Running ${update.data.agents.length} specialized agents...`,
                agents: update.data.agents.map((name: string) => ({
                  name,
                  status: 'running' as const
                }))
              }))
              break
              
            case 'agent_complete':
              setProgress(prev => ({
                ...prev,
                progress: Math.min(75, prev.progress + (20 / prev.agents.length)),
                agents: prev.agents.map(agent => 
                  agent.name === update.data.agent ? {
                    ...agent,
                    status: update.data.success ? 'complete' as const : 'error' as const,
                    executionTime: update.data.executionTime
                  } : agent
                )
              }))
              break
              
            case 'assembly':
              setProgress(prev => ({
                ...prev,
                stage: 'assembly',
                progress: 85,
                message: 'Assembling final application...'
              }))
              break
              
            case 'complete':
              setProgress(prev => ({
                ...prev,
                stage: 'complete',
                progress: 100,
                message: `Generation complete in ${update.data.executionTime}ms!`
              }))
              
              if (update.data.error) {
                setProgress(prev => ({
                  ...prev,
                  stage: 'error',
                  errors: [update.data.error]
                }))
              } else {
                setResult(update.data as GenerationResult)
              }
              
              setIsGenerating(false)
              eventSource.close()
              break
          }
        } catch (error) {
          console.error('Failed to parse SSE data:', error)
        }
      }
      
      eventSource.onerror = () => {
        setProgress(prev => ({
          ...prev,
          stage: 'error',
          errors: ['Connection to generation service lost']
        }))
        setIsGenerating(false)
        eventSource.close()
      }
      
    } catch (error: any) {
      console.error('Streaming generation failed:', error)
      
      // Fallback to regular API call
      try {
        const controller = new AbortController()
        abortControllerRef.current = controller
        
        setProgress(prev => ({
          ...prev,
          message: 'Falling back to direct generation...'
        }))
        
        const response = await fetch('/api/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt: userPrompt }),
          signal: controller.signal
        })
        
        if (!response.ok) {
          throw new Error(`Generation failed: ${response.statusText}`)
        }
        
        const data: GenerationResult = await response.json()
        setResult(data)
        setProgress(prev => ({
          ...prev,
          stage: 'complete',
          progress: 100,
          message: `Generation complete in ${data.executionTime}ms!`
        }))
        
      } catch (fallbackError: any) {
        setProgress(prev => ({
          ...prev,
          stage: 'error',
          errors: [fallbackError.message]
        }))
      }
      
      setIsGenerating(false)
    }
  }, [])
  
  const handleGenerate = useCallback(async () => {
    if (!prompt.trim()) return
    
    // Try instant generation first for ultra-fast results
    try {
      const controller = new AbortController()
      abortControllerRef.current = controller
      
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          prompt: prompt.trim(),
          useCache: true 
        }),
        signal: controller.signal
      })
      
      if (response.ok) {
        const data: GenerationResult = await response.json()
        
        if (data.metadata.method === 'instant-template') {
          // Instant result - show immediately
          setResult(data)
          setProgress({
            stage: 'complete',
            progress: 100,
            message: `Instant generation complete in ${data.executionTime}ms!`,
            agents: [],
            errors: []
          })
          return
        }
      }
    } catch (error) {
      // Continue to streaming generation
    }
    
    // Use streaming generation for complex requests
    await handleStreamingGeneration(prompt.trim())
  }, [prompt, handleStreamingGeneration])
  
  const stopGeneration = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
    }
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
    setIsGenerating(false)
    setProgress(prev => ({
      ...prev,
      stage: 'idle',
      message: 'Generation stopped'
    }))
  }, [])
  
  const downloadCode = useCallback(() => {
    if (!result) return
    
    const blob = new Blob([result.code], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `generated-app.${result.template.includes('html') ? 'html' : result.template.includes('py') ? 'py' : 'tsx'}`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }, [result])
  
  const getProgressColor = () => {
    if (progress.stage === 'error') return 'bg-red-500'
    if (progress.stage === 'complete') return 'bg-green-500'
    return 'bg-blue-500'
  }
  
  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'ultra-fast':
        return <Badge variant="default" className="bg-green-500"><Zap className="w-3 h-3 mr-1" />Ultra Fast</Badge>
      case 'fast':
        return <Badge variant="secondary"><Clock className="w-3 h-3 mr-1" />Fast</Badge>
      default:
        return <Badge variant="outline">Standard</Badge>
    }
  }
  
  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      {/* Input Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Code className="w-5 h-5" />
            AI Code Generation
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea
            placeholder="Describe the application you want to build... (e.g., 'Create a modern landing page for a SaaS product' or 'Build a calculator with a clean design')"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={3}
            className="w-full"
          />
          
          <div className="flex gap-2">
            <Button 
              onClick={handleGenerate}
              disabled={isGenerating || !prompt.trim()}
              className="flex items-center gap-2"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Play className="w-4 h-4" />
                  Generate App
                </>
              )}
            </Button>
            
            {isGenerating && (
              <Button 
                variant="outline" 
                onClick={stopGeneration}
              >
                Stop
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
      
      {/* Progress Section */}
      {(isGenerating || progress.stage !== 'idle') && (
        <Card>
          <CardContent className="pt-6 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">{progress.message}</span>
              <span className="text-sm text-muted-foreground">
                {progress.progress}%
              </span>
            </div>
            
            <Progress value={progress.progress} className="w-full" />
            
            {progress.agents.length > 0 && (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {progress.agents.map((agent, index) => (
                  <div 
                    key={index}
                    className={`flex items-center gap-2 p-2 rounded text-sm ${
                      agent.status === 'complete' ? 'bg-green-50 text-green-700' :
                      agent.status === 'running' ? 'bg-blue-50 text-blue-700' :
                      agent.status === 'error' ? 'bg-red-50 text-red-700' :
                      'bg-gray-50 text-gray-700'
                    }`}
                  >
                    <div className={`w-2 h-2 rounded-full ${
                      agent.status === 'complete' ? 'bg-green-500' :
                      agent.status === 'running' ? 'bg-blue-500 animate-pulse' :
                      agent.status === 'error' ? 'bg-red-500' :
                      'bg-gray-300'
                    }`} />
                    <span>{agent.name}</span>
                    {agent.executionTime && (
                      <span className="text-xs">({agent.executionTime}ms)</span>
                    )}
                  </div>
                ))}
              </div>
            )}
            
            {progress.errors.length > 0 && (
              <Alert variant="destructive">
                <AlertDescription>
                  {progress.errors.map((error, index) => (
                    <div key={index}>{error}</div>
                  ))}
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      )}
      
      {/* Results Section */}
      {result && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Eye className="w-5 h-5" />
                Generated Application
              </CardTitle>
              
              <div className="flex items-center gap-2">
                {getPriorityBadge(result.metadata.priority)}
                
                <Badge variant="outline">
                  {result.executionTime}ms
                </Badge>
                
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={downloadCode}
                  className="flex items-center gap-1"
                >
                  <Download className="w-3 h-3" />
                  Download
                </Button>
              </div>
            </div>
            
            {result.metadata && (
              <div className="text-sm text-muted-foreground space-y-1">
                <div>Method: {result.metadata.method}</div>
                {result.metadata.agentResults && (
                  <div>
                    Agents: {result.metadata.agentResults.map(a => a.agent).join(', ')}
                  </div>
                )}
                {result.dependencies.length > 0 && (
                  <div>Dependencies: {result.dependencies.join(', ')}</div>
                )}
              </div>
            )}
          </CardHeader>
          
          <CardContent>
            <Tabs value={previewMode} onValueChange={(v) => setPreviewMode(v as any)}>
              <TabsList>
                <TabsTrigger value="code">Source Code</TabsTrigger>
                <TabsTrigger value="preview">Live Preview</TabsTrigger>
              </TabsList>
              
              <TabsContent value="code" className="mt-4">
                <pre className="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg overflow-auto max-h-96 text-sm">
                  <code>{result.code}</code>
                </pre>
              </TabsContent>
              
              <TabsContent value="preview" className="mt-4">
                <div className="border rounded-lg bg-white">
                  {result.template.includes('html') ? (
                    <iframe
                      srcDoc={result.code}
                      className="w-full h-96 rounded-lg"
                      title="Generated Application Preview"
                      sandbox="allow-scripts"
                    />
                  ) : (
                    <div className="p-8 text-center text-muted-foreground">
                      <Code className="w-12 h-12 mx-auto mb-4 opacity-50" />
                      <p>Live preview not available for {result.template} templates</p>
                      <p className="text-sm">Switch to Source Code tab to view the generated code</p>
                    </div>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      )}
    </div>
  )
} 