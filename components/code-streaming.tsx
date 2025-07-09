import React, { useEffect, useState, useRef, useCallback, useMemo, memo } from 'react'
import Prism from 'prismjs'
import 'prismjs/components/prism-javascript'
import 'prismjs/components/prism-jsx'
import 'prismjs/components/prism-python'
import 'prismjs/components/prism-tsx'
import 'prismjs/components/prism-typescript'
import './code-theme.css'
import { Card } from './ui/card'
import { Badge } from './ui/badge'
import { Button } from './ui/button'
import { Progress } from './ui/progress'
import { Loader2, Pause, Play, Square, Zap, CheckCircle, XCircle, AlertCircle } from 'lucide-react'
import { useThrottle } from '@/lib/hooks/use-debounce'
import { usePerformanceMonitor, useRerenderTracker } from '@/lib/performance-monitor'
import { logger } from '@/lib/logger'

export interface StreamingUpdate {
  type: 'chunk' | 'metadata' | 'progress' | 'stage' | 'error' | 'complete'
  data: any
  timestamp: number
}

export interface StreamingMetadata {
  totalFiles?: number
  currentFile?: string
  estimatedTime?: number
  complexity?: 'low' | 'medium' | 'high'
  framework?: string
  language?: string
}

export interface StreamingStage {
  name: string
  description: string
  progress: number
  isComplete: boolean
  duration?: number
  error?: string
}

export interface RealTimeCodeStreamingProps {
  prompt: string
  isStreaming: boolean
  language?: string
  onComplete?: (result: { code: string; template: string; dependencies: string[] }) => void
  onError?: (error: string) => void
  onUpdate?: (update: StreamingUpdate) => void
  onCancel?: () => void
  throttleMs?: number
  showMetadata?: boolean
  showProgress?: boolean
  enableSoundEffects?: boolean
  maxRetries?: number
}

export interface StreamingState {
  stage: 'connecting' | 'thinking' | 'planning' | 'coding' | 'reviewing' | 'complete' | 'error'
  progress: number
  message: string
  metadata: StreamingMetadata
  stages: StreamingStage[]
  canPause: boolean
  isPaused: boolean
  totalChunks: number
  bytesReceived: number
  requestId: string | null
  startTime: number
  lastUpdateTime: number
  errors: string[]
  warnings: string[]
}

