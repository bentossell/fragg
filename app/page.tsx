'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { usePostHog } from 'posthog-js/react'
import { useLocalStorage } from 'usehooks-ts'
import { experimental_useObject as useObject } from 'ai/react'
import modelsList from '@/lib/models.json'
import templates, { TemplateId } from '@/lib/templates'
import { Chat } from '@/components/chat'
import { ChatInput } from '@/components/chat-input'
import { ChatPicker } from '@/components/chat-picker'
import { ChatSettings } from '@/components/chat-settings'
import { Preview } from '@/components/preview'
import { NavBar } from '@/components/navbar'
import { AppLibrary, SavedApp } from '@/lib/storage/app-library'
import { singleActiveSandboxManager } from '@/lib/sandbox/single-active-manager'
import { sandboxReconnectionManager } from '@/lib/sandbox/reconnect'
import { Button } from '@/components/ui/button'
import { Save, Plus, FolderOpen } from 'lucide-react'
import { toast } from '@/components/ui/use-toast'
import type { LLMModelConfig } from '@/lib/models'
import { Message, toAISDKMessages, toMessageImage } from '@/lib/messages'
import { fragmentSchema as schema, FragmentSchema } from '@/lib/schema'
import { ExecutionResult } from '@/lib/types'
import { DeepPartial } from 'ai'

interface HistoryEntry {
  messages: Message[]
  fragment?: DeepPartial<FragmentSchema>
  result?: ExecutionResult
}

interface FragmentVersion {
  fragment: DeepPartial<FragmentSchema>
  result?: ExecutionResult
  timestamp: number
}

