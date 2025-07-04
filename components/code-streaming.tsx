import { useEffect, useState, useRef } from 'react'
import Prism from 'prismjs'
import 'prismjs/components/prism-javascript'
import 'prismjs/components/prism-jsx'
import 'prismjs/components/prism-python'
import 'prismjs/components/prism-tsx'
import 'prismjs/components/prism-typescript'
import './code-theme.css'

export function CodeStreaming({ 
  code,
  isStreaming,
  language = 'typescript'
}: {
  code: string
  isStreaming: boolean
  language?: string
}) {
  const [displayedCode, setDisplayedCode] = useState('')
  const [currentLine, setCurrentLine] = useState(0)
  const codeRef = useRef<HTMLElement>(null)
  
  useEffect(() => {
    if (!isStreaming) {
      setDisplayedCode(code)
      // Highlight after setting code
      setTimeout(() => {
        if (codeRef.current) {
          Prism.highlightElement(codeRef.current)
        }
      }, 0)
      return
    }
    
    // Stream code character by character with line awareness
    let currentIndex = 0
    let currentLineNum = 0
    const chars = code.split('')
    
    const interval = setInterval(() => {
      if (currentIndex < chars.length) {
        const nextChar = chars[currentIndex]
        setDisplayedCode(code.substring(0, currentIndex + 1))
        
        // Track line numbers
        if (nextChar === '\n') {
          currentLineNum++
          setCurrentLine(currentLineNum)
        }
        
        currentIndex++
        
        // Highlight as we stream
        if (codeRef.current && currentIndex % 10 === 0) {
          Prism.highlightElement(codeRef.current)
        }
      } else {
        clearInterval(interval)
        // Final highlight
        if (codeRef.current) {
          Prism.highlightElement(codeRef.current)
        }
      }
    }, 15) // Adjust speed as needed
    
    return () => clearInterval(interval)
  }, [code, isStreaming])
  
  return (
    <div className="relative h-full overflow-auto">
      {/* Code display */}
      <pre className="p-4 pt-2 m-0 min-h-full" style={{ backgroundColor: 'transparent' }}>
        <code 
          ref={codeRef}
          className={`language-${language}`}
          style={{ fontSize: 12 }}
        >
          {displayedCode}
        </code>
      </pre>
      
      {/* Streaming indicator */}
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
      
      {/* Current line highlight effect (subtle) */}
      {isStreaming && currentLine > 0 && (
        <div
          className="absolute left-0 right-0 h-6 bg-primary/5 pointer-events-none transition-all duration-200"
          style={{
            top: `${16 + (currentLine - 1) * 24}px`, // Adjust based on line height
            opacity: 0.5,
          }}
        />
      )}
    </div>
  )
} 