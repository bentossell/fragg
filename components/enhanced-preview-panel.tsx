'use client'

import React, { useState, useCallback, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { Button } from './ui/button'
import { Badge } from './ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs'
import { ScrollArea } from './ui/scroll-area'
import { 
  Play, 
  Pause, 
  RefreshCw, 
  Maximize2, 
  Minimize2,
  MessageCircle,
  Code2,
  Eye,
  Settings,
  Sparkles,
  Brain,
  Zap,
  Target,
  History
} from 'lucide-react'
import { cn } from '@/lib/utils'
import ConversationalChatInterface, { GuidedModificationWizard } from './conversational-chat-interface'
import { conversationalModificationSystem } from '@/lib/conversational-modification-system'
import { Message } from '@/lib/messages'

interface EnhancedPreviewPanelProps {
  code: string
  onCodeChange: (newCode: string) => void
  isLoading?: boolean
  className?: string
  sessionId: string
  messages: Message[]
  onSendMessage: (message: string) => void
}

export function EnhancedPreviewPanel({
  code,
  onCodeChange,
  isLoading = false,
  className,
  sessionId,
  messages,
  onSendMessage
}: EnhancedPreviewPanelProps) {
  const [activeTab, setActiveTab] = useState<'preview' | 'conversation' | 'history'>('preview')
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [isAutoRefresh, setIsAutoRefresh] = useState(true)
  const [showWizard, setShowWizard] = useState(false)
  const [conversationMode, setConversationMode] = useState<'chat' | 'wizard' | 'ai-assistant'>('chat')
  const [codeHistory, setCodeHistory] = useState<Array<{
    version: string
    timestamp: number
    description: string
    changes: string[]
  }>>([])

  // Enhanced preview rendering with error boundary
  const renderPreview = useCallback(() => {
    try {
      // Create a sandbox iframe for safe code execution
      const iframeContent = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Preview</title>
          <script src="https://unpkg.com/react@18/umd/react.development.js"></script>
          <script src="https://unpkg.com/react-dom@18/umd/react-dom.development.js"></script>
          <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
          <script src="https://cdn.tailwindcss.com"></script>
          <style>
            body { margin: 0; padding: 20px; font-family: system-ui, -apple-system, sans-serif; }
            .error { color: #ef4444; background: #fef2f2; padding: 12px; border-radius: 8px; border: 1px solid #fecaca; }
          </style>
        </head>
        <body>
          <div id="root"></div>
          <script type="text/babel">
            try {
              ${code}
              
              // Auto-render if there's a default export
              if (typeof window.App !== 'undefined') {
                const { createRoot } = ReactDOM;
                const root = createRoot(document.getElementById('root'));
                root.render(React.createElement(window.App));
              } else {
                // Try to find and render any React component
                const componentNames = Object.keys(window).filter(key => 
                  typeof window[key] === 'function' && 
                  key[0] === key[0].toUpperCase()
                );
                if (componentNames.length > 0) {
                  const { createRoot } = ReactDOM;
                  const root = createRoot(document.getElementById('root'));
                  root.render(React.createElement(window[componentNames[0]]));
                }
              }
            } catch (error) {
              document.getElementById('root').innerHTML = 
                '<div class="error"><strong>Error:</strong> ' + error.message + '</div>';
            }
          </script>
        </body>
        </html>
      `
      
      return (
        <iframe
          srcDoc={iframeContent}
          className="w-full h-full border-0 rounded-lg"
          sandbox="allow-scripts allow-same-origin"
          title="Code Preview"
        />
      )
    } catch (error) {
      return (
        <div className="flex items-center justify-center h-full text-red-500">
          <div className="text-center">
            <h3 className="font-semibold mb-2">Preview Error</h3>
            <p className="text-sm">Failed to render preview</p>
          </div>
        </div>
      )
    }
  }, [code])

  // Handle conversational modifications
  const handleConversationalModification = useCallback(async (instructions: string) => {
    try {
      const response = await conversationalModificationSystem.processConversation(
        sessionId,
        instructions,
        code,
        {
          enableSuggestions: true,
          requireConfirmation: false,
          preserveContext: true
        }
      )

      if (response.actions.length > 0) {
        // Apply modifications automatically for simple changes
        const simpleActions = response.actions.filter(a => 
          a.confidence > 0.8 && !a.requiresApproval
        )
        
        if (simpleActions.length > 0) {
          const result = await conversationalModificationSystem.applyModifications(
            sessionId,
            simpleActions.map(a => a.type),
            true
          )
          
          if (result.success && result.modifiedCode) {
            onCodeChange(result.modifiedCode)
            
            // Add to history
            setCodeHistory(prev => [...prev, {
              version: result.modifiedCode,
              timestamp: Date.now(),
              description: instructions,
              changes: result.appliedActions.map(a => a.description)
            }])
          }
        }
      }
    } catch (error) {
      console.error('Failed to apply conversational modification:', error)
    }
  }, [sessionId, code, onCodeChange])

  // Auto-refresh when code changes
  useEffect(() => {
    if (isAutoRefresh && activeTab === 'preview') {
      // Auto-refresh preview when code changes
      const timer = setTimeout(() => {
        // Trigger re-render
      }, 500)
      return () => clearTimeout(timer)
    }
  }, [code, isAutoRefresh, activeTab])

  return (
    <Card className={cn("flex flex-col h-full", className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-blue-500" />
            Enhanced Preview
            {isLoading && (
              <Badge variant="secondary" className="ml-2">
                <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                Updating
              </Badge>
            )}
          </CardTitle>
          
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsAutoRefresh(!isAutoRefresh)}
              className={cn(
                "h-8 w-8 p-0",
                isAutoRefresh && "text-green-600 bg-green-50 dark:bg-green-900/20"
              )}
            >
              {isAutoRefresh ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
            </Button>
            
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowWizard(true)}
              className="h-8 w-8 p-0"
            >
              <Brain className="h-4 w-4" />
            </Button>
            
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="h-8 w-8 p-0"
            >
              {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </Button>
          </div>
        </div>
        
        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as any)} className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="preview" className="flex items-center gap-2">
              <Eye className="h-4 w-4" />
              Preview
            </TabsTrigger>
            <TabsTrigger value="conversation" className="flex items-center gap-2">
              <MessageCircle className="h-4 w-4" />
              AI Assistant
              <Badge variant="secondary" className="ml-1 text-xs">
                {conversationMode === 'ai-assistant' ? 'AI' : conversationMode}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="history" className="flex items-center gap-2">
              <History className="h-4 w-4" />
              History
              <Badge variant="outline" className="ml-1 text-xs">
                {codeHistory.length}
              </Badge>
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </CardHeader>
      
      <CardContent className="flex-1 p-0">
        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as any)} className="h-full">
          <TabsContent value="preview" className="h-full m-0 p-4">
            <div className="h-full rounded-lg border bg-white dark:bg-gray-900 overflow-hidden">
              {renderPreview()}
            </div>
          </TabsContent>
          
          <TabsContent value="conversation" className="h-full m-0">
            <div className="h-full flex flex-col">
              {/* Conversation Mode Selector */}
              <div className="p-4 border-b">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">Mode:</span>
                  <div className="flex items-center gap-1">
                    <Button
                      variant={conversationMode === 'chat' ? 'default' : 'ghost'}
                      size="sm"
                      onClick={() => setConversationMode('chat')}
                      className="h-8 px-3"
                    >
                      <MessageCircle className="h-3 w-3 mr-1" />
                      Chat
                    </Button>
                    <Button
                      variant={conversationMode === 'wizard' ? 'default' : 'ghost'}
                      size="sm"
                      onClick={() => setConversationMode('wizard')}
                      className="h-8 px-3"
                    >
                      <Target className="h-3 w-3 mr-1" />
                      Wizard
                    </Button>
                    <Button
                      variant={conversationMode === 'ai-assistant' ? 'default' : 'ghost'}
                      size="sm"
                      onClick={() => setConversationMode('ai-assistant')}
                      className="h-8 px-3"
                    >
                      <Sparkles className="h-3 w-3 mr-1" />
                      AI Assistant
                    </Button>
                  </div>
                </div>
              </div>
              
              {/* Conversation Interface */}
              <div className="flex-1">
                {conversationMode === 'chat' && (
                  <ConversationalChatInterface
                    messages={messages}
                    currentCode={code}
                    sessionId={sessionId}
                    isLoading={isLoading}
                    onSendMessage={onSendMessage}
                    onApplyModification={(actionIds) => {
                      // Handle modification application
                      console.log('Applying modifications:', actionIds)
                    }}
                    onCodeChange={onCodeChange}
                  />
                )}
                
                {conversationMode === 'wizard' && (
                  <div className="h-full flex items-center justify-center p-8">
                    <div className="text-center space-y-4">
                      <div className="w-16 h-16 mx-auto bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                        <Target className="h-8 w-8 text-white" />
                      </div>
                      <h3 className="text-lg font-semibold">Guided Modifications</h3>
                      <p className="text-sm text-muted-foreground max-w-sm">
                        Use the wizard to make step-by-step modifications to your code with AI guidance.
                      </p>
                      <Button onClick={() => setShowWizard(true)} className="mt-4">
                        <Zap className="h-4 w-4 mr-2" />
                        Start Wizard
                      </Button>
                    </div>
                  </div>
                )}
                
                {conversationMode === 'ai-assistant' && (
                  <div className="h-full flex items-center justify-center p-8">
                    <div className="text-center space-y-4">
                      <div className="w-16 h-16 mx-auto bg-gradient-to-r from-green-500 to-blue-600 rounded-full flex items-center justify-center">
                        <Brain className="h-8 w-8 text-white" />
                      </div>
                      <h3 className="text-lg font-semibold">AI Assistant</h3>
                      <p className="text-sm text-muted-foreground max-w-sm">
                        Get intelligent suggestions and automated code improvements from the AI assistant.
                      </p>
                      <div className="space-y-2">
                        <Button variant="outline" size="sm" className="w-full">
                          <Sparkles className="h-4 w-4 mr-2" />
                          Optimize Code
                        </Button>
                        <Button variant="outline" size="sm" className="w-full">
                          <Target className="h-4 w-4 mr-2" />
                          Improve Accessibility
                        </Button>
                        <Button variant="outline" size="sm" className="w-full">
                          <Zap className="h-4 w-4 mr-2" />
                          Add Interactivity
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </TabsContent>
          
          <TabsContent value="history" className="h-full m-0">
            <ScrollArea className="h-full">
              <div className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold">Modification History</h3>
                  <Badge variant="outline">{codeHistory.length} changes</Badge>
                </div>
                
                {codeHistory.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <History className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No modifications yet</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {codeHistory.reverse().map((entry, index) => (
                      <Card key={index} className="p-3">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1">
                            <p className="text-sm font-medium">{entry.description}</p>
                            <p className="text-xs text-muted-foreground">
                              {new Date(entry.timestamp).toLocaleString()}
                            </p>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onCodeChange(entry.version)}
                            className="h-7 px-2"
                          >
                            <RefreshCw className="h-3 w-3" />
                          </Button>
                        </div>
                        {entry.changes.length > 0 && (
                          <div className="space-y-1">
                            {entry.changes.map((change, changeIndex) => (
                              <div key={changeIndex} className="text-xs text-muted-foreground flex items-center gap-1">
                                <div className="w-1 h-1 bg-blue-500 rounded-full"></div>
                                {change}
                              </div>
                            ))}
                          </div>
                        )}
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </CardContent>
      
      {/* Guided Modification Wizard */}
      <GuidedModificationWizard
        isOpen={showWizard}
        onClose={() => setShowWizard(false)}
        onComplete={handleConversationalModification}
        currentCode={code}
      />
    </Card>
  )
} 