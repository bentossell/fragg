import { Message } from '@/lib/messages'
import { FragmentSchema } from '@/lib/schema'
import { ExecutionResult } from '@/lib/types'
import { DeepPartial } from 'ai'
import { LoaderIcon, Terminal, Edit2, Check, X, Zap, Clock, Code } from 'lucide-react'
import { useEffect, useState } from 'react'
import TextareaAutosize from 'react-textarea-autosize'
import { Button } from './ui/button'
import { Progress } from './ui/progress'

export function Chat({
  messages,
  isLoading,
  setCurrentPreview,
  onEditMessage,
  streamingProgress,
}: {
  messages: Message[]
  isLoading: boolean
  setCurrentPreview: (preview: {
    fragment: DeepPartial<FragmentSchema> | undefined
    result: ExecutionResult | undefined
  }) => void
  onEditMessage?: (index: number, newContent: string) => void
  streamingProgress?: {
    stage: string
    progress: number
    message: string
    canPause?: boolean
    isPaused?: boolean
  }
}) {
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const [editingContent, setEditingContent] = useState('')

  useEffect(() => {
    const chatContainer = document.getElementById('chat-container')
    if (chatContainer) {
      chatContainer.scrollTop = chatContainer.scrollHeight
    }
  }, [messages.length])

  const handleStartEdit = (index: number, currentContent: string) => {
    setEditingIndex(index)
    setEditingContent(currentContent)
  }

  const handleSaveEdit = () => {
    if (editingIndex !== null && onEditMessage) {
      onEditMessage(editingIndex, editingContent)
      setEditingIndex(null)
      setEditingContent('')
    }
  }

  const handleCancelEdit = () => {
    setEditingIndex(null)
    setEditingContent('')
  }

  // Extract generation progress from the last assistant message
  const getGenerationProgress = () => {
    if (!isLoading) return null
    
    const lastAssistantMessage = [...messages].reverse().find(m => m.role === 'assistant')
    if (!lastAssistantMessage) return null
    
    const commentary = lastAssistantMessage.content.find(c => c.type === 'text')?.text || ''
    
    // Parse different stages from commentary
    if (commentary.includes('Analyzing your request')) {
      return { stage: 'triage', progress: 10, message: 'Analyzing your request...' }
    } else if (commentary.includes('Selected') && commentary.includes('stack')) {
      return { stage: 'triage', progress: 25, message: commentary }
    } else if (commentary.includes('Running') && commentary.includes('agents')) {
      const match = commentary.match(/Running (\d+) specialized agents/)
      const agentCount = match ? parseInt(match[1]) : 0
      return { stage: 'agents', progress: 40, message: commentary, agentCount }
    } else if (commentary.includes('Processing...')) {
      const match = commentary.match(/\((\d+)\/(\d+) agents complete\)/)
      if (match) {
        const completed = parseInt(match[1])
        const total = parseInt(match[2])
        const progress = 40 + (35 * completed / total)
        return { stage: 'agents', progress, message: commentary, completed, total }
      }
    } else if (commentary.includes('Assembling final application')) {
      return { stage: 'assembly', progress: 85, message: 'Assembling final application...' }
    } else if (commentary.includes('Generation complete')) {
      return { stage: 'complete', progress: 100, message: commentary }
    } else if (commentary.includes('Generated using instant template')) {
      return { stage: 'instant', progress: 100, message: commentary }
    }
    
    return null
  }

  const generationProgress = getGenerationProgress()

  return (
    <div
      id="chat-container"
      className="flex flex-col pb-4 pt-4 gap-2"
    >
      {messages.map((message: Message, index: number) => {
        const isEditing = editingIndex === index
        const textContent = message.content.find(c => c.type === 'text')?.text || ''
        
        return (
          <div
            className={`flex flex-col px-4 shadow-sm whitespace-pre-wrap ${message.role !== 'user' ? 'bg-accent dark:bg-white/5 border text-accent-foreground dark:text-muted-foreground py-4 rounded-2xl gap-4 w-full' : 'bg-gradient-to-b from-black/5 to-black/10 dark:from-black/30 dark:to-black/50 py-2 rounded-xl gap-2 w-fit relative group'} font-serif`}
            key={index}
          >
            {message.role === 'user' && !isEditing && onEditMessage && (
              <Button
                variant="ghost"
                size="icon"
                className="absolute -right-8 top-2 opacity-0 group-hover:opacity-100 transition-opacity h-6 w-6"
                onClick={() => handleStartEdit(index, textContent)}
              >
                <Edit2 className="h-3 w-3" />
              </Button>
            )}
            
            {isEditing ? (
              <div className="flex flex-col gap-2">
                <TextareaAutosize
                  autoFocus
                  minRows={1}
                  className="resize-none bg-transparent outline-none"
                  value={editingContent}
                  onChange={(e) => setEditingContent(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      handleSaveEdit()
                    } else if (e.key === 'Escape') {
                      handleCancelEdit()
                    }
                  }}
                />
                <div className="flex gap-1 justify-end">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={handleSaveEdit}
                  >
                    <Check className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={handleCancelEdit}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ) : (
              <>
                {message.content.map((content, id) => {
                  if (content.type === 'text') {
                    return (
                      <span 
                        key={id} 
                        className={message.role === 'assistant' ? 'animate-text' : ''}
                        style={message.role === 'assistant' ? {
                          animationDelay: `${id * 50}ms`
                        } : {}}
                      >
                        {content.text}
                      </span>
                    )
                  }
                  if (content.type === 'image') {
                    return (
                      <img
                        key={id}
                        src={content.image}
                        alt="fragment"
                        className="mr-2 inline-block w-12 h-12 object-cover rounded-lg bg-white mb-2"
                      />
                    )
                  }
                })}
              </>
            )}
            
            {message.object && (
              <div
                onClick={() =>
                  setCurrentPreview({
                    fragment: message.object,
                    result: message.result,
                  })
                }
                className="py-2 pl-2 w-full md:w-max flex items-center border rounded-xl select-none hover:bg-white dark:hover:bg-white/5 hover:cursor-pointer transition-colors"
              >
                <div className="rounded-[0.5rem] w-10 h-10 bg-black/5 dark:bg-white/5 self-stretch flex items-center justify-center">
                  <Terminal strokeWidth={2} className="text-[#FF8800]" />
                </div>
                <div className="pl-2 pr-4 flex flex-col">
                  <span className="font-bold font-sans text-sm text-primary">
                    {message.object.title}
                  </span>
                  <span className="font-sans text-sm text-muted-foreground">
                    Click to see fragment
                  </span>
                </div>
              </div>
            )}
          </div>
        )
      })}
      
      {isLoading && (streamingProgress || generationProgress) && (
        <div className="flex flex-col gap-3 px-4 py-3 bg-accent/50 dark:bg-white/5 rounded-xl animate-in fade-in duration-300">
          <div className="flex items-center gap-2">
            {streamingProgress ? (
              // Use streamingProgress if available
              <>
                {streamingProgress.stage === 'complete' ? (
                  <Zap className="w-4 h-4 text-green-500" />
                ) : streamingProgress.stage === 'coding' ? (
                  <Code className="w-4 h-4 text-blue-500" />
                ) : (
                  <Clock className="w-4 h-4 text-orange-500" />
                )}
                <span className="text-sm font-medium">{streamingProgress.message}</span>
                {streamingProgress.isPaused && (
                  <span className="text-xs text-yellow-500 ml-2">(Paused)</span>
                )}
              </>
            ) : generationProgress ? (
              // Fallback to generationProgress
              <>
                {generationProgress.stage === 'instant' ? (
                  <Zap className="w-4 h-4 text-green-500" />
                ) : generationProgress.stage === 'agents' ? (
                  <Code className="w-4 h-4 text-blue-500" />
                ) : (
                  <Clock className="w-4 h-4 text-orange-500" />
                )}
                <span className="text-sm font-medium">{generationProgress.message}</span>
              </>
            ) : null}
          </div>
          
          {/* Progress bar */}
          {(() => {
            const progress = streamingProgress?.progress !== undefined ? streamingProgress.progress : generationProgress?.progress
            return progress !== undefined && progress < 100 && (
              <Progress 
                value={progress} 
                className="h-2" 
              />
            )
          })()}
          
          {/* Agent progress indicators */}
          {generationProgress?.stage === 'agents' && generationProgress.total && (
            <div className="flex gap-1">
              {Array.from({ length: generationProgress.total }).map((_, i) => (
                <div
                  key={i}
                  className={`h-1.5 flex-1 rounded-full transition-colors ${
                    i < (generationProgress.completed || 0)
                      ? 'bg-blue-500'
                      : 'bg-gray-300 dark:bg-gray-700'
                  }`}
                />
              ))}
            </div>
          )}
        </div>
      )}
      
      {isLoading && !streamingProgress && !generationProgress && (
        <div className="flex items-center gap-1 text-sm text-muted-foreground animate-in fade-in duration-300">
          <LoaderIcon strokeWidth={2} className="animate-spin w-4 h-4" />
          <span className="flex items-center gap-1">
            Generating
            <span className="inline-flex gap-[2px]">
              <span className="animate-bounce [animation-delay:-0.3s]">.</span>
              <span className="animate-bounce [animation-delay:-0.2s]">.</span>
              <span className="animate-bounce [animation-delay:-0.1s]">.</span>
            </span>
          </span>
        </div>
      )}
    </div>
  )
}