// Enhanced streaming component with visual feedback
export const RealTimeCodeStreaming = memo(function RealTimeCodeStreaming({ 
  prompt,
  isStreaming,
  language = 'typescript',
  onComplete,
  onError,
  onUpdate,
  onCancel,
  throttleMs = 50,
  showMetadata = true,
  showProgress = true,
  enableSoundEffects = false,
  maxRetries = 3
}: RealTimeCodeStreamingProps) {
  // Performance monitoring
  const { trackNetworkRequest } = usePerformanceMonitor('RealTimeCodeStreaming')
  useRerenderTracker('RealTimeCodeStreaming', { 
    prompt, isStreaming, language, throttleMs, showMetadata, showProgress, enableSoundEffects, maxRetries 
  })
  const [displayedCode, setDisplayedCode] = useState('')
  const [streamingState, setStreamingState] = useState<StreamingState>({
    stage: 'connecting',
    progress: 0,
    message: 'Initializing...',
    metadata: {},
    stages: [],
    canPause: false,
    isPaused: false,
    totalChunks: 0,
    bytesReceived: 0,
    requestId: null,
    startTime: 0,
    lastUpdateTime: 0,
    errors: [],
    warnings: []
  })
  
  const [cursorPosition, setCursorPosition] = useState(0)
  const [isTyping, setIsTyping] = useState(false)
  const [retryCount, setRetryCount] = useState(0)

  // Throttled state updates for performance
  const throttledDisplayedCode = useThrottle(displayedCode, throttleMs)
  const throttledProgress = useThrottle(streamingState.progress, throttleMs / 2)
  
  const codeRef = useRef<HTMLElement>(null)
  const abortControllerRef = useRef<AbortController | null>(null)
  const throttleTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const highlightTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  
  // Initialize audio context for sound effects
  useEffect(() => {
    if (enableSoundEffects && !audioContextRef.current) {
      try {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)()
      } catch (error) {
        logger.debug('Audio context not available:', error)
      }
    }
  }, [enableSoundEffects])
  
  // Sound effect utility
  const playSound = useCallback((frequency: number, duration: number) => {
    if (!enableSoundEffects || !audioContextRef.current) return
    
    try {
      const oscillator = audioContextRef.current.createOscillator()
      const gainNode = audioContextRef.current.createGain()
      
      oscillator.connect(gainNode)
      gainNode.connect(audioContextRef.current.destination)
      
      oscillator.frequency.value = frequency
      oscillator.type = 'sine'
      
      gainNode.gain.setValueAtTime(0.1, audioContextRef.current.currentTime)
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContextRef.current.currentTime + duration)
      
      oscillator.start()
      oscillator.stop(audioContextRef.current.currentTime + duration)
    } catch (error) {
      logger.debug('Sound playback failed:', error)
    }
  }, [enableSoundEffects])
  
  // Throttled DOM update
  const throttledUpdateCode = useCallback((newCode: string) => {
    if (throttleTimeoutRef.current) {
      clearTimeout(throttleTimeoutRef.current)
    }
    
    throttleTimeoutRef.current = setTimeout(() => {
      setDisplayedCode(newCode)
      setCursorPosition(newCode.length)
      
      // Debounced syntax highlighting
      if (highlightTimeoutRef.current) {
        clearTimeout(highlightTimeoutRef.current)
      }
      
      highlightTimeoutRef.current = setTimeout(() => {
        if (codeRef.current && newCode.length > 0) {
          try {
            Prism.highlightElement(codeRef.current)
          } catch (error) {
            logger.debug('Syntax highlighting failed:', error)
          }
        }
      }, 200)
    }, throttleMs)
  }, [throttleMs])
  
  // Typing animation effect
  const simulateTyping = useCallback((text: string, speed: number = 10) => {
    setIsTyping(true)
    let currentIndex = 0
    
    const typeNextChar = () => {
      if (currentIndex < text.length) {
        setDisplayedCode(text.substring(0, currentIndex + 1))
        setCursorPosition(currentIndex + 1)
        currentIndex++
        
        // Play typing sound
        playSound(800 + Math.random() * 200, 0.05)
        
        typingTimeoutRef.current = setTimeout(typeNextChar, speed + Math.random() * 10)
      } else {
        setIsTyping(false)
        playSound(1000, 0.1) // Completion sound
      }
    }
    
    typeNextChar()
  }, [playSound])
  
  // Enhanced streaming generation with better error handling
  const startRealTimeGeneration = useCallback(async () => {
    logger.debug('🚀 Starting enhanced real-time code generation:', prompt)
    const startTime = Date.now()
    
    setStreamingState(prev => ({
      ...prev,
      stage: 'connecting',
      progress: 0,
      message: 'Connecting to AI...',
      startTime,
      lastUpdateTime: startTime,
      errors: [],
      warnings: []
    }))
    
    try {
      setDisplayedCode('')
      setRetryCount(0)
      
      // Create abort controller for cleanup
      abortControllerRef.current = new AbortController()
      
      // Enhanced API call with retry logic
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt,
          streaming: true,
          model: 'anthropic/claude-3.5-sonnet',
          priority: 'fast',
          useCache: true,
          includeMetadata: true,
          throttleMs
        }),
        signal: abortControllerRef.current.signal,
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(`Generation failed: ${errorData.error || response.statusText}`)
      }

      // Extract metadata from headers
      const responseRequestId = response.headers.get('X-Request-ID')
      const estimatedTime = response.headers.get('X-Estimated-Time')
      const complexity = response.headers.get('X-Complexity') as StreamingMetadata['complexity']
      
      setStreamingState(prev => ({
        ...prev,
        requestId: responseRequestId,
        metadata: {
          ...prev.metadata,
          estimatedTime: estimatedTime ? parseInt(estimatedTime) : undefined,
          complexity: complexity || 'medium'
        }
      }))

      const reader = response.body?.getReader()
      if (!reader) {
        throw new Error('No response body reader available')
      }

      setStreamingState(prev => ({
        ...prev,
        stage: 'thinking',
        progress: 10,
        message: 'AI is analyzing your request...',
        canPause: true
      }))

      const decoder = new TextDecoder()
      let buffer = ''
      let chunks = 0
      let bytes = 0
      let codeStarted = false
      let finalResult: any = null
      let currentStage: StreamingStage | null = null

      while (true) {
        const { done, value } = await reader.read()
        
        if (done) {
          const totalTime = Date.now() - startTime
          logger.debug('✅ Enhanced streaming completed in', totalTime, 'ms')
          
          setStreamingState(prev => ({
            ...prev,
            stage: 'complete',
            progress: 100,
            message: 'Generation complete!',
            canPause: false
          }))
          
          // Play completion sound
          playSound(800, 0.2)
          
          // Process final result
          if (!finalResult && buffer) {
            try {
              const jsonMatch = buffer.match(/\{[\s\S]*\}/)
              if (jsonMatch) {
                finalResult = JSON.parse(jsonMatch[0])
              }
            } catch (e) {
              finalResult = {
                code: buffer.trim(),
                template: 'nextjs-developer',
                dependencies: []
              }
            }
            
            if (finalResult && onComplete) {
              onComplete({
                code: finalResult.code || buffer.trim(),
                template: finalResult.template || 'nextjs-developer',
                dependencies: finalResult.dependencies || []
              })
            }
          }
          break
        }

        const chunk = decoder.decode(value, { stream: true })
        buffer += chunk
        chunks++
        bytes += chunk.length
        
        // Update state with throttling
        setStreamingState(prev => ({
          ...prev,
          totalChunks: chunks,
          bytesReceived: bytes,
          lastUpdateTime: Date.now()
        }))
        
        // Parse streaming updates
        try {
          const lines = buffer.split('\n')
          for (let i = 0; i < lines.length - 1; i++) {
            const line = lines[i].trim()
            
            // Handle structured streaming updates
            if (line.startsWith('data: ')) {
              try {
                const update = JSON.parse(line.slice(6))
                
                switch (update.type) {
                  case 'stage':
                    setStreamingState(prev => ({
                      ...prev,
                      stage: update.data.stage,
                      message: update.data.message,
                      progress: update.data.progress
                    }))
                    break
                    
                  case 'metadata':
                    setStreamingState(prev => ({
                      ...prev,
                      metadata: { ...prev.metadata, ...update.data }
                    }))
                    break
                    
                  case 'code_chunk':
                    if (update.data.code) {
                      throttledUpdateCode(update.data.code)
                      codeStarted = true
                    }
                    break
                    
                  case 'error':
                    setStreamingState(prev => ({
                      ...prev,
                      errors: [...prev.errors, update.data.message]
                    }))
                    break
                    
                  case 'warning':
                    setStreamingState(prev => ({
                      ...prev,
                      warnings: [...prev.warnings, update.data.message]
                    }))
                    break
                }
                
                // Send update to parent
                if (onUpdate) {
                  onUpdate({
                    type: update.type,
                    data: update.data,
                    timestamp: Date.now()
                  })
                }
              } catch (e) {
                // Not a valid streaming update, continue
              }
            }
            
            // Handle JSON response
            if (line.startsWith('{') && line.endsWith('}')) {
              try {
                const parsed = JSON.parse(line)
                if (parsed.code) {
                  finalResult = parsed
                  
                  if (parsed.animate) {
                    simulateTyping(parsed.code)
                  } else {
                    throttledUpdateCode(parsed.code)
                  }
                  
                  codeStarted = true
                  
                  setStreamingState(prev => ({
                    ...prev,
                    stage: 'reviewing',
                    message: 'Formatting and highlighting...',
                    progress: 90
                  }))
                  
                  if (onComplete) {
                    onComplete({
                      code: parsed.code,
                      template: parsed.template || 'nextjs-developer',
                      dependencies: parsed.dependencies || []
                    })
                  }
                  
                  buffer = lines.slice(i + 1).join('\n')
                  break
                }
              } catch (e) {
                // Not valid JSON, continue
              }
            }
          }
        } catch (e) {
          logger.debug('Failed to parse streaming update:', e)
        }
        
        // Fallback code detection if no structured updates
        if (!codeStarted) {
          const codePatterns = [
            /```[\w]*\n([\s\S]*?)```/g,
            /import\s+.*?from\s+['"]/,
            /export\s+(default\s+)?function/,
            /const\s+\w+\s*=/,
            /<\w+[^>]*>/,
            /def\s+\w+\(/,
            /class\s+\w+/,
            /<!DOCTYPE html>/i,
            /<html/i
          ]
          
          const hasCodePattern = codePatterns.some(pattern => pattern.test(buffer))
         
          if (hasCodePattern) {
            const codeMatch = buffer.match(/```[\w]*\n([\s\S]*?)```/)
            if (codeMatch) {
              throttledUpdateCode(codeMatch[1])
              codeStarted = true
            } else {
              const trimmedBuffer = buffer.trim()
              if (trimmedBuffer.length > 50) {
                throttledUpdateCode(trimmedBuffer)
                codeStarted = true
              }
            }
            
            setStreamingState(prev => ({
              ...prev,
              stage: 'coding',
              message: 'Code detected, streaming...',
              progress: Math.min(30 + (chunks * 0.5), 80)
            }))
          } else {
            // Still thinking stage
            setStreamingState(prev => ({
              ...prev,
              stage: 'thinking',
              message: `AI is thinking... (${chunks} chunks, ${(bytes / 1024).toFixed(1)}KB)`,
              progress: Math.min(10 + (chunks * 0.2), 25)
            }))
            
            const preview = buffer.slice(-100).trim()
            if (preview.length > 10) {
              setDisplayedCode(`// AI is generating code...\n// ${preview.replace(/\n/g, '\n// ')}`)
            }
          }
        }
      }

    } catch (error: any) {
      logger.error('❌ Enhanced streaming generation failed:', error)
      
      const errorMessage = error.name === 'AbortError' 
        ? 'Generation was cancelled'
        : error.message || 'Unknown error occurred'
      
      setStreamingState(prev => ({
        ...prev,
        stage: 'error',
        message: `Error: ${errorMessage}`,
        errors: [...prev.errors, errorMessage]
      }))
      
      // Play error sound
      playSound(400, 0.3)
      
      // Retry logic
      if (retryCount < maxRetries && error.name !== 'AbortError') {
        setRetryCount(prev => prev + 1)
        setTimeout(() => {
          logger.debug(`🔄 Retrying (${retryCount + 1}/${maxRetries})...`)
          startRealTimeGeneration()
        }, 1000 * Math.pow(2, retryCount)) // Exponential backoff
        return
      }
      
      if (onError) {
        onError(errorMessage)
      }
    }
  }, [prompt, onComplete, onError, onUpdate, throttleMs, maxRetries, retryCount, playSound, simulateTyping, throttledUpdateCode])

  // Pause/Resume functionality
  const handlePause = useCallback(() => {
    setStreamingState(prev => ({
      ...prev,
      isPaused: !prev.isPaused
    }))
  }, [])

  // Cancel functionality
  const handleCancel = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
    
    setStreamingState(prev => ({
      ...prev,
      stage: 'error',
      message: 'Generation cancelled',
      canPause: false
    }))
    
    if (onCancel) {
      onCancel()
    }
  }, [onCancel])

  // Main streaming effect
  useEffect(() => {
    if (!isStreaming || !prompt.trim()) {
      return
    }

    startRealTimeGeneration()

    return () => {
      // Cleanup
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
      if (throttleTimeoutRef.current) {
        clearTimeout(throttleTimeoutRef.current)
      }
      if (highlightTimeoutRef.current) {
        clearTimeout(highlightTimeoutRef.current)
      }
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current)
      }
    }
  }, [prompt, isStreaming, startRealTimeGeneration])

  // Cleanup effect
  useEffect(() => {
    return () => {
      if (audioContextRef.current) {
        audioContextRef.current.close()
      }
    }
  }, [])

  // Memoized stage display
  const stageDisplay = useMemo(() => {
    const stageInfo = {
      connecting: { icon: Loader2, color: 'text-blue-500', label: 'Connecting' },
      thinking: { icon: Loader2, color: 'text-yellow-500', label: 'Thinking' },
      planning: { icon: Zap, color: 'text-purple-500', label: 'Planning' },
      coding: { icon: Loader2, color: 'text-green-500', label: 'Coding' },
      reviewing: { icon: CheckCircle, color: 'text-blue-500', label: 'Reviewing' },
      complete: { icon: CheckCircle, color: 'text-green-500', label: 'Complete' },
      error: { icon: XCircle, color: 'text-red-500', label: 'Error' }
    }

    return stageInfo[streamingState.stage] || stageInfo.connecting
  }, [streamingState.stage])

  return (
    <div className="relative h-full min-h-96 border rounded-lg overflow-hidden bg-gradient-to-br from-slate-50 to-white dark:from-slate-900 dark:to-slate-800">
      {/* Enhanced header with stage indicator */}
      <div className="flex items-center justify-between p-3 border-b bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="flex items-center gap-2">
            <stageDisplay.icon className={`h-4 w-4 ${stageDisplay.color} ${isStreaming ? 'animate-spin' : ''}`} />
            <span className="text-sm font-medium">{stageDisplay.label}</span>
          </Badge>
          
          {isStreaming && (
            <Badge variant="secondary" className="animate-pulse">
              <div className="w-2 h-2 bg-green-500 rounded-full mr-2 animate-ping" />
              Live
            </Badge>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          {/* Controls */}
          {isStreaming && streamingState.canPause && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handlePause}
              className="h-8 w-8 p-0"
            >
              {streamingState.isPaused ? (
                <Play className="h-4 w-4" />
              ) : (
                <Pause className="h-4 w-4" />
              )}
            </Button>
          )}
          
          {isStreaming && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCancel}
              className="h-8 w-8 p-0 text-red-500"
            >
              <Square className="h-4 w-4" />
            </Button>
          )}
          
          {/* Metadata display */}
          {showMetadata && streamingState.metadata && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              {streamingState.requestId && (
                <span className="font-mono">
                  ID: {streamingState.requestId.slice(-8)}
                </span>
              )}
              {streamingState.totalChunks > 0 && (
                <span>
                  {streamingState.totalChunks} chunks
                </span>
              )}
              {streamingState.bytesReceived > 0 && (
                <span>
                  {(streamingState.bytesReceived / 1024).toFixed(1)}KB
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Progress bar */}
      {showProgress && isStreaming && (
        <div className="px-3 py-2 bg-muted/50">
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm text-muted-foreground">
              {streamingState.message}
            </span>
            <span className="text-xs text-muted-foreground">
              {streamingState.progress}%
            </span>
          </div>
          <Progress value={streamingState.progress} className="h-2" />
        </div>
      )}

      {/* Error/Warning messages */}
      {streamingState.errors.length > 0 && (
        <div className="px-3 py-2 bg-red-50 dark:bg-red-900/20 border-b">
          {streamingState.errors.map((error, index) => (
            <div key={index} className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400">
              <XCircle className="h-4 w-4" />
              {error}
            </div>
          ))}
        </div>
      )}

      {streamingState.warnings.length > 0 && (
        <div className="px-3 py-2 bg-yellow-50 dark:bg-yellow-900/20 border-b">
          {streamingState.warnings.map((warning, index) => (
            <div key={index} className="flex items-center gap-2 text-sm text-yellow-600 dark:text-yellow-400">
              <AlertCircle className="h-4 w-4" />
              {warning}
            </div>
          ))}
        </div>
      )}

      {/* Code display with enhanced styling */}
      <div className="relative flex-1 overflow-hidden">
        <pre className="p-4 pt-2 m-0 h-full overflow-auto" style={{ backgroundColor: 'transparent' }}>
          <code 
            ref={codeRef}
            className={`language-${language} block`}
            style={{ 
              fontSize: 13,
              lineHeight: 1.5,
              fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Consolas, "Liberation Mono", Menlo, monospace'
            }}
          >
            {displayedCode || (isStreaming ? 'Waiting for AI response...' : '')}
          </code>
          
          {/* Animated cursor */}
          {isStreaming && isTyping && (
            <span 
              className="inline-block w-2 h-5 bg-blue-500 animate-pulse ml-1"
              style={{
                animation: 'blink 1s infinite',
                position: 'absolute',
                marginTop: '-1px'
              }}
            />
          )}
        </pre>
        
        {/* Streaming progress overlay */}
        {isStreaming && streamingState.progress > 0 && streamingState.progress < 100 && (
          <div className="absolute bottom-4 right-4">
            <div className="flex items-center gap-3 px-4 py-2 bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm rounded-full shadow-lg">
              <div className="flex gap-1">
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className="w-2 h-2 bg-primary rounded-full animate-bounce"
                    style={{
                      animationDelay: `${i * 0.15}s`,
                      animationDuration: '0.6s'
                    }}
                  />
                ))}
              </div>
              <span className="text-xs font-medium">
                {streamingState.totalChunks > 0 
                  ? `Processing ${streamingState.totalChunks} chunks...` 
                  : 'Generating code...'}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
})

