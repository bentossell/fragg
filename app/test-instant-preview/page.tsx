'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { InstantPreview } from '@/components/instant-preview-v2'
import { instantPreviewPrompts } from '@/lib/instant-preview-prompts'
import { Clock, Zap, Send, Sparkles, Loader2, ChevronRight } from 'lucide-react'
import { Textarea } from '@/components/ui/textarea'
// Removed unused imports for cleaner demo
// import { toast } from 'sonner' // Removed for demo
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'

// Type for instant preview suitable prompts
type InstantPrompt = {
  title: string
  prompt: string
  description: string
  category: 'ui' | 'game' | 'tool' | 'animation'
}

// Curated prompts that work well with instant preview
const examplePrompts: InstantPrompt[] = [
  {
    title: "Interactive Counter",
    prompt: "Create a beautiful counter app with increment/decrement buttons and a reset option",
    description: "Simple state management demo",
    category: 'ui'
  },
  {
    title: "Todo List",
    prompt: "Build a todo list app where users can add, complete, and delete tasks",
    description: "Classic CRUD operations",
    category: 'tool'
  },
  {
    title: "Color Picker",
    prompt: "Create a color picker tool with RGB sliders and hex code display",
    description: "Interactive color selection",
    category: 'tool'
  },
  {
    title: "Countdown Timer",
    prompt: "Make a countdown timer with start, pause, and reset functionality",
    description: "Time-based state updates",
    category: 'tool'
  },
  {
    title: "Password Generator",
    prompt: "Build a password generator with length control and character type options",
    description: "Utility app with options",
    category: 'tool'
  },
  {
    title: "Animated Loader",
    prompt: "Create a beautiful animated loading spinner with CSS animations",
    description: "Pure CSS animations",
    category: 'animation'
  },
  {
    title: "Memory Game",
    prompt: "Make a simple memory card matching game with score tracking",
    description: "Interactive game logic",
    category: 'game'
  },
  {
    title: "Calculator",
    prompt: "Build a functional calculator with basic arithmetic operations",
    description: "Complex state management",
    category: 'tool'
  }
]

