'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { Message } from '@/lib/messages'
import { 
  ConversationResponse, 
  QuickAction, 
  UserFeedback, 
  ModificationAction,
  conversationalModificationSystem
} from '@/lib/conversational-modification-system'
import { naturalLanguageProcessor } from '@/lib/natural-language-processor'
import { Button } from './ui/button'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { Badge } from './ui/badge'
import { Separator } from './ui/separator'
import { Progress } from './ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs'
import { 
  MessageSquare, 
  Lightbulb, 
  Zap, 
  Code, 
  HelpCircle, 
  CheckCircle2, 
  XCircle, 
  Star,
  ThumbsUp,
  ThumbsDown,
  Sparkles,
  Target,
  Clock,
  AlertCircle,
  ChevronRight,
  Mic,
  MicOff,
  Volume2,
  VolumeX
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface ConversationalChatInterfaceProps {
  messages: Message[]
  currentCode: string
  sessionId: string
  isLoading: boolean
  onSendMessage: (message: string) => void
  onApplyModification: (actionIds: string[]) => void
  onCodeChange: (code: string) => void
  className?: string
}

export function ConversationalChatInterface({
  messages,
  currentCode,
  sessionId,
  isLoading,
  onSendMessage,
  onApplyModification,
  onCodeChange,
  className
}: ConversationalChatInterfaceProps) {
  const [conversationResponse, setConversationResponse] = useState<ConversationResponse | null>(null)
  const [selectedActions, setSelectedActions] = useState<string[]>([])
  const [showQuickActions, setShowQuickActions] = useState(true)
  const [showSuggestions, setShowSuggestions] = useState(true)
  const [showContextInfo, setShowContextInfo] = useState(true)
  const [voiceEnabled, setVoiceEnabled] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const [feedbackMode, setFeedbackMode] = useState<'none' | 'rating' | 'detailed'>('none')
  const [inputValue, setInputValue] = useState('')
  const [processingConversation, setProcessingConversation] = useState(false)
  
  const chatContainerRef = useRef<HTMLDivElement>(null)
  const speechRecognitionRef = useRef<any | null>(null) // Using any because SpeechRecognition is browser-only
  const speechSynthesisRef = useRef<SpeechSynthesisUtterance | null>(null)

  // Initialize speech recognition
  useEffect(() => {
    if (typeof window !== 'undefined' && ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)) {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
      speechRecognitionRef.current = new SpeechRecognition()
      speechRecognitionRef.current.continuous = false
      speechRecognitionRef.current.interimResults = true
      speechRecognitionRef.current.lang = 'en-US'
      
      speechRecognitionRef.current.onresult = (event: any) => {
        let transcript = ''
        for (let i = event.resultIndex; i < event.results.length; i++) {
          if (event.results[i].isFinal) {
            transcript += event.results[i][0].transcript
          } else {
            transcript += event.results[i][0].transcript
          }
        }
        setInputValue(transcript)
      }
      
      speechRecognitionRef.current.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error)
        setIsListening(false)
      }
      
      speechRecognitionRef.current.onend = () => {
        setIsListening(false)
      }

      // Add continuous listening option
      speechRecognitionRef.current.onstart = () => {
        setIsListening(true)
      }
    }

    // Initialize speech synthesis voices
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      const updateVoices = () => {
        const voices = window.speechSynthesis.getVoices()
        // Prefer female voice for better user experience
        const preferredVoice = voices.find(voice => 
          voice.name.includes('Female') || voice.name.includes('Samantha') || voice.name.includes('Karen')
        ) || voices[0]
        if (preferredVoice && speechSynthesisRef.current) {
          speechSynthesisRef.current.voice = preferredVoice
        }
      }
      
      if (window.speechSynthesis.getVoices().length > 0) {
        updateVoices()
      } else {
        window.speechSynthesis.onvoiceschanged = updateVoices
      }
    }
  }, [])

  // Enhanced auto-scroll with smooth behavior
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTo({
        top: chatContainerRef.current.scrollHeight,
        behavior: 'smooth'
      })
    }
  }, [messages, conversationResponse])

  // Enhanced conversation processing with context awareness
  useEffect(() => {
    const processLastMessage = async () => {
      if (messages.length === 0) return
      
      const lastMessage = messages[messages.length - 1]
      if (lastMessage.role === 'user' && !processingConversation) {
        setProcessingConversation(true)
        try {
          const response = await conversationalModificationSystem.processConversation(
            sessionId,
            lastMessage.content.find(c => c.type === 'text')?.text || '',
            currentCode,
            {
              enableSuggestions: showSuggestions,
              requireConfirmation: true,
              preserveContext: true,
              userId: 'current-user' // In a real app, this would come from auth
            }
          )
          setConversationResponse(response)
          
          // Auto-speak response if voice is enabled
          if (voiceEnabled && response.message) {
            handleTextToSpeech(response.message)
          }
        } catch (error) {
          console.error('Error processing conversation:', error)
          setConversationResponse({
            message: "I'm having trouble processing that request. Could you try rephrasing it?",
            actions: [],
            contextInfo: {
              currentFocus: 'error handling',
              availableElements: [],
              recentChanges: []
            }
          })
        } finally {
          setProcessingConversation(false)
        }
      }
    }

    processLastMessage()
  }, [messages, currentCode, sessionId, showSuggestions, processingConversation, voiceEnabled])

  // Enhanced voice input with continuous listening
  const handleVoiceInput = useCallback(() => {
    if (!speechRecognitionRef.current) return
    
    if (isListening) {
      speechRecognitionRef.current.stop()
      setIsListening(false)
    } else {
      try {
        speechRecognitionRef.current.start()
        setIsListening(true)
      } catch (error) {
        console.error('Failed to start speech recognition:', error)
        setIsListening(false)
      }
    }
  }, [isListening])

  // Enhanced text-to-speech with better voice settings
  const handleTextToSpeech = useCallback((text: string) => {
    if (!('speechSynthesis' in window)) return
    
    // Stop current speech
    window.speechSynthesis.cancel()
    
    // Clean text for better speech
    const cleanText = text
      .replace(/```[\s\S]*?```/g, 'code block')
      .replace(/`([^`]+)`/g, '$1')
      .replace(/\*\*(.*?)\*\*/g, '$1')
      .replace(/\*(.*?)\*/g, '$1')
      .replace(/#{1,6}\s/g, '')
    
    const utterance = new SpeechSynthesisUtterance(cleanText)
    utterance.rate = 0.9
    utterance.pitch = 1.1
    utterance.volume = 0.8
    
    // Use preferred voice if available
    const voices = window.speechSynthesis.getVoices()
    const preferredVoice = voices.find(voice => 
      voice.name.includes('Female') || voice.name.includes('Samantha')
    )
    if (preferredVoice) {
      utterance.voice = preferredVoice
    }
    
    speechSynthesisRef.current = utterance
    window.speechSynthesis.speak(utterance)
  }, [])

  // Enhanced message handling with auto-suggestion
  const handleSendMessage = useCallback((message: string) => {
    if (message.trim()) {
      onSendMessage(message)
      setInputValue('')
      setConversationResponse(null)
      
      // Generate typing indicators for better UX
      setProcessingConversation(true)
    }
  }, [onSendMessage])

  // Smart input suggestions based on context
  const [inputSuggestions, setInputSuggestions] = useState<string[]>([])
  
  useEffect(() => {
    if (inputValue.length > 2) {
      const suggestions = generateInputSuggestions(inputValue, currentCode)
      setInputSuggestions(suggestions)
    } else {
      setInputSuggestions([])
    }
  }, [inputValue, currentCode])

  const generateInputSuggestions = (input: string, code: string): string[] => {
    const suggestions: string[] = []
    const inputLower = input.toLowerCase()
    
    // Common completion suggestions
    if (inputLower.includes('change') && !inputLower.includes('color')) {
      suggestions.push('change the color to blue', 'change the size', 'change the text')
    }
    
    if (inputLower.includes('add') && !inputLower.includes('button')) {
      suggestions.push('add a button', 'add a form', 'add an image')
    }
    
    if (inputLower.includes('make') && !inputLower.includes('bigger')) {
      suggestions.push('make it bigger', 'make it responsive', 'make it interactive')
    }
    
    // Context-aware suggestions based on current code
    if (code.includes('button') && inputLower.includes('button')) {
      suggestions.push('make the button bigger', 'change button color', 'add button animation')
    }
    
    return suggestions.slice(0, 3)
  }

  // Enhanced render methods with better styling and interactions
  const renderMessage = (message: Message, index: number) => {
    const isUser = message.role === 'user'
    const textContent = message.content.find(c => c.type === 'text')?.text || ''
    
    return (
      <div
        key={index}
        className={cn(
          "flex w-full mb-4 group",
          isUser ? "justify-end" : "justify-start"
        )}
      >
        <div
          className={cn(
            "max-w-[85%] rounded-2xl px-4 py-3 shadow-sm",
            isUser
              ? "bg-gradient-to-r from-blue-500 to-blue-600 text-white"
              : "bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 border border-gray-200 dark:border-gray-700"
          )}
        >
          <p className="text-sm leading-relaxed whitespace-pre-wrap">{textContent}</p>
          {!isUser && (
            <div className="mt-3 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleTextToSpeech(textContent)}
                className="h-7 w-7 p-0 hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                <Volume2 className="h-3 w-3" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setFeedbackMode('rating')}
                className="h-7 w-7 p-0 hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                <Star className="h-3 w-3" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigator.clipboard.writeText(textContent)}
                className="h-7 w-7 p-0 hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M8 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z"/>
                  <path d="M6 3a2 2 0 00-2 2v11a2 2 0 002 2h8a2 2 0 002-2V5a2 2 0 00-2-2 3 3 0 01-3 3H9a3 3 0 01-3-3z"/>
                </svg>
              </Button>
            </div>
          )}
        </div>
      </div>
    )
  }

  // Enhanced conversation response rendering with code highlighting
  const renderConversationResponse = () => {
    if (!conversationResponse) return null

    return (
      <div className="space-y-4">
        {/* Main Response with enhanced styling */}
        <Card className="border-l-4 border-l-blue-500">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <div className="h-8 w-8 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center">
                <Sparkles className="h-4 w-4 text-white" />
              </div>
              AI Assistant
              {conversationResponse.contextInfo && (
                <Badge variant="outline" className="ml-auto">
                  Context: {conversationResponse.contextInfo.currentFocus}
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="prose prose-sm dark:prose-invert">
              <p className="text-sm text-muted-foreground leading-relaxed">
                {conversationResponse.message}
              </p>
            </div>
            
            {/* Enhanced Actions Display */}
            {conversationResponse.actions.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-semibold">Proposed Actions:</h4>
                  <Badge variant="secondary" className="text-xs">
                    {conversationResponse.actions.length} action{conversationResponse.actions.length > 1 ? 's' : ''}
                  </Badge>
                </div>
                <div className="space-y-2">
                  {conversationResponse.actions.map((action, index) => (
                    <div
                      key={index}
                      className={cn(
                        "flex items-center justify-between p-3 rounded-lg border transition-all hover:shadow-sm",
                        selectedActions.includes(action.type) 
                          ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20" 
                          : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
                      )}
                    >
                      <div className="flex items-center gap-3 flex-1">
                        <input
                          type="checkbox"
                          checked={selectedActions.includes(action.type)}
                          onChange={(e) => handleActionSelection(action.type, e.target.checked)}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <div className="flex-1">
                          <span className="text-sm font-medium">{action.description}</span>
                          {action.reason && (
                            <p className="text-xs text-muted-foreground mt-1">{action.reason}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge 
                            variant="outline" 
                            className={cn(
                              "text-xs",
                              action.confidence > 0.8 ? "text-green-600 border-green-300" :
                              action.confidence > 0.6 ? "text-yellow-600 border-yellow-300" :
                              "text-orange-600 border-orange-300"
                            )}
                          >
                            {Math.round(action.confidence * 100)}%
                          </Badge>
                          {action.requiresApproval && (
                            <AlertCircle className="h-4 w-4 text-amber-500" />
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <Button
                  onClick={handleApplySelectedActions}
                  disabled={selectedActions.length === 0 || processingConversation}
                  className="w-full"
                  size="sm"
                >
                  {processingConversation ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Applying Changes...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-4 w-4 mr-2" />
                      Apply Selected Actions ({selectedActions.length})
                    </>
                  )}
                </Button>
              </div>
            )}

            {/* Enhanced Clarification Questions */}
            {conversationResponse.clarificationQuestions && conversationResponse.clarificationQuestions.length > 0 && (
              <div className="space-y-3 p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
                <h4 className="text-sm font-semibold flex items-center gap-2 text-amber-800 dark:text-amber-200">
                  <HelpCircle className="h-4 w-4" />
                  I need some clarification:
                </h4>
                <div className="space-y-2">
                  {conversationResponse.clarificationQuestions.map((question, index) => (
                    <div 
                      key={index} 
                      className="p-3 bg-white dark:bg-gray-800 rounded border cursor-pointer hover:border-amber-300 transition-colors"
                      onClick={() => setInputValue(question)}
                    >
                      <p className="text-sm">{question}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Enhanced Context Information */}
            {showContextInfo && conversationResponse.contextInfo && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                <div className="space-y-1">
                  <span className="text-xs font-medium text-muted-foreground">Current Focus</span>
                  <p className="text-sm">{conversationResponse.contextInfo.currentFocus}</p>
                </div>
                <div className="space-y-1">
                  <span className="text-xs font-medium text-muted-foreground">Available Elements</span>
                  <p className="text-sm text-muted-foreground">
                    {conversationResponse.contextInfo.availableElements.slice(0, 3).join(', ')}
                    {conversationResponse.contextInfo.availableElements.length > 3 && '...'}
                  </p>
                </div>
                <div className="space-y-1">
                  <span className="text-xs font-medium text-muted-foreground">Recent Changes</span>
                  <p className="text-sm text-muted-foreground">
                    {conversationResponse.contextInfo.recentChanges.slice(0, 2).join(', ') || 'None'}
                  </p>
                </div>
              </div>
            )}

            {/* Next Steps */}
            {conversationResponse.nextSteps && conversationResponse.nextSteps.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-semibold flex items-center gap-2">
                  <Target className="h-4 w-4" />
                  Suggested Next Steps:
                </h4>
                <ul className="space-y-1">
                  {conversationResponse.nextSteps.map((step, index) => (
                    <li key={index} className="flex items-center gap-2 text-sm text-muted-foreground">
                      <ChevronRight className="h-3 w-3 text-blue-500" />
                      {step}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Enhanced Suggestions */}
        {showSuggestions && conversationResponse.suggestions && conversationResponse.suggestions.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Lightbulb className="h-4 w-4 text-yellow-500" />
                Smart Suggestions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 gap-2">
                {conversationResponse.suggestions.map((suggestion, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-3 rounded-lg border cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors group"
                    onClick={() => setInputValue(suggestion)}
                  >
                    <span className="text-sm flex-1">{suggestion}</span>
                    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Sparkles className="h-4 w-4 text-blue-500" />
                      <ChevronRight className="h-3 w-3 text-muted-foreground" />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    )
  }

  const handleQuickAction = useCallback((action: QuickAction) => {
    if (action.action.type === 'code_change') {
      setSelectedActions([action.id])
      onApplyModification([action.id])
    } else if (action.action.type === 'suggestion') {
      setInputValue(action.description)
    }
  }, [onApplyModification])

  const handleActionSelection = useCallback((actionId: string, selected: boolean) => {
    setSelectedActions(prev => 
      selected 
        ? [...prev, actionId]
        : prev.filter(id => id !== actionId)
    )
  }, [])

  const handleApplySelectedActions = useCallback(() => {
    if (selectedActions.length > 0) {
      onApplyModification(selectedActions)
      setSelectedActions([])
    }
  }, [selectedActions, onApplyModification])

  const handleFeedback = useCallback(async (feedback: UserFeedback) => {
    try {
      await conversationalModificationSystem.applyModifications(
        sessionId,
        [],
        true,
        feedback
      )
      setFeedbackMode('none')
    } catch (error) {
      console.error('Error submitting feedback:', error)
    }
  }, [sessionId])

  const renderQuickActions = () => {
    if (!showQuickActions || !conversationResponse?.quickActions) return null

    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Zap className="h-4 w-4" />
            Quick Actions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {conversationResponse.quickActions.map((action) => (
              <Button
                key={action.id}
                variant="outline"
                size="sm"
                onClick={() => handleQuickAction(action)}
                className="flex items-center gap-2 text-xs"
              >
                <span>{action.icon}</span>
                {action.label}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  const renderFeedbackDialog = () => {
    if (feedbackMode === 'none') return null

    return (
      <Card className="fixed bottom-4 right-4 w-80 z-50">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Feedback</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {feedbackMode === 'rating' && (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleFeedback({ type: 'positive', timestamp: Date.now() })}
              >
                <ThumbsUp className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleFeedback({ type: 'negative', timestamp: Date.now() })}
              >
                <ThumbsDown className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setFeedbackMode('none')}
              >
                Cancel
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    )
  }

  return (
    <div className={cn("flex flex-col h-full", className)}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <h2 className="text-lg font-semibold">Conversational Assistant</h2>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowQuickActions(!showQuickActions)}
          >
            <Zap className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowSuggestions(!showSuggestions)}
          >
            <Lightbulb className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowContextInfo(!showContextInfo)}
          >
            <Target className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Chat Messages */}
      <div
        ref={chatContainerRef}
        className="flex-1 overflow-y-auto p-4 space-y-4"
      >
        {messages.map((message, index) => renderMessage(message, index))}
        
        {processingConversation && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
            Processing your request...
          </div>
        )}
        
        {renderConversationResponse()}
      </div>

      {/* Quick Actions */}
      {renderQuickActions()}

      {/* Input */}
      <div className="p-4 border-t">
        {/* Input Suggestions */}
        {inputSuggestions.length > 0 && (
          <div className="mb-3 flex flex-wrap gap-2">
            {inputSuggestions.map((suggestion, index) => (
              <button
                key={index}
                onClick={() => setInputValue(suggestion)}
                className="px-3 py-1 text-xs bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 rounded-full border border-blue-200 dark:border-blue-800 hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors"
              >
                {suggestion}
              </button>
            ))}
          </div>
        )}

        <div className="flex items-end gap-2">
          <div className="flex-1 relative">
            <textarea
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  handleSendMessage(inputValue)
                }
              }}
              placeholder="Describe the changes you want to make... (Try: 'make the button blue' or 'add a contact form')"
              className="w-full px-4 py-3 border rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none min-h-[44px] max-h-32 transition-all"
              disabled={isLoading || processingConversation}
              rows={1}
              style={{
                height: 'auto',
                minHeight: '44px',
                maxHeight: '128px'
              }}
              onInput={(e) => {
                const target = e.target as HTMLTextAreaElement
                target.style.height = 'auto'
                target.style.height = Math.min(target.scrollHeight, 128) + 'px'
              }}
            />
            
            {/* Voice Indicator */}
            {isListening && (
              <div className="absolute right-3 top-3 flex items-center gap-2">
                <div className="flex items-center gap-1">
                  <div className="w-1 h-3 bg-red-500 rounded-full animate-pulse"></div>
                  <div className="w-1 h-4 bg-red-500 rounded-full animate-pulse" style={{ animationDelay: '0.1s' }}></div>
                  <div className="w-1 h-3 bg-red-500 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></div>
                </div>
                <span className="text-xs text-red-600 font-medium">Listening...</span>
              </div>
            )}

            {/* Character Count */}
            {inputValue.length > 100 && (
              <div className="absolute bottom-1 right-12 text-xs text-muted-foreground">
                {inputValue.length}/500
              </div>
            )}
          </div>
          
          {/* Voice Control */}
          {speechRecognitionRef.current && (
            <div className="flex items-center gap-1">
              <Button
                variant={isListening ? "destructive" : "outline"}
                size="sm"
                onClick={handleVoiceInput}
                className={cn(
                  "h-11 w-11 rounded-xl transition-all",
                  isListening && "animate-pulse"
                )}
                disabled={isLoading || processingConversation}
              >
                {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
              </Button>
              
              {/* Voice Settings */}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setVoiceEnabled(!voiceEnabled)}
                className={cn(
                  "h-11 w-11 rounded-xl",
                  voiceEnabled ? "text-blue-600 bg-blue-50 dark:bg-blue-900/20" : "text-muted-foreground"
                )}
              >
                {voiceEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
              </Button>
            </div>
          )}
          
          {/* Send Button */}
          <Button
            onClick={() => handleSendMessage(inputValue)}
            disabled={!inputValue.trim() || isLoading || processingConversation}
            className="h-11 px-6 rounded-xl"
          >
            {processingConversation ? (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
            ) : (
              <>
                <svg className="h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
                Send
              </>
            )}
          </Button>
        </div>

        {/* Guided Actions */}
        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setInputValue("add a button")}
            className="text-xs h-8 px-3 rounded-lg"
          >
            ➕ Add Element
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setInputValue("change the color to")}
            className="text-xs h-8 px-3 rounded-lg"
          >
            🎨 Change Style
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setInputValue("make it responsive")}
            className="text-xs h-8 px-3 rounded-lg"
          >
            📱 Make Responsive
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setInputValue("fix the")}
            className="text-xs h-8 px-3 rounded-lg"
          >
            🔧 Fix Issue
          </Button>
        </div>
      </div>

      {/* Feedback Dialog - Enhanced */}
      {renderFeedbackDialog()}

      {/* Keyboard Shortcuts Help */}
      <div className="absolute bottom-4 left-4 opacity-0 hover:opacity-100 transition-opacity">
        <div className="bg-black/80 text-white text-xs px-2 py-1 rounded">
          <div>Enter: Send • Shift+Enter: New line</div>
          <div>Ctrl+/: Voice input • Esc: Clear</div>
        </div>
      </div>
    </div>
  )
}

// Enhanced Guided Wizard Component
export function GuidedModificationWizard({
  isOpen,
  onClose,
  onComplete,
  currentCode
}: {
  isOpen: boolean
  onClose: () => void
  onComplete: (instructions: string) => void
  currentCode: string
}) {
  const [step, setStep] = useState(0)
  const [wizardData, setWizardData] = useState({
    intent: '',
    target: '',
    details: ''
  })

  const steps = [
    {
      title: "What would you like to do?",
      options: [
        { id: 'add', label: 'Add something new', icon: '➕' },
        { id: 'modify', label: 'Change existing element', icon: '✏️' },
        { id: 'style', label: 'Update styling', icon: '🎨' },
        { id: 'fix', label: 'Fix an issue', icon: '🔧' }
      ]
    },
    {
      title: "What element?",
      options: [
        { id: 'button', label: 'Button', icon: '🔘' },
        { id: 'form', label: 'Form', icon: '📝' },
        { id: 'text', label: 'Text', icon: '📄' },
        { id: 'image', label: 'Image', icon: '🖼️' },
        { id: 'layout', label: 'Layout', icon: '📐' }
      ]
    }
  ]

  const handleStepComplete = (value: string) => {
    if (step === 0) {
      setWizardData(prev => ({ ...prev, intent: value }))
      setStep(1)
    } else if (step === 1) {
      setWizardData(prev => ({ ...prev, target: value }))
      setStep(2)
    } else {
      const instruction = generateInstruction(wizardData.intent, wizardData.target, value)
      onComplete(instruction)
      onClose()
    }
  }

  const generateInstruction = (intent: string, target: string, details: string) => {
    const templates: Record<string, string> = {
      add: `Add a ${target} ${details}`,
      modify: `Change the ${target} to ${details}`,
      style: `Make the ${target} ${details}`,
      fix: `Fix the ${target} ${details}`
    }
    return templates[intent] || `${intent} the ${target} ${details}`
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4">
        <h3 className="text-lg font-semibold mb-4">
          {step < 2 ? steps[step].title : "Add details"}
        </h3>
        
        {step < 2 ? (
          <div className="grid grid-cols-2 gap-3">
            {steps[step].options.map((option) => (
              <button
                key={option.id}
                onClick={() => handleStepComplete(option.id)}
                className="p-4 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-left"
              >
                <div className="text-2xl mb-2">{option.icon}</div>
                <div className="font-medium">{option.label}</div>
              </button>
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            <textarea
              placeholder="Describe the specific changes you want..."
              className="w-full p-3 border rounded-lg resize-none"
              rows={3}
              onChange={(e) => setWizardData(prev => ({ ...prev, details: e.target.value }))}
            />
            <div className="flex gap-2">
              <Button onClick={() => setStep(step - 1)} variant="outline" className="flex-1">
                Back
              </Button>
              <Button 
                onClick={() => handleStepComplete(wizardData.details)} 
                className="flex-1"
                disabled={!wizardData.details.trim()}
              >
                Complete
              </Button>
            </div>
          </div>
        )}
        
        <Button onClick={onClose} variant="ghost" className="w-full mt-4">
          Cancel
        </Button>
      </div>
    </div>
  )
}

export { naturalLanguageProcessor }
export default ConversationalChatInterface 