// Backward compatibility component (simplified)
export const CodeStreaming = memo(function CodeStreaming({ 
  code,
  isStreaming,
  language = 'typescript'
}: {
  code: string
  isStreaming: boolean
  language?: string
}) {
  logger.debug('CodeStreaming is deprecated. Use RealTimeCodeStreaming for enhanced streaming.')
  
  const [displayedCode, setDisplayedCode] = useState('')
  const codeRef = useRef<HTMLElement>(null)
  
  useEffect(() => {
    if (!isStreaming) {
      setDisplayedCode(code)
      setTimeout(() => {
        if (codeRef.current) {
          Prism.highlightElement(codeRef.current)
        }
      }, 0)
      return
    }
    
    // Simple streaming simulation
    let currentIndex = 0
    const chars = code.split('')
    
    const interval = setInterval(() => {
      if (currentIndex < chars.length) {
        setDisplayedCode(code.substring(0, currentIndex + 1))
        currentIndex++
        
        if (codeRef.current && currentIndex % 10 === 0) {
          Prism.highlightElement(codeRef.current)
        }
      } else {
        clearInterval(interval)
        if (codeRef.current) {
          Prism.highlightElement(codeRef.current)
        }
      }
    }, 15)
    
    return () => clearInterval(interval)
  }, [code, isStreaming])

  return (
    <div className="relative h-full min-h-96 border rounded-lg overflow-hidden">
      <pre className="p-4 pt-2 m-0 h-full overflow-auto" style={{ backgroundColor: 'transparent' }}>
        <code 
          ref={codeRef}
          className={`language-${language}`}
          style={{ fontSize: 12 }}
        >
          {displayedCode || (isStreaming ? 'Waiting for AI response...' : '')}
        </code>
      </pre>
    </div>
  )
}) 