export default function TestInstantPreview() {
  const [generatedCode, setGeneratedCode] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [selectedPrompt, setSelectedPrompt] = useState<InstantPrompt | null>(null)
  const [customPrompt, setCustomPrompt] = useState('')
  const [generationTime, setGenerationTime] = useState<number | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  
  // Chat state
  const [messages, setMessages] = useState<Array<{role: 'user' | 'assistant', content: string}>>([{
    role: 'assistant',
    content: 'Hi! I can generate React components instantly. Try one of the example prompts or describe what you want to build!'
  }])
  
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }
  
  useEffect(() => {
    scrollToBottom()
  }, [messages])
  
  // Generate code from prompt
  const generateCode = async (prompt: string) => {
    const startTime = Date.now()
    setIsGenerating(true)
    setGenerationTime(null)
    
    // Add user message
    setMessages(prev => [...prev, { role: 'user', content: prompt }])
    
    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{
            role: 'user',
            content: `${prompt}\n\nIMPORTANT: Generate ONLY a single React component as a function called App(). 
            - Use React hooks (useState, useEffect, etc.)
            - Use Tailwind CSS classes for all styling
            - Make it interactive and self-contained
            - Don't include any imports or exports
            - The component must be named App
            - Use only React features available in React 18`
          }],
          template: { 'nextjs-developer': { 
            id: 'nextjs-developer', 
            name: 'Next.js developer',
            file: 'pages/index.tsx',
            instructions: 'Generate a React component suitable for instant preview'
          }},
          model: {
            id: 'anthropic/claude-3-5-sonnet-20241022',
            name: 'Claude 3.5 Sonnet',
            provider: 'OpenRouter',
            providerId: 'openrouter'
          },
          config: {},
          useOptimized: true
        })
      })
      
      if (!response.ok) {
        throw new Error('Failed to generate code')
      }
      
      const reader = response.body?.getReader()
      const decoder = new TextDecoder()
      let accumulatedCode = ''
      let assistantMessage = ''
      
      while (reader) {
        const { done, value } = await reader.read()
        if (done) break
        
        const chunk = decoder.decode(value)
        const lines = chunk.split('\n')
        
        for (const line of lines) {
          if (line.startsWith('0:"')) {
            try {
              const jsonStr = line.slice(3, -1).replace(/\\"/g, '"')
              const data = JSON.parse(jsonStr)
              
              if (data.code) {
                // Try to extract just the component code
                let extractedCode = data.code
                
                // Remove imports/exports if present
                extractedCode = extractedCode.replace(/^import\s+.*?from\s+['"].*?['"];?\s*$/gm, '')
                extractedCode = extractedCode.replace(/^export\s+(?:default\s+)?/gm, '')
                
                // Look for the App component
                const appComponentMatch = extractedCode.match(/function\s+App\s*\([^)]*\)\s*{[\s\S]*}/m)
                if (appComponentMatch) {
                  accumulatedCode = appComponentMatch[0]
                  setGeneratedCode(appComponentMatch[0])
                } else {
                  // Try to find any React component and rename it to App
                  const componentMatch = extractedCode.match(/(?:function|const)\s+(\w+)\s*(?:=\s*)?(?:\([^)]*\)|[^{]*)\s*(?:=>)?\s*{[\s\S]*}/m)
                  if (componentMatch) {
                    const componentName = componentMatch[1]
                    accumulatedCode = extractedCode.replace(new RegExp(`\\b${componentName}\\b`, 'g'), 'App')
                    setGeneratedCode(accumulatedCode)
                  } else {
                    // Fallback: use the cleaned code as is
                    accumulatedCode = extractedCode
                    setGeneratedCode(extractedCode)
                  }
                }
              }
              
              if (data.commentary) {
                assistantMessage = data.commentary
              }
            } catch (e) {
              console.error('Failed to parse chunk:', e)
            }
          }
        }
      }
      
      const endTime = Date.now()
      setGenerationTime(endTime - startTime)
      
      // Add assistant message
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: `✨ Generated your React component in ${endTime - startTime}ms! The preview should appear instantly on the right.` 
      }])
      
    } catch (error) {
      console.error('Generation error:', error)
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: 'Sorry, I encountered an error while generating the code. Please try again.' 
      }])
      // toast.error('Failed to generate code')
    } finally {
      setIsGenerating(false)
    }
  }
  
  const handlePromptSubmit = () => {
    const prompt = customPrompt.trim()
    if (prompt && !isGenerating) {
      generateCode(prompt)
      setCustomPrompt('')
      setSelectedPrompt(null)
    }
  }
  
  const handleExampleClick = (prompt: InstantPrompt) => {
    setSelectedPrompt(prompt)
    generateCode(prompt.prompt)
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      <div className="container mx-auto p-8 max-w-7xl">
        <div className="mb-8 text-center">
          <div className="inline-flex items-center gap-2 mb-4">
            <Zap className="h-8 w-8 text-yellow-500" />
            <h1 className="text-4xl font-bold">AI Instant Preview Demo</h1>
          </div>
          <p className="text-lg text-muted-foreground">
            Generate React components with AI and see them instantly - no sandbox required!
          </p>
          {generationTime && (
            <Badge variant="secondary" className="mt-2">
              <Clock className="h-3 w-3 mr-1" />
              Generated in {generationTime}ms
            </Badge>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left side - Chat Interface */}
          <div className="space-y-6">
            <Card className="h-[600px] flex flex-col">
              <CardHeader className="flex-shrink-0">
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-purple-500" />
                  AI Chat
                </CardTitle>
                <CardDescription>
                  Describe what you want to build and watch it appear instantly
                </CardDescription>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col p-0">
                {/* Messages */}
                <ScrollArea className="flex-1 px-6 py-4">
                  <div className="space-y-4">
                    {messages.map((message, index) => (
                      <div
                        key={index}
                        className={cn(
                          "flex",
                          message.role === 'user' ? 'justify-end' : 'justify-start'
                        )}
                      >
                        <div
                          className={cn(
                            "max-w-[80%] rounded-lg px-4 py-2",
                            message.role === 'user'
                              ? 'bg-primary text-primary-foreground'
                              : 'bg-muted'
                          )}
                        >
                          <p className="text-sm">{message.content}</p>
                        </div>
                      </div>
                    ))}
                    {isGenerating && (
                      <div className="flex justify-start">
                        <div className="bg-muted rounded-lg px-4 py-2">
                          <div className="flex items-center gap-2">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            <span className="text-sm">Generating code...</span>
                          </div>
                        </div>
                      </div>
                    )}
                    <div ref={messagesEndRef} />
                  </div>
                </ScrollArea>
                
                {/* Input */}
                <div className="p-4 border-t">
                  <div className="flex gap-2">
                    <Textarea
                      placeholder="Describe the React component you want to build..."
                      className="min-h-[80px] resize-none"
                      value={customPrompt}
                      onChange={(e) => setCustomPrompt(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault()
                          handlePromptSubmit()
                        }
                      }}
                      disabled={isGenerating}
                    />
                    <Button
                      onClick={handlePromptSubmit}
                      disabled={!customPrompt.trim() || isGenerating}
                      size="icon"
                      className="h-[80px] w-[80px]"
                    >
                      {isGenerating ? (
                        <Loader2 className="h-5 w-5 animate-spin" />
                      ) : (
                        <Send className="h-5 w-5" />
                      )}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Example Prompts</CardTitle>
                <CardDescription>
                  Click any example to try it instantly
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 gap-2">
                  {examplePrompts.map((prompt, idx) => (
                    <Button
                      key={idx}
                      variant={selectedPrompt?.title === prompt.title ? "default" : "outline"}
                      className="w-full justify-between text-left h-auto py-3 px-4"
                      onClick={() => handleExampleClick(prompt)}
                      disabled={isGenerating}
                    >
                      <div className="flex-1">
                        <div className="font-medium">{prompt.title}</div>
                        <div className="text-xs text-muted-foreground mt-1">
                          {prompt.description}
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4 ml-2 flex-shrink-0" />
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right side - Preview */}
          <div className="space-y-6">
            <Card className="h-[600px]">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>Live Preview</span>
                  <div className="flex items-center gap-4">
                    {generationTime && (
                      <Badge variant="outline" className="text-xs">
                        <Zap className="h-3 w-3 mr-1" />
                        Instant
                      </Badge>
                    )}
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Clock className="h-4 w-4" />
                      <span>No sandbox needed</span>
                    </div>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent className="h-[calc(100%-5rem)] p-0">
                {generatedCode ? (
                  <InstantPreview code={generatedCode} />
                ) : (
                  <div className="h-full flex items-center justify-center text-muted-foreground">
                    <div className="text-center">
                      <Zap className="h-12 w-12 mx-auto mb-4 opacity-20" />
                      <p>Start chatting to see instant previews</p>
                      <p className="text-sm mt-2">No waiting for sandboxes!</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="grid grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Instant Preview</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2 text-sm">
                    <li className="flex items-start">
                      <Zap className="h-4 w-4 text-green-500 mr-2 mt-0.5" />
                      <span>Loads in &lt;100ms</span>
                    </li>
                    <li className="flex items-start">
                      <Zap className="h-4 w-4 text-green-500 mr-2 mt-0.5" />
                      <span>No sandbox required</span>
                    </li>
                    <li className="flex items-start">
                      <Zap className="h-4 w-4 text-green-500 mr-2 mt-0.5" />
                      <span>CDN-powered React</span>
                    </li>
                  </ul>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Traditional Sandbox</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    <li className="flex items-start">
                      <Clock className="h-4 w-4 text-orange-500 mr-2 mt-0.5" />
                      <span>Takes 5-10 seconds</span>
                    </li>
                    <li className="flex items-start">
                      <Clock className="h-4 w-4 text-orange-500 mr-2 mt-0.5" />
                      <span>Container creation</span>
                    </li>
                    <li className="flex items-start">
                      <Clock className="h-4 w-4 text-orange-500 mr-2 mt-0.5" />
                      <span>Build process needed</span>
                    </li>
                  </ul>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}