export default function SimplifiedHome() {
  const [chatInput, setChatInput] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [selectedTemplate, setSelectedTemplate] = useState<'auto' | TemplateId>('auto')
  const [currentAppId, setCurrentAppId] = useState<string | null>(null)
  const [appName, setAppName] = useState<string>('')
  const [messages, setMessages] = useState<Message[]>([])
  const [fragment, setFragment] = useState<DeepPartial<FragmentSchema> | undefined>()
  const [result, setResult] = useState<ExecutionResult | undefined>()
  const [currentTab, setCurrentTab] = useState<'code' | 'fragment'>('code')
  const [isPreviewLoading, setIsPreviewLoading] = useState(false)
  
  // Fragment versioning
  const [fragmentVersions, setFragmentVersions] = useState<FragmentVersion[]>([])
  const [currentVersionIndex, setCurrentVersionIndex] = useState(-1)
  
  // History management for undo/redo
  const [history, setHistory] = useState<HistoryEntry[]>([{ messages: [], fragment: undefined, result: undefined }])
  const [historyIndex, setHistoryIndex] = useState(0)
  
  const appLibrary = new AppLibrary()
  const messagesRef = useRef(messages)
  
  useEffect(() => {
    messagesRef.current = messages
  }, [messages])
  
  const [languageModel, setLanguageModel] = useLocalStorage<LLMModelConfig>(
    'languageModel',
    {
      model: 'anthropic/claude-3.5-sonnet-latest',
    },
  )

  const posthog = usePostHog()

  const filteredModels = modelsList.models.filter((model: any) => {
    if (process.env.NEXT_PUBLIC_HIDE_LOCAL_MODELS) {
      return model.providerId !== 'ollama'
    }
    return true
  })

  const currentModel = filteredModels.find(
    (model: any) => model.id === languageModel.model,
  )
  const currentTemplate = selectedTemplate === 'auto' ? templates : { [selectedTemplate]: templates[selectedTemplate] }

  // Add state to history
  const addToHistory = useCallback((newMessages: Message[], newFragment?: DeepPartial<FragmentSchema>, newResult?: ExecutionResult) => {
    const newEntry: HistoryEntry = {
      messages: newMessages,
      fragment: newFragment,
      result: newResult,
    }
    
    // If we're not at the end of history, remove future entries
    const newHistory = history.slice(0, historyIndex + 1)
    newHistory.push(newEntry)
    
    setHistory(newHistory)
    setHistoryIndex(newHistory.length - 1)
  }, [history, historyIndex])

  // Use AI SDK object for generating
  const { object, submit, isLoading, stop, error } = useObject({
    api: '/api/chat',
    schema,
    onError: (error) => {
      console.error('Error submitting request:', error)
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      })
    },
    onFinish: async ({ object: fragment, error }) => {
      if (!error && fragment) {
        setIsPreviewLoading(true)
        console.log('fragment', fragment)
        posthog.capture('fragment_generated', {
          template: fragment?.template,
        })
        
        const response = await fetch('/api/sandbox', {
          method: 'POST',
          body: JSON.stringify({
            fragment,
            sessionId: currentAppId,
          }),
        })

        const result = await response.json()
        console.log('result', result)
        posthog.capture('sandbox_created', { url: result.url })
        
        setResult(result)
        setCurrentTab('fragment')
        setIsPreviewLoading(false)
        
        // Add to fragment versions
        const newVersion: FragmentVersion = {
          fragment,
          result,
          timestamp: Date.now()
        }
        setFragmentVersions(prev => [...prev, newVersion])
        setCurrentVersionIndex(fragmentVersions.length)
        
        // Update the last message with the result
        const currentMessages = messagesRef.current
        if (currentMessages.length > 0 && currentMessages[currentMessages.length - 1].role === 'assistant') {
          const updated = [...currentMessages]
          updated[updated.length - 1] = {
            ...updated[updated.length - 1],
            result,
          }
          setMessages(updated)
          addToHistory(updated, fragment, result)
        }
      }
    },
  })

  // Version navigation functions
  const navigateToVersion = useCallback((index: number) => {
    if (index >= 0 && index < fragmentVersions.length) {
      const version = fragmentVersions[index]
      setFragment(version.fragment)
      setResult(version.result)
      setCurrentVersionIndex(index)
      setCurrentTab('fragment')
    }
  }, [fragmentVersions])

  const goToPreviousVersion = useCallback(() => {
    if (currentVersionIndex > 0) {
      navigateToVersion(currentVersionIndex - 1)
    }
  }, [currentVersionIndex, navigateToVersion])

  const goToNextVersion = useCallback(() => {
    if (currentVersionIndex < fragmentVersions.length - 1) {
      navigateToVersion(currentVersionIndex + 1)
    }
  }, [currentVersionIndex, fragmentVersions.length, navigateToVersion])

  // Update fragment when object changes
  useEffect(() => {
    if (object) {
      setFragment(object)
      
      const content: Message['content'] = []
      
      if ('commentary' in object) {
        content.push({ type: 'text', text: object.commentary || '' })
      }
      
      if (object.code) {
        content.push({ type: 'code', text: object.code })
      }
      
      if (content.length === 0) return
      
      const currentMessages = messagesRef.current
      const lastMessage = currentMessages[currentMessages.length - 1]
        
      if (!lastMessage || lastMessage.role === 'user') {
        // Add new assistant message
        const newMessage: Message = {
          role: 'assistant',
          content,
          object,
        }
        const newMessages = [...currentMessages, newMessage]
        setMessages(newMessages)
        // Don't add to history during streaming, wait for onFinish
      } else if (lastMessage.role === 'assistant') {
        // Update existing assistant message
        const updated = [...currentMessages]
        updated[updated.length - 1] = {
          ...lastMessage,
          content,
          object,
        }
        setMessages(updated)
        // Don't add to history during streaming, wait for onFinish
      }
    }
  }, [object])

  // Check if we need to load an app from library on mount
  useEffect(() => {
    const loadAppId = sessionStorage.getItem('loadAppId')
    if (loadAppId) {
      sessionStorage.removeItem('loadAppId')
      const app = appLibrary.getApp(loadAppId)
      if (app) {
        handleLoadFromLibrary(app)
      }
    }
  }, [])

  // Auto-save current state periodically
  useEffect(() => {
    if (!currentAppId || messages.length === 0) return
    
    const saveInterval = setInterval(() => {
      const app = appLibrary.getApp(currentAppId)
      if (app) {
        appLibrary.saveApp({
          ...app,
          messages: messages
            .filter(msg => msg.role === 'user' || msg.role === 'assistant')
            .map(msg => ({
              id: crypto.randomUUID(),
              role: msg.role as 'user' | 'assistant',
              content: msg.content.map(c => c.type === 'text' ? c.text : '').join('\n'),
              createdAt: new Date().toISOString(),
            })),
          code: fragment,
          template: selectedTemplate === 'auto' ? 'auto' : selectedTemplate,
        })
      }
    }, 30000) // Auto-save every 30 seconds
    
    return () => clearInterval(saveInterval)
  }, [currentAppId, messages, fragment, selectedTemplate])

  const handleNewApp = useCallback(async () => {
    // Close current sandbox
    await singleActiveSandboxManager.closeCurrent()
    
    // Clear state
    setMessages([])
    setChatInput('')
    setFiles([])
    setCurrentAppId(null)
    setAppName('')
    setFragment(undefined)
    setResult(undefined)
    setCurrentTab('code')
    setFragmentVersions([])
    setCurrentVersionIndex(-1)
    
    toast({
      title: 'New app started',
      description: 'Ready to create something new!',
    })
    
    // Reset history
    setHistory([{ messages: [], fragment: undefined, result: undefined }])
    setHistoryIndex(0)
  }, [])

  const handleSaveToLibrary = useCallback(() => {
    const name = appName || `App ${new Date().toLocaleDateString()}`
    const firstUserMessage = messages.find(m => m.role === 'user')
    
    const savedApp = appLibrary.saveApp({
      id: currentAppId || undefined,
      name,
      description: firstUserMessage?.content[0]?.type === 'text' ? firstUserMessage.content[0].text : '',
      template: selectedTemplate === 'auto' ? 'auto' : selectedTemplate,
      code: fragment,
      messages: messages
        .filter(msg => msg.role === 'user' || msg.role === 'assistant')
        .map(msg => ({
          id: crypto.randomUUID(),
          role: msg.role as 'user' | 'assistant',
          content: msg.content.map(c => c.type === 'text' ? c.text : '').join('\n'),
          createdAt: new Date().toISOString(),
        })),
      lastSandboxId: result?.sbxId,
    })
    
    setCurrentAppId(savedApp.id)
    
    toast({
      title: 'App saved',
      description: `"${name}" has been saved to your library.`,
    })
  }, [appName, currentAppId, messages, fragment, selectedTemplate, result])

  const handleLoadFromLibrary = useCallback(async (app: SavedApp) => {
    // Close current sandbox
    await singleActiveSandboxManager.closeCurrent()
    
    // Load app state
    setCurrentAppId(app.id)
    setAppName(app.name)
    setSelectedTemplate(app.template as 'auto' | TemplateId)
    
    // Convert app messages to chat messages
    const chatMessages: Message[] = app.messages.map((msg, index) => ({
      role: msg.role,
      content: [{ type: 'text', text: msg.content }],
      ...(msg.role === 'assistant' && index === app.messages.length - 1 && app.code ? { 
        object: app.code, 
        result: app.sandboxConfig 
      } : {})
    }))
    
    setMessages(chatMessages)
    setFragment(app.code)
    setResult(app.sandboxConfig)
    
    // If there's code and result, switch to preview tab
    if (app.code && app.sandboxConfig) {
      setCurrentTab('fragment')
    }
    
    // If there's code, create a sandbox with it
    if (app.code && app.lastSandboxId) {
      try {
        const { sandbox } = await sandboxReconnectionManager.getOrCreateSandbox(
          app.id,
          app.lastSandboxId,
          app.template
        )
        
        // Write code to sandbox
        if (sandbox && app.code.files) {
          for (const file of app.code.files) {
            await sandbox.files.write(file.path, file.content)
          }
        }
      } catch (error) {
        console.error('Failed to restore sandbox:', error)
      }
    }
    
    toast({
      title: 'App loaded',
      description: `"${app.name}" has been loaded from your library.`,
    })
  }, [])

  const handleClear = useCallback(() => {
    stop()
    const clearedState = {
      messages: [],
      fragment: undefined,
      result: undefined,
    }
    setMessages(clearedState.messages)
    setChatInput('')
    setFiles([])
    setFragment(clearedState.fragment)
    setResult(clearedState.result)
    setCurrentTab('code')
    setFragmentVersions([])
    setCurrentVersionIndex(-1)
    addToHistory(clearedState.messages, clearedState.fragment, clearedState.result)
  }, [stop, addToHistory])

  const handleUndo = useCallback(() => {
    if (historyIndex > 0) {
      stop() // Stop any ongoing generation
      const newIndex = historyIndex - 1
      const entry = history[newIndex]
      setHistoryIndex(newIndex)
      setMessages(entry.messages)
      setFragment(entry.fragment)
      setResult(entry.result)
      // Reset to code tab if no result
      if (!entry.result) {
        setCurrentTab('code')
      }
    }
  }, [history, historyIndex, stop])

  const handleRedo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      stop() // Stop any ongoing generation
      const newIndex = historyIndex + 1
      const entry = history[newIndex]
      setHistoryIndex(newIndex)
      setMessages(entry.messages)
      setFragment(entry.fragment)
      setResult(entry.result)
      // Switch to preview tab if there's a result
      if (entry.result) {
        setCurrentTab('fragment')
      }
    }
  }, [history, historyIndex, stop])

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()

    if (isLoading) {
      stop()
      return
    }

    const content: Message['content'] = [{ type: 'text', text: chatInput }]
    const images = await toMessageImage(files)

    if (images.length > 0) {
      images.forEach((image) => {
        content.push({ type: 'image', image })
      })
    }

    const userMessage: Message = {
      role: 'user',
      content,
    }
    
    const newMessages = [...messages, userMessage]
    setMessages(newMessages)
    addToHistory(newMessages, fragment, result)

    submit({
      messages: toAISDKMessages(newMessages),
      template: currentTemplate,
      model: currentModel,
      config: languageModel,
    })

    setChatInput('')
    setFiles([])
    setCurrentTab('code')

    posthog.capture('chat_submit', {
      template: selectedTemplate,
      model: languageModel.model,
    })
  }

  const retry = useCallback(() => {
    submit({
      messages: toAISDKMessages(messages),
      template: currentTemplate,
      model: currentModel,
      config: languageModel,
    })
  }, [messages, currentTemplate, currentModel, languageModel, submit])

  function setCurrentPreview(preview: {
    fragment: DeepPartial<FragmentSchema> | undefined
    result: ExecutionResult | undefined
  }) {
    setFragment(preview.fragment || undefined)
    setResult(preview.result)
    // Switch to preview tab if there's a result
    if (preview.result) {
      setCurrentTab('fragment')
    }
  }

  const handleEditMessage = useCallback((index: number, newContent: string) => {
    // Stop any ongoing generation
    stop()
    
    // Update the message content
    const updatedMessages = [...messages]
    updatedMessages[index] = {
      ...updatedMessages[index],
      content: [{ type: 'text', text: newContent }]
    }
    
    // Remove all messages after the edited one
    const messagesUpToEdit = updatedMessages.slice(0, index + 1)
    setMessages(messagesUpToEdit)
    
    // Clear fragment and result since we're resubmitting
    setFragment(undefined)
    setResult(undefined)
    setCurrentTab('code')
    
    // Add to history
    addToHistory(messagesUpToEdit, undefined, undefined)
    
    // Resubmit the conversation
    submit({
      messages: toAISDKMessages(messagesUpToEdit),
      template: currentTemplate,
      model: currentModel,
      config: languageModel,
    })
  }, [messages, stop, currentTemplate, currentModel, languageModel, submit, addToHistory])

  return (
    <main className="flex flex-col h-screen">
      <NavBar
        session={null}
        showLogin={() => {}}
        signOut={() => {}}
        onClear={handleClear}
        canClear={messages.length > 0}
        onSocialClick={() => {}}
        onUndo={handleUndo}
        canUndo={historyIndex > 0}
        onNewChat={handleNewApp}
        onRedo={handleRedo}
        canRedo={historyIndex < history.length - 1}
      />
      
      <div className="flex-1 grid w-full md:grid-cols-2 overflow-hidden">
        <div className={`flex flex-col w-full h-full max-w-[800px] mx-auto px-4 ${fragment ? 'col-span-1' : 'col-span-2'}`}>
          <div className="flex-1 overflow-y-auto">
            <Chat
              messages={messages}
              isLoading={isLoading}
              setCurrentPreview={setCurrentPreview}
              onEditMessage={handleEditMessage}
            />
          </div>
          <div className="bg-background">
            <ChatInput
              retry={retry}
              isErrored={error !== undefined}
              errorMessage={error?.message || ''}
              isLoading={isLoading}
              isRateLimited={false}
              stop={stop}
              input={chatInput}
              handleInputChange={(e) => setChatInput(e.target.value)}
              handleSubmit={handleSubmit}
              isMultiModal={currentModel?.multiModal || false}
              files={files}
              handleFileChange={setFiles}
            >
              <ChatPicker
                templates={templates}
                selectedTemplate={selectedTemplate}
                onSelectedTemplateChange={setSelectedTemplate}
                models={filteredModels}
                languageModel={languageModel}
                onLanguageModelChange={setLanguageModel}
              />
            </ChatInput>
          </div>
        </div>
        <Preview
          teamID={undefined}
          accessToken={undefined}
          selectedTab={currentTab}
          onSelectedTabChange={setCurrentTab}
          isChatLoading={isLoading}
          isPreviewLoading={isPreviewLoading}
          fragment={fragment}
          result={result as ExecutionResult}
          onClose={() => setFragment(undefined)}
          appName={appName}
          onAppNameChange={setAppName}
          onSave={handleSaveToLibrary}
          canSave={messages.length > 0}
          fragmentVersions={fragmentVersions}
          currentVersionIndex={currentVersionIndex}
          onPreviousVersion={goToPreviousVersion}
          onNextVersion={goToNextVersion}
        />
      </div>
    </main>
  )
} 