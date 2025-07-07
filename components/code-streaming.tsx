import { useEffect, useState, useRef, useCallback } from 'react'
import Prism from 'prismjs'
import 'prismjs/components/prism-javascript'
import 'prismjs/components/prism-jsx'
import 'prismjs/components/prism-python'
import 'prismjs/components/prism-tsx'
import 'prismjs/components/prism-typescript'
import './code-theme.css'

export interface RealTimeCodeStreamingProps {
  prompt: string
  isStreaming: boolean
  language?: string
  onComplete?: (result: { code: string; template: string; dependencies: string[] }) => void
  onError?: (error: string) => void
  onUpdate?: (update: { type: string; data: any; timestamp: number }) => void
}

export function RealTimeCodeStreaming({ 
  prompt,
  isStreaming,
  language = 'typescript',
  onComplete,
  onError,
  onUpdate
}: RealTimeCodeStreamingProps) {
  const [displayedCode, setDisplayedCode] = useState('')
  const [currentStatus, setCurrentStatus] = useState('Initializing...')
  const [streamingProgress, setStreamingProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [requestId, setRequestId] = useState<string | null>(null)
  const [totalChunks, setTotalChunks] = useState(0)
  const [bytesReceived, setBytesReceived] = useState(0)
  const codeRef = useRef<HTMLElement>(null)
  const abortControllerRef = useRef<AbortController | null>(null)
  
  const startRealTimeGeneration = useCallback(async () => {
    console.log('🚀 Starting real-time code generation:', prompt)
    const startTime = Date.now()
    
    try {
      setError(null)
      setDisplayedCode('')
      setCurrentStatus('Connecting to AI...')
      setStreamingProgress(0)
      setTotalChunks(0)
      setBytesReceived(0)
      setRequestId(null)
      
      // Create abort controller for cleanup
      abortControllerRef.current = new AbortController()
      
      // Call the streaming endpoint with enhanced logging
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
          useCache: true
        }),
        signal: abortControllerRef.current.signal,
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(`Generation failed: ${errorData.error || response.statusText}`)
      }

      // Extract request ID from headers for tracking
      const responseRequestId = response.headers.get('X-Request-ID')
      if (responseRequestId) {
        setRequestId(responseRequestId)
        console.log('📍 Request ID:', responseRequestId)
      }

      const reader = response.body?.getReader()
      if (!reader) {
        throw new Error('No response body reader available')
      }

      setCurrentStatus('AI is generating code...')
      setStreamingProgress(10)

      const decoder = new TextDecoder()
      let buffer = ''
      let chunks = 0
      let bytes = 0
      let codeStarted = false
      let finalResult: any = null

      while (true) {
        const { done, value } = await reader.read()
        
        if (done) {
          const totalTime = Date.now() - startTime
          console.log('✅ Streaming completed in', totalTime, 'ms')
          setCurrentStatus('Generation complete!')
          setStreamingProgress(100)
          
          // Try to extract final code from buffer if not already extracted
          if (!finalResult && buffer) {
            try {
              // Look for JSON in the final buffer
              const jsonMatch = buffer.match(/\{[\s\S]*\}/)
              if (jsonMatch) {
                finalResult = JSON.parse(jsonMatch[0])
              }
            } catch (e) {
              // If no JSON, use buffer as raw code
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
        
        setTotalChunks(chunks)
        setBytesReceived(bytes)
        
        // Update progress based on chunks received
        const progress = Math.min(20 + (chunks * 1.5), 95)
        setStreamingProgress(progress)
        
        console.log('📦 Chunk', chunks, ':', chunk.length, 'chars, total:', bytes, 'bytes')
        
        // Try to parse JSON response from the stream
        try {
          // Look for complete JSON objects in the buffer
          const lines = buffer.split('\n')
          for (let i = 0; i < lines.length - 1; i++) {
            const line = lines[i].trim()
            if (line.startsWith('{') && line.endsWith('}')) {
              try {
                const parsed = JSON.parse(line)
                if (parsed.code) {
                  finalResult = parsed
                  setDisplayedCode(parsed.code)
                  setCurrentStatus('Formatting and highlighting...')
                  codeStarted = true
                  
                  // Highlight code
                  setTimeout(() => {
                    if (codeRef.current) {
                      Prism.highlightElement(codeRef.current)
                    }
                  }, 10)
                  
                  // Call completion callback
                  if (onComplete) {
                    onComplete({
                      code: parsed.code,
                      template: parsed.template || 'nextjs-developer',
                      dependencies: parsed.dependencies || []
                    })
                  }
                  
                  // Clear buffer of processed lines
                  buffer = lines.slice(i + 1).join('\n')
                  break
                }
              } catch (e) {
                // Not valid JSON, continue
              }
            }
          }
        } catch (e) {
          // Continue processing
        }
        
        // If no structured response yet, display raw streaming content
        if (!codeStarted) {
          // Look for code patterns in the stream
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
            // Extract code from markdown blocks if present
            const codeMatch = buffer.match(/```[\w]*\n([\s\S]*?)```/)
            if (codeMatch) {
              setDisplayedCode(codeMatch[1])
              codeStarted = true
            } else {
              // Use the full buffer as code if it looks like code
              const trimmedBuffer = buffer.trim()
              if (trimmedBuffer.length > 50) { // Only if substantial content
                setDisplayedCode(trimmedBuffer)
                codeStarted = true
              }
            }
            
            setCurrentStatus('Code detected, processing...')
          } else {
            // Still waiting for code patterns
            setCurrentStatus(`AI is thinking... (${chunks} chunks, ${bytes} bytes)`)
            // Show a preview of recent content
            const preview = buffer.slice(-150).trim()
            if (preview.length > 10) {
              setDisplayedCode(`// Generating...\n// ${preview.replace(/\n/g, '\n// ')}`)
            }
          }
        } else {
          // Update existing code progressively
          const newContent = buffer.trim()
          if (newContent !== displayedCode) {
            setDisplayedCode(newContent)
          }
        }

        // Progressive highlighting every few chunks
        if (chunks % 3 === 0 && codeRef.current && codeStarted) {
          Prism.highlightElement(codeRef.current)
        }

        // Send update to parent
        if (onUpdate) {
          onUpdate({
            type: 'streaming',
            data: { 
              chunk, 
              totalChunks: chunks, 
              bufferLength: buffer.length,
              bytesReceived: bytes,
              codeStarted,
              progress,
              requestId: responseRequestId
            },
            timestamp: Date.now()
          })
        }
      }

    } catch (error: any) {
      const totalTime = Date.now() - startTime
      console.error('❌ Real-time generation failed:', error)
      
      const errorMessage = error.name === 'AbortError' 
        ? 'Generation was cancelled'
        : error.message || 'Unknown error occurred'
      
      setError(errorMessage)
      setCurrentStatus(`Error: ${errorMessage}`)
      
      console.log('❌ Generation failed after', totalTime, 'ms:', errorMessage)
      
      if (onError) {
        onError(errorMessage)
      }
    }
  }, [prompt, onComplete, onError, onUpdate])

  useEffect(() => {
    if (!isStreaming || !prompt.trim()) {
      return
    }

    // Start real-time streaming generation
    startRealTimeGeneration()

    return () => {
      // Cleanup: abort any ongoing requests
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  }, [prompt, isStreaming, startRealTimeGeneration])

  // Highlight code when it changes
  useEffect(() => {
    if (displayedCode && codeRef.current) {
      Prism.highlightElement(codeRef.current)
    }
  }, [displayedCode])

  return (
    <div className="relative h-full overflow-auto">
      {/* Enhanced real-time status indicator */}
      {isStreaming && (
        <div className="absolute top-4 right-4 z-10">
          <div className="flex items-center gap-3 px-4 py-2 bg-white/95 backdrop-blur-sm rounded-lg shadow-lg border">
            {error ? (
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-red-500 rounded-full" />
                <span className="text-sm font-medium text-red-700">Error</span>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse" />
                <span className="text-sm font-medium text-green-700">Live</span>
              </div>
            )}
            
            {/* Progress bar */}
            <div className="w-28 h-2 bg-gray-200 rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-300"
                style={{ width: `${streamingProgress}%` }}
              />
            </div>
            
            <div className="text-xs text-gray-600 min-w-[60px]">
              {streamingProgress.toFixed(0)}%
            </div>
          </div>
        </div>
      )}

      {/* Detailed status and metrics */}
      {isStreaming && (
        <div className="absolute top-16 right-4 z-10">
          <div className="px-3 py-2 bg-blue-50/95 border border-blue-200 rounded-md backdrop-blur-sm">
            <div className="text-xs text-blue-700 font-medium mb-1">
              {currentStatus}
            </div>
            {totalChunks > 0 && (
              <div className="text-xs text-blue-600 space-y-0.5">
                <div>Chunks: {totalChunks}</div>
                <div>Bytes: {bytesReceived.toLocaleString()}</div>
                {requestId && (
                  <div className="font-mono">ID: {requestId.slice(-8)}</div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Code display */}
      <pre className="p-4 pt-2 m-0 min-h-full" style={{ backgroundColor: 'transparent' }}>
        <code 
          ref={codeRef}
          className={`language-${language}`}
          style={{ fontSize: 12 }}
        >
          {displayedCode || (isStreaming ? 'Waiting for AI response...' : '')}
        </code>
      </pre>
      
      {/* Error display */}
      {error && (
        <div className="absolute bottom-4 left-4 right-4">
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-start gap-3">
              <div className="w-5 h-5 bg-red-500 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-white text-xs">!</span>
              </div>
              <div>
                <h4 className="text-sm font-medium text-red-800 mb-1">Generation Error</h4>
                <p className="text-sm text-red-700">{error}</p>
                {requestId && (
                  <p className="text-xs text-red-600 mt-1 font-mono">Request ID: {requestId}</p>
                )}
                <button 
                  onClick={() => {
                    setError(null)
                    if (prompt.trim()) {
                      startRealTimeGeneration()
                    }
                  }}
                  className="mt-2 text-xs text-red-600 hover:text-red-800 underline"
                >
                  Try again
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Enhanced streaming indicator for active generation */}
      {isStreaming && streamingProgress > 0 && streamingProgress < 100 && (
        <div className="absolute bottom-4 right-4">
          <div className="flex items-center gap-3 px-4 py-2 bg-primary/10 backdrop-blur-sm rounded-full">
            <div className="flex gap-1">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="w-2 h-2 bg-primary rounded-full animate-pulse"
                  style={{
                    animationDelay: `${i * 0.15}s`,
                  }}
                />
              ))}
            </div>
            <span className="text-xs font-medium">
              {totalChunks > 0 ? `Processing ${totalChunks} chunks...` : 'Generating code...'}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}

// Backward compatibility: keep the old CodeStreaming component but mark as deprecated
export function CodeStreaming({ 
  code,
  isStreaming,
  language = 'typescript'
}: {
  code: string
  isStreaming: boolean
  language?: string
}) {
  console.warn('CodeStreaming is deprecated. Use RealTimeCodeStreaming for real AI streaming.')
  
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
    
    // Simulate streaming for backward compatibility
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
    <div className="relative h-full overflow-auto">
      <pre className="p-4 pt-2 m-0 min-h-full" style={{ backgroundColor: 'transparent' }}>
        <code 
          ref={codeRef}
          className={`language-${language}`}
          style={{ fontSize: 12 }}
        >
          {displayedCode}
        </code>
      </pre>
      
      {isStreaming && displayedCode.length > 0 && (
        <div className="absolute bottom-4 right-4">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-primary/10 backdrop-blur-sm rounded-full">
            <div className="flex gap-1">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="w-2 h-2 bg-primary rounded-full animate-pulse"
                  style={{
                    animationDelay: `${i * 0.15}s`,
                  }}
                />
              ))}
            </div>
            <span className="text-xs font-medium">Generating code...</span>
          </div>
        </div>
      )}
    </div>
  )
} 