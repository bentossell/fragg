'use client'

import { useState, useEffect, useCallback, useRef, useMemo, Suspense } from 'react'
import { usePostHog } from 'posthog-js/react'
import { useLocalStorage } from 'usehooks-ts'
import { experimental_useObject as useObject } from 'ai/react'
import { useQueryState, parseAsString } from 'nuqs'
import modelsList from '@/lib/models.json'
import templates, { TemplateId } from '@/lib/templates'
import { Chat } from '@/components/chat'
import { ChatInput } from '@/components/chat-input'
import { ChatPicker } from '@/components/chat-picker'
import { ChatSettings } from '@/components/chat-settings'
import { Preview } from '@/components/preview'
import { EnhancedPreview } from '@/components/enhanced-preview'
import { NavBar } from '@/components/navbar'
import { AppLibrary, SavedApp } from '@/lib/storage/app-library'
import { singleActiveSandboxManager } from '@/lib/sandbox/single-active-manager'
import { sandboxReconnectionManager } from '@/lib/sandbox/reconnect'
import { sandboxVersionWarmup } from '@/lib/storage/version-warmup'
import { Button } from '@/components/ui/button'
import { Save, Plus, FolderOpen } from 'lucide-react'
import { toast } from '@/components/ui/use-toast'
import type { LLMModelConfig } from '@/lib/models'
import { Message, toAISDKMessages, toMessageImage } from '@/lib/messages'
import { fragmentSchema as schema, FragmentSchema } from '@/lib/schema'
import { ExecutionResult } from '@/lib/types'
import { DeepPartial } from 'ai'
import { forkApp } from './actions/fork-app'

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

function SimplifiedHomeContent() {
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
  
  // URL parameters
  const [urlAppId, setUrlAppId] = useQueryState('app', parseAsString)
  const [forkShareId, setForkShareId] = useQueryState('fork', parseAsString)
  
  // Fragment versioning
  const [fragmentVersions, setFragmentVersions] = useState<FragmentVersion[]>([])
  const [currentVersionIndex, setCurrentVersionIndex] = useState(-1)
  
  // History management for undo/redo
  const [history, setHistory] = useState<HistoryEntry[]>([{ messages: [], fragment: undefined, result: undefined }])
  const [historyIndex, setHistoryIndex] = useState(0)
  
  const appLibrary = new AppLibrary()
  const messagesRef = useRef(messages)
  
  // Add state for auto-save indicator
  const [isAutoSaving, setIsAutoSaving] = useState(false)
  

  
  // Handle forking an app
  const handleForkApp = useCallback(async (shareId: string) => {
    try {
      const result = await forkApp(shareId)
      
      if (!result.success || !result.appData) {
        toast({
          title: 'Failed to fork app',
          description: result.error || 'Unknown error occurred',
          variant: 'destructive'
        })
        // Clear the fork parameter
        setForkShareId(null)
        return
      }
      
      // Set up the forked app
      const { appData } = result
      setAppName(appData.name)
      setSelectedTemplate(appData.template as 'auto' | TemplateId)
      setFragment(appData.code)
      
      // Create initial message
      const forkMessage: Message = {
        role: 'user',
        content: [{ 
          type: 'text', 
          text: appData.description || `Forked from shared app: ${shareId}` 
        }]
      }
      setMessages([forkMessage])
      
      // Clear the fork parameter after loading
      setForkShareId(null)
      
      toast({
        title: 'App forked successfully',
        description: 'You can now edit and save your own version.',
      })
      
      // If there's code, create a sandbox
      if (appData.code) {
        setIsPreviewLoading(true)
        try {
          const response = await fetch('/api/sandbox', {
            method: 'POST',
            body: JSON.stringify({
              fragment: appData.code,
              sessionId: appData.id,
            }),
          })
          
          const sandboxResult = await response.json()
          setResult(sandboxResult)
          setCurrentTab('fragment')
        } catch (error) {
          console.error('Error creating sandbox for forked app:', error)
        } finally {
          setIsPreviewLoading(false)
        }
      }
    } catch (error) {
      console.error('Error forking app:', error)
      toast({
        title: 'Error',
        description: 'Failed to fork the app. Please try again.',
        variant: 'destructive'
      })
      setForkShareId(null)
    }
  }, [setForkShareId])
  
  useEffect(() => {
    messagesRef.current = messages
  }, [messages])
  
  // Update URL when app ID changes
  useEffect(() => {
    if (currentAppId !== urlAppId) {
      setUrlAppId(currentAppId)
    }
  }, [currentAppId])
  
  // Handle fork parameter on mount
  useEffect(() => {
    if (forkShareId && messages.length === 0) {
      // Load the forked app
      handleForkApp(forkShareId)
    }
  }, [forkShareId, messages.length, handleForkApp])

  const [languageModel, setLanguageModel] = useLocalStorage<LLMModelConfig>(
    'languageModel',
    {
      model: 'anthropic/claude-sonnet-4',
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
  ) || filteredModels[0] // Fallback to first model if not found
  const currentTemplate = useMemo(() => 
    selectedTemplate === 'auto' ? templates : { [selectedTemplate]: templates[selectedTemplate] },
    [selectedTemplate]
  )

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
        const newVersions = [...fragmentVersions, newVersion]
        setFragmentVersions(newVersions)
        setCurrentVersionIndex(newVersions.length - 1)
        
        // Warm up adjacent versions for instant switching
        sandboxVersionWarmup.warmupAdjacentVersions(
          newVersions,
          newVersions.length - 1,
          currentAppId || undefined
        )
        
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
        
        // Auto-save the app when code is generated
        setIsAutoSaving(true)
        const firstUserMessage = currentMessages.find(m => m.role === 'user')
        const name = appName || generateAppName(
          firstUserMessage?.content[0]?.type === 'text' ? firstUserMessage.content[0].text : 'App'
        )
        
        // Update fragment versions before saving
        const updatedFragmentVersions = [...newVersions]
        
        const savedApp = appLibrary.saveApp({
          id: currentAppId || undefined,
          name,
          description: firstUserMessage?.content[0]?.type === 'text' ? firstUserMessage.content[0].text : '',
          template: selectedTemplate === 'auto' ? 'auto' : selectedTemplate,
          code: fragment,
          messages: currentMessages
            .filter(msg => msg.role === 'user' || msg.role === 'assistant')
            .map(msg => ({
              id: crypto.randomUUID(),
              role: msg.role as 'user' | 'assistant',
              content: msg.content.map(c => c.type === 'text' ? c.text : '').join('\n'),
              createdAt: new Date().toISOString(),
            })),
          lastSandboxId: result.sbxId,
          sandboxConfig: result,
          fragmentVersions: updatedFragmentVersions,
          currentVersionIndex: updatedFragmentVersions.length - 1
        })
        
        if (!currentAppId) {
          setCurrentAppId(savedApp.id)
        }
        if (!appName) {
          setAppName(savedApp.name)
        }
        
        setTimeout(() => setIsAutoSaving(false), 1500)
      }
    },
  })

  // Helper function to generate app name from prompt
  function generateAppName(prompt: string): string {
    // Extract key words from the prompt
    const words = prompt.toLowerCase().split(' ')
    
    // Common app-related keywords to look for
    const appKeywords = ['app', 'application', 'tool', 'calculator', 'generator', 'converter', 'manager', 'dashboard', 'tracker', 'game', 'quiz', 'form']
    const actionKeywords = ['create', 'build', 'make', 'generate', 'design', 'develop']
    
    // Remove action keywords and common words
    const filteredWords = words.filter(word => 
      !actionKeywords.includes(word) && 
      !['a', 'an', 'the', 'with', 'that', 'for', 'to', 'of', 'in', 'on', 'at', 'by'].includes(word) &&
      word.length > 2
    )
    
    // Find app type keyword
    const appType = words.find(word => appKeywords.includes(word))
    
    // Generate name based on what we found
    if (filteredWords.length > 0) {
      const mainWords = filteredWords.slice(0, 3).map(word => 
        word.charAt(0).toUpperCase() + word.slice(1)
      ).join(' ')
      
      if (appType && !mainWords.toLowerCase().includes(appType)) {
        return `${mainWords} ${appType.charAt(0).toUpperCase() + appType.slice(1)}`
      }
      return mainWords
    }
    
    // Fallback name
    return `App ${new Date().toLocaleDateString()}`
  }

  // Version navigation functions
  const navigateToVersion = useCallback(async (index: number) => {
    if (index >= 0 && index < fragmentVersions.length) {
      const version = fragmentVersions[index]
      setFragment(version.fragment)
      setCurrentVersionIndex(index)
      setCurrentTab('fragment')
      
      // Check if we have a cached sandbox first
      const cachedResult = sandboxVersionWarmup.getCachedSandbox(version.fragment, currentAppId || undefined)
      if (cachedResult) {
        setResult(cachedResult)
        setIsPreviewLoading(false)
        
        // Warm up adjacent versions for next navigation
        sandboxVersionWarmup.warmupAdjacentVersions(fragmentVersions, index, currentAppId || undefined)
        return
      }
      
      // Create a new sandbox if not cached
      if (version.fragment) {
        setIsPreviewLoading(true)
        try {
          const newResult = await sandboxVersionWarmup.getOrCreateSandbox(
            version.fragment,
            currentAppId || undefined
          )
          
          if (newResult) {
            setResult(newResult)
            
            // Update the version with the new sandbox result
            const updatedVersions = [...fragmentVersions]
            updatedVersions[index] = {
              ...version,
              result: newResult
            }
            setFragmentVersions(updatedVersions)
            
            // Auto-save the updated versions
            if (currentAppId) {
              const app = appLibrary.getApp(currentAppId)
              if (app) {
                appLibrary.saveApp({
                  ...app,
                  fragmentVersions: updatedVersions,
                  currentVersionIndex: index,
                  sandboxConfig: newResult,
                  lastSandboxId: newResult.sbxId
                })
              }
            }
            
            // Warm up adjacent versions for next navigation
            sandboxVersionWarmup.warmupAdjacentVersions(fragmentVersions, index, currentAppId || undefined)
          } else {
            throw new Error('Failed to create sandbox')
          }
        } catch (error) {
          console.error('Error creating sandbox for version:', error)
          toast({
            title: 'Failed to load preview',
            description: 'Could not create sandbox for this version.',
            variant: 'destructive'
          })
        } finally {
          setIsPreviewLoading(false)
        }
      }
    }
  }, [fragmentVersions, currentAppId])

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
          sandboxConfig: result,
          fragmentVersions: fragmentVersions,
          currentVersionIndex: currentVersionIndex
        })
      }
    }, 30000) // Auto-save every 30 seconds
    
    return () => clearInterval(saveInterval)
  }, [currentAppId, messages, fragment, selectedTemplate, result, fragmentVersions, currentVersionIndex])

  const handleNewApp = useCallback(async () => {
    // Close current sandbox
    await singleActiveSandboxManager.closeCurrent()
    
    // Clear sandbox cache
    if (currentAppId) {
      sandboxVersionWarmup.clearSessionCache(currentAppId)
    }
    
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
  }, [currentAppId])

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
      sandboxConfig: result,
      fragmentVersions: fragmentVersions,
      currentVersionIndex: currentVersionIndex
    })
    
    setCurrentAppId(savedApp.id)
    
    toast({
      title: 'App saved',
      description: `"${name}" has been saved to your library.`,
    })
  }, [appName, currentAppId, messages, fragment, selectedTemplate, result, fragmentVersions, currentVersionIndex])

  const handleLoadFromLibrary = useCallback(async (app: SavedApp) => {
    console.log('Loading app from library:', app.name)
    
    // Close current sandbox
    await singleActiveSandboxManager.closeCurrent()
    
    // Load app state
    setCurrentAppId(app.id)
    setAppName(app.name)
    setSelectedTemplate(app.template as 'auto' | TemplateId)
    
    // Restore fragment versions if available
    if (app.fragmentVersions && app.fragmentVersions.length > 0) {
      setFragmentVersions(app.fragmentVersions)
      setCurrentVersionIndex(app.currentVersionIndex ?? app.fragmentVersions.length - 1)
      
      // Load the current version
      const currentVersion = app.fragmentVersions[app.currentVersionIndex ?? app.fragmentVersions.length - 1]
      setFragment(currentVersion.fragment)
      // Don't set the old result yet - wait until we create/verify sandbox
      setResult(undefined)
    } else {
      // Fallback to old format - create a single version from app.code
      setFragment(app.code)
      // Don't set the old result yet
      setResult(undefined)
      
      if (app.code) {
        const version: FragmentVersion = {
          fragment: app.code,
          result: app.sandboxConfig,
          timestamp: new Date(app.updatedAt).getTime()
        }
        setFragmentVersions([version])
        setCurrentVersionIndex(0)
      } else {
        setFragmentVersions([])
        setCurrentVersionIndex(-1)
      }
    }
    
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
    
    // If there's code, switch to preview tab
    if (app.code || (app.fragmentVersions && app.fragmentVersions.length > 0)) {
      setCurrentTab('fragment')
      
      // Get the current fragment and result
      const currentFragment = app.fragmentVersions && app.fragmentVersions.length > 0 
        ? app.fragmentVersions[app.currentVersionIndex ?? app.fragmentVersions.length - 1].fragment
        : app.code
      const currentResult = app.fragmentVersions && app.fragmentVersions.length > 0
        ? app.fragmentVersions[app.currentVersionIndex ?? app.fragmentVersions.length - 1].result
        : app.sandboxConfig
      
      // Always create a new sandbox when loading from library
      if (currentFragment) {
        setIsPreviewLoading(true)
        try {
          const response = await fetch('/api/sandbox', {
            method: 'POST',
            body: JSON.stringify({
              fragment: currentFragment,
              sessionId: app.id,
            }),
          })
          
          const result = await response.json()
          
          // Check if sandbox creation was successful
          if (!response.ok || result.error) {
            throw new Error(result.details || result.error || 'Failed to create sandbox')
          }
          
          console.log('Created new sandbox for loaded app:', result.sbxId)
          setResult(result)
          
          // Update the version with the new result
          if (app.fragmentVersions && app.fragmentVersions.length > 0) {
            const updatedVersions = [...app.fragmentVersions]
            const versionIndex = app.currentVersionIndex ?? app.fragmentVersions.length - 1
            updatedVersions[versionIndex] = {
              ...updatedVersions[versionIndex],
              result
            }
            setFragmentVersions(updatedVersions)
            
            // Warm up adjacent versions for instant switching
            sandboxVersionWarmup.warmupAdjacentVersions(
              updatedVersions,
              versionIndex,
              app.id
            )
          }
          
          // Update the app with the new sandbox config
          appLibrary.saveApp({
            ...app,
            sandboxConfig: result,
            lastSandboxId: result.sbxId,
            fragmentVersions: app.fragmentVersions && app.fragmentVersions.length > 0 ? fragmentVersions : undefined
          })
          
          // Update the last message with the result if it exists
          if (chatMessages.length > 0 && chatMessages[chatMessages.length - 1].role === 'assistant') {
            const updated = [...chatMessages]
            updated[updated.length - 1] = {
              ...updated[updated.length - 1],
              result,
            }
            setMessages(updated)
          }
        } catch (error) {
          console.error('Failed to create sandbox:', error)
          toast({
            title: 'Failed to load preview',
            description: error instanceof Error ? error.message : 'Could not create sandbox for the app. The code is still available.',
            variant: 'destructive'
          })
          // Keep the fragment loaded even if sandbox creation fails
          setCurrentTab('code')
        } finally {
          setIsPreviewLoading(false)
        }
      }
    }
    
    toast({
      title: 'App loaded',
      description: `"${app.name}" has been loaded from your library.`,
    })
  }, [])

  // Check if we need to load an app from library on mount
  useEffect(() => {
    if (urlAppId) {
      const app = appLibrary.getApp(urlAppId)
      if (app) {
        handleLoadFromLibrary(app)
      }
    } else {
      // Fallback: check sessionStorage for backwards compatibility
      const loadAppId = sessionStorage.getItem('loadAppId')
      if (loadAppId) {
        sessionStorage.removeItem('loadAppId')
        const app = appLibrary.getApp(loadAppId)
        if (app) {
          handleLoadFromLibrary(app)
          // Update URL to include app ID
          setUrlAppId(loadAppId)
        }
      }
    }
  }, [urlAppId]) // Only depend on urlAppId to prevent re-renders

  const handleClear = useCallback(() => {
    stop()
    
    // Clear sandbox cache
    if (currentAppId) {
      sandboxVersionWarmup.clearSessionCache(currentAppId)
    }
    
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
  }, [stop, addToHistory, currentAppId])

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
        <div className={`flex flex-col w-full h-full max-w-[800px] mx-auto px-4 overflow-hidden ${fragment ? 'col-span-1' : 'col-span-2'}`}>
          <div className="flex-1 overflow-y-auto min-h-0 pb-2">
            <Chat
              messages={messages}
              isLoading={isLoading}
              setCurrentPreview={setCurrentPreview}
              onEditMessage={handleEditMessage}
            />
          </div>
          <div className="flex-shrink-0 bg-background">
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
              isMultiModal={Boolean(currentModel?.multiModal)}
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
        {fragment ? (
          <EnhancedPreview
            fragment={fragment}
            result={result}
            isLoading={isPreviewLoading}
            isGenerating={isLoading}
            currentAppId={currentAppId}
            appName={appName}
            template={selectedTemplate}
            messages={messages}
            onAppNameChange={setAppName}
            onSave={handleSaveToLibrary}
            onSandboxRecreate={async (fragment) => {
              const response = await fetch('/api/sandbox', {
                method: 'POST',
                body: JSON.stringify({
                  fragment,
                  sessionId: currentAppId,
                }),
              })
              return await response.json()
            }}
            fragmentVersions={fragmentVersions}
            currentVersionIndex={currentVersionIndex}
            onVersionChange={navigateToVersion}
          />
        ) : (
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
            isAutoSaving={isAutoSaving}
          />
        )}
      </div>
    </main>
  )
}

export default function SimplifiedHome() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-screen">Loading...</div>}>
      <SimplifiedHomeContent />
    </Suspense>
  )
} 