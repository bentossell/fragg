'use client'

import React, { useState, useEffect, useCallback, useRef, useMemo, Suspense, memo } from 'react'
import { usePostHog } from 'posthog-js/react'
import { experimental_useObject as useObject } from 'ai/react'
import { useQueryState, parseAsString } from 'nuqs'
import { useIsMobile, useIsDesktop } from '@/lib/hooks/use-media-query'
import { useDebounce, useDebouncedCallback } from '@/lib/hooks/use-debounce'
import { usePerformanceMonitor, useRerenderTracker } from '@/lib/performance-monitor'
import { ErrorBoundary } from 'react-error-boundary'

// Core imports
import modelsList from '@/lib/models.json'
import templates, { TemplateId } from '@/lib/templates'
import { fragmentSchema as schema, FragmentSchema } from '@/lib/schema'
import { ExecutionResult } from '@/lib/types'
import { DeepPartial } from 'ai'
import type { LLMModelConfig } from '@/lib/models'
import { Message, toAISDKMessages } from '@/lib/messages'

// New system imports
import { EnhancedVersionSystem, AppVersion, VersionTree } from '@/lib/storage/enhanced-version-system'
import { ConversationalModificationSystem, ConversationResponse } from '@/lib/conversational-modification-system'
import { ChangeManagementSystem, ChangeRecord } from '@/lib/change-management-system'
import { AppLibrary, SavedApp } from '@/lib/storage/app-library'

// Component imports
import { Chat } from '@/components/chat'
import { ChatInput } from '@/components/chat-input'
import { ChatPicker } from '@/components/chat-picker'
import { ChatSettings } from '@/components/chat-settings'
import { UnifiedPreview } from '@/components/unified-preview'
import { DualPanelLayout } from '@/components/dual-panel-layout'
import { ConversationalChatInterface } from '@/components/conversational-chat-interface'
import { DiffPreviewDialog } from '@/components/diff-preview-dialog'
import { NavBar } from '@/components/navbar'
import { VersionManager } from '@/components/version-manager'
import { VersionTimeline } from '@/components/version-timeline'

// UI imports
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { toast } from '@/components/ui/use-toast'
import { 
  Tooltip, 
  TooltipContent, 
  TooltipProvider, 
  TooltipTrigger 
} from '@/components/ui/tooltip'

// Icon imports
import { 
  Save, 
  Plus, 
  FolderOpen, 
  LayoutGrid, 
  Columns2, 
  Code, 
  Monitor,
  Settings,
  History,
  GitBranch,
  Zap,
  MessageSquare,
  Maximize2,
  Minimize2,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Clock,
  Users,
  FileText,
  Lightbulb
} from 'lucide-react'

// Actions
import { forkApp } from './actions/fork-app'

// Constants
const PREWARM_FRAGMENT: DeepPartial<FragmentSchema> = {
  template: 'nextjs-developer',
  code: 'export default () => <h1>Ready!</h1>',
  file_path: 'pages/index.tsx',
  port: 3000,
}

// Types
interface AppState {
  currentAppId: string | null
  appName: string
  selectedTemplate: 'auto' | TemplateId
  messages: Message[]
  fragment?: DeepPartial<FragmentSchema>
  result?: ExecutionResult
  isGenerating: boolean
  isPreviewLoading: boolean
  isAutoSaving: boolean
  streamingProgress?: StreamingProgress
}

interface StreamingProgress {
  stage: 'connecting' | 'thinking' | 'planning' | 'coding' | 'reviewing' | 'complete' | 'error'
  progress: number
  message: string
  estimatedTime?: number
  elapsedTime?: number
  canPause?: boolean
  isPaused?: boolean
  errors?: string[]
  warnings?: string[]
}

interface UIState {
  currentTab: 'code' | 'fragment' | 'chat' | 'versions' | 'changes'
  layout: 'tabs' | 'dual-panel' | 'conversational'
  leftPanelCollapsed: boolean
  rightPanelCollapsed: boolean
  isLibraryOpen: boolean
  isDiffDialogOpen: boolean
  isVersionTimelineOpen: boolean
  isSettingsOpen: boolean
  fullScreenMode: boolean
  enableSoundEffects: boolean
  showAdvancedFeatures: boolean
}

interface SystemState {
  versionSystem: EnhancedVersionSystem | null
  diffSystem: null // Diff system is now server-side only
  conversationalSystem: ConversationalModificationSystem | null
  changeManager: ChangeManagementSystem | null
  appLibrary: AppLibrary | null
  versions: AppVersion[]
  changes: ChangeRecord[]
  conversationResponse: ConversationResponse | null
}

// Error Fallback Component
function ErrorFallback({ error, resetErrorBoundary }: { error: Error; resetErrorBoundary: () => void }) {
  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <AlertCircle className="h-5 w-5" />
            Something went wrong
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {error.message || 'An unexpected error occurred'}
          </p>
          <div className="flex gap-2">
            <Button onClick={resetErrorBoundary} variant="outline">
              Try again
            </Button>
            <Button onClick={() => window.location.reload()}>
              Refresh page
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// Main App Component
const EnhancedApp = memo(function EnhancedApp() {
  // Performance monitoring
  const { trackNetworkRequest } = usePerformanceMonitor('EnhancedApp')
  useRerenderTracker('EnhancedApp', {})

  // Core state
  const [appState, setAppState] = useState<AppState>({
    currentAppId: null,
    appName: 'New App',
    selectedTemplate: 'auto',
    messages: [],
    fragment: undefined,
    result: undefined,
    isGenerating: false,
    isPreviewLoading: false,
    isAutoSaving: false,
    streamingProgress: undefined
  })

  // UI state
  const [uiState, setUIState] = useState<UIState>({
    currentTab: 'code',
    layout: 'dual-panel',
    leftPanelCollapsed: false,
    rightPanelCollapsed: false,
    isLibraryOpen: false,
    isDiffDialogOpen: false,
    isVersionTimelineOpen: false,
    isSettingsOpen: false,
    fullScreenMode: false,
    enableSoundEffects: false,
    showAdvancedFeatures: false
  })

  // System state
  const [systemState, setSystemState] = useState<SystemState>({
    versionSystem: null,
    diffSystem: null,
    conversationalSystem: null,
    changeManager: null,
    appLibrary: null,
    versions: [],
    changes: [],
    conversationResponse: null
  })

  // Persistent state
  const [languageModel, setLanguageModel] = useState<LLMModelConfig>({ model: 'anthropic/claude-sonnet-4' })
  const [isHydrated, setIsHydrated] = useState(false)

  // Load language model from localStorage after hydration
  useEffect(() => {
    const stored = localStorage.getItem('languageModel')
    if (stored) {
      try {
        const parsed = JSON.parse(stored)
        setLanguageModel(parsed)
      } catch (error) {
        console.error('Failed to parse stored language model:', error)
      }
    }
    setIsHydrated(true)
  }, [])

  // Save language model to localStorage when it changes (but only after hydration)
  useEffect(() => {
    if (isHydrated) {
      localStorage.setItem('languageModel', JSON.stringify(languageModel))
    }
  }, [languageModel, isHydrated])

  // Input state
  const [input, setInput] = useState('')
  const [files, setFiles] = useState<File[]>([])

  // URL state
  const [urlAppId, setUrlAppId] = useQueryState('app', parseAsString)
  const [forkShareId, setForkShareId] = useQueryState('fork', parseAsString)

  // Hooks
  const isMobile = useIsMobile()
  const isDesktop = useIsDesktop()
  const posthog = usePostHog()

  // Refs
  const messagesRef = useRef<Message[]>([])
  const systemsInitialized = useRef(false)

  // Initialize systems
  const initializeSystems = useCallback(async (appId: string) => {
    if (systemsInitialized.current) return

    // Prevent race conditions by setting initialized flag early
    systemsInitialized.current = true

    try {
      // Initialize systems with better error handling
      const versionSystem = new EnhancedVersionSystem(appId)
      const conversationalSystem = new ConversationalModificationSystem()
      const changeManager = new ChangeManagementSystem(appId)
      const appLibrary = new AppLibrary()

      // Verify systems are properly initialized
      if (!versionSystem) {
        throw new Error('Version system failed to initialize')
      }
      if (!conversationalSystem) {
        throw new Error('Conversational system failed to initialize')
      }
      if (!changeManager) {
        throw new Error('Change manager failed to initialize')
      }
      if (!appLibrary) {
        throw new Error('App library failed to initialize')
      }

      // Load existing versions if available
      let existingVersions: AppVersion[] = []
      try {
        existingVersions = versionSystem.getVersions()
      } catch (error) {
        console.warn('Failed to load existing versions:', error)
      }

      // Load existing changes if available
      let existingChanges: ChangeRecord[] = []
      try {
        existingChanges = changeManager.getRecentChanges()
      } catch (error) {
        console.warn('Failed to load existing changes:', error)
      }

      // Update system state atomically
      setSystemState(prev => ({
        ...prev,
        versionSystem,
        diffSystem: null, // Diff system is now server-side only
        conversationalSystem,
        changeManager,
        appLibrary,
        versions: existingVersions,
        changes: existingChanges
      }))

      if (process.env.NODE_ENV === 'development') {
        console.log('✅ Systems initialized successfully:', {
          appId,
          versionSystem: !!versionSystem,
          conversationalSystem: !!conversationalSystem,
          changeManager: !!changeManager,
          appLibrary: !!appLibrary,
          existingVersions: existingVersions.length,
          existingChanges: existingChanges.length
        })
      }

    } catch (error) {
      console.error('❌ Failed to initialize systems:', error)
      
      // Reset initialized flag on failure so we can retry
      systemsInitialized.current = false
      
      // Provide more specific error messages
      let errorMessage = 'System initialization failed'
      if (error instanceof Error) {
        if (error.message.includes('Version system')) {
          errorMessage = 'Version tracking system failed to initialize'
        } else if (error.message.includes('Conversational system')) {
          errorMessage = 'Chat system failed to initialize'
        } else if (error.message.includes('Change manager')) {
          errorMessage = 'Change management system failed to initialize'
        } else if (error.message.includes('App library')) {
          errorMessage = 'App library system failed to initialize'
        }
      }
      
      toast({
        title: 'System initialization failed',
        description: `${errorMessage}. Some features may not work properly. Please refresh the page.`,
        variant: 'destructive'
      })

      // Set partial state for graceful degradation
      setSystemState(prev => ({
        ...prev,
        versionSystem: null,
        diffSystem: null,
        conversationalSystem: null,
        changeManager: null,
        appLibrary: null,
        versions: [],
        changes: []
      }))
    }
  }, [])

  // Initialize systems when app ID changes
  useEffect(() => {
    if (appState.currentAppId) {
      initializeSystems(appState.currentAppId)
    }
  }, [appState.currentAppId, initializeSystems])

  // Sync messages ref
  useEffect(() => {
    messagesRef.current = appState.messages
  }, [appState.messages])

  // Update URL when app ID changes
  useEffect(() => {
    if (appState.currentAppId !== urlAppId) {
      setUrlAppId(appState.currentAppId)
    }
  }, [appState.currentAppId, urlAppId, setUrlAppId])

  // Handle fork parameter with debouncing
  const debouncedForkShareId = useDebounce(forkShareId, 500)

  // Memoized computations
  const filteredModels = useMemo(() => {
    return modelsList.models.filter((model: any) => {
      if (process.env.NEXT_PUBLIC_HIDE_LOCAL_MODELS) {
        return model.providerId !== 'ollama'
      }
      return true
    })
  }, [])

  const currentModel = useMemo(() => {
    return filteredModels.find(
      (model: any) => model.id === languageModel.model
    ) || filteredModels[0]
  }, [filteredModels, languageModel.model])

  const currentTemplate = useMemo(() => {
    return appState.selectedTemplate === 'auto' 
      ? templates 
      : { [appState.selectedTemplate]: templates[appState.selectedTemplate] }
  }, [appState.selectedTemplate])

  // Memoized message processing
  const processedMessages = useMemo(() => {
    return appState.messages
      .filter(msg => msg.role === 'user' || msg.role === 'assistant')
      .map(msg => ({
        ...msg,
        processedContent: msg.content.map(c => c.type === 'text' ? c.text : '').join('\n')
      }))
  }, [appState.messages])

  // Convert messages to AI SDK format
  const toAISDKMessages = useCallback((msgs: Message[]): any[] => {
    return msgs.map(msg => ({
      role: msg.role,
      content: msg.content.map(c => c.type === 'text' ? c.text : '').join('\n'),
      processedContent: msg.content.map(c => c.type === 'text' ? c.text : '').join('\n')
    }))
  }, [appState.messages])

  // Get sandbox
  const getSandbox = useCallback(async (
    sessionId: string, 
    fragment: DeepPartial<FragmentSchema>, 
    appId?: string
  ): Promise<ExecutionResult | null> => {
    try {
      console.log('🔄 Creating sandbox for:', { sessionId, appId, template: fragment.template })
      const response = await fetch('/api/sandbox', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fragment,
          sessionId,
          appId
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.details || errorData.error || `HTTP error! status: ${response.status}`)
      }

      const result = await response.json()
      console.log('✅ Sandbox created successfully:', result)
      return result
    } catch (error) {
      console.error('❌ Error getting sandbox:', error)
      
      // Enhance timeout error messages
      if (error instanceof Error) {
        if (error.message.includes('timeout') || error.message.includes('deadline_exceeded')) {
          throw new Error(
            `⏱️ Sandbox creation timed out.\n\n` +
            `This usually happens when:\n` +
            `• E2B service is experiencing high load\n` +
            `• Network connectivity is slow\n` +
            `• Template initialization is taking longer than usual\n\n` +
            `💡 Try again in a moment, or refresh the page if the issue persists.`
          )
        }
        
        if (error.message.includes('fetch')) {
          throw new Error(
            `🌐 Network error while creating sandbox.\n\n` +
            `Please check your internet connection and try again.`
          )
        }
      }
      
      throw error // Re-throw to handle in calling function
    }
  }, [])

  // AI SDK object for generating
  const { object, submit, isLoading, stop, error } = useObject({
    api: '/api/chat',
    schema,
    onError: (error) => {
      console.error('❌ useObject error:', error)
      setAppState(prev => ({ ...prev, isGenerating: false, streamingProgress: undefined }))
      toast({
        title: 'Generation Error',
        description: error.message || 'Failed to generate response',
        variant: 'destructive',
      })
    },
    onFinish: async ({ object: fragment, error }) => {
      console.log('✅ onFinish called:', { fragment: !!fragment, error: !!error })
      
      if (error) {
        console.error('❌ onFinish error:', error)
        setAppState(prev => ({ ...prev, isGenerating: false, streamingProgress: undefined }))
        toast({
          title: 'Generation Failed',
          description: error.message || 'An error occurred during generation',
          variant: 'destructive',
        })
        return
      }

      if (fragment) {
        console.log('📝 Finalizing assistant message with fragment')
        
        // Update the final assistant message
        setAppState(prev => {
          const messages = [...prev.messages]
          const lastMessage = messages[messages.length - 1]
          
          if (lastMessage && lastMessage.role === 'assistant') {
            // Update existing assistant message with final content
            messages[messages.length - 1] = {
              ...lastMessage,
              content: [
                { type: 'text', text: fragment.commentary || 'Generated application' },
                ...(fragment.code ? [{ type: 'code' as const, text: fragment.code }] : [])
              ],
              object: fragment
            }
            console.log('📝 Updated existing assistant message')
          } else {
            // Add new assistant message if none exists
            const assistantMessage: Message = {
              role: 'assistant',
              content: [
                { type: 'text', text: fragment.commentary || 'Generated application' },
                ...(fragment.code ? [{ type: 'code' as const, text: fragment.code }] : [])
              ],
              object: fragment
            }
            messages.push(assistantMessage)
            console.log('📝 Added new assistant message')
          }
          
          return { 
            ...prev, 
            messages, 
            isGenerating: false,
            streamingProgress: {
              stage: 'complete',
              progress: 100,
              message: 'Generation complete! Creating sandbox...',
              canPause: false,
              isPaused: false
            }
          }
        })
        
        // Handle generation completion with better error handling
        try {
          await handleGenerationComplete(fragment)
        } catch (completionError) {
          console.error('❌ Generation completion failed:', completionError)
          setAppState(prev => ({ 
            ...prev, 
            isGenerating: false, 
            isPreviewLoading: false,
            streamingProgress: undefined
          }))
          toast({
            title: 'Sandbox Creation Failed',
            description: completionError instanceof Error ? completionError.message : 'Failed to create preview',
            variant: 'destructive',
          })
        }
      } else {
        console.log('⚠️ No fragment received in onFinish')
        setAppState(prev => ({ 
          ...prev, 
          isGenerating: false,
          streamingProgress: undefined
        }))
      }
    },
  })

  // Sync isGenerating with isLoading from useObject and update streaming progress
  useEffect(() => {
    console.log('🔄 isLoading changed:', isLoading)
    setAppState(prev => ({ 
      ...prev, 
      isGenerating: isLoading,
      streamingProgress: isLoading ? {
        stage: 'connecting',
        progress: 0,
        message: 'Connecting to AI...',
        canPause: false,
        isPaused: false
      } : prev.streamingProgress // Keep existing progress if not loading
    }))
  }, [isLoading])

  // Handle streaming object updates and parse progress
  useEffect(() => {
    if (object && isLoading) {
      console.log('🔄 Streaming object update:', object)
      const content: Message['content'] = []
      
      if (object.commentary) {
        content.push({ type: 'text', text: object.commentary })
      }
      
      if (object.code) {
        content.push({ type: 'code', text: object.code })
      }
      
      if (content.length === 0) return
      
      // Enhanced streaming progress parsing
      const commentary = object.commentary || ''
      let streamingProgress: StreamingProgress | undefined
      
      // Parse different stages from commentary
      if (commentary.includes('Analyzing your request') || commentary.includes('Initializing')) {
        streamingProgress = {
          stage: 'thinking',
          progress: 15,
          message: commentary.includes('Analyzing') ? 'Analyzing your request...' : 'Initializing...',
          canPause: false,
          isPaused: false
        }
      } else if (commentary.includes('Selected') && commentary.includes('stack')) {
        streamingProgress = {
          stage: 'planning',
          progress: 30,
          message: commentary,
          canPause: false,
          isPaused: false
        }
      } else if (commentary.includes('Running') && commentary.includes('agents')) {
        const match = commentary.match(/Running (\d+) specialized agents/)
        const agentCount = match ? parseInt(match[1]) : 0
        streamingProgress = {
          stage: 'coding',
          progress: 50,
          message: `Running ${agentCount} specialized agents...`,
          canPause: true,
          isPaused: false
        }
      } else if (commentary.includes('Processing...')) {
        const match = commentary.match(/\((\d+)\/(\d+) agents complete\)/)
        if (match) {
          const completed = parseInt(match[1])
          const total = parseInt(match[2])
          const progress = 50 + (35 * completed / total)
          streamingProgress = {
            stage: 'coding',
            progress,
            message: `Processing... (${completed}/${total} agents complete)`,
            canPause: true,
            isPaused: false
          }
        }
      } else if (commentary.includes('Assembling final application')) {
        streamingProgress = {
          stage: 'reviewing',
          progress: 90,
          message: 'Assembling final application...',
          canPause: false,
          isPaused: false
        }
      } else if (commentary.includes('Generation complete') || commentary.includes('✨')) {
        streamingProgress = {
          stage: 'complete',
          progress: 100,
          message: commentary.includes('✨') ? commentary : 'Generation complete!',
          canPause: false,
          isPaused: false
        }
      } else if (commentary.includes('Generated using instant template')) {
        streamingProgress = {
          stage: 'complete',
          progress: 100,
          message: 'Generated using instant template',
          canPause: false,
          isPaused: false
        }
      } else if (object.code && !commentary.includes('Error')) {
        // We have code, show coding progress
        streamingProgress = {
          stage: 'coding',
          progress: 70,
          message: 'Writing code...',
          canPause: true,
          isPaused: false
        }
      } else if (commentary.includes('Error')) {
        streamingProgress = {
          stage: 'error',
          progress: 0,
          message: commentary,
          canPause: false,
          isPaused: false,
          errors: [commentary]
        }
      }
      
      // Update app state with streaming content and progress
      setAppState(prev => {
        const messages = [...prev.messages]
        const lastMessage = messages[messages.length - 1]
        
        if (!lastMessage || lastMessage.role === 'user') {
          // Add new assistant message for streaming
          const newMessage: Message = {
            role: 'assistant',
            content,
            object,
          }
          messages.push(newMessage)
          console.log('📝 Added streaming assistant message')
        } else if (lastMessage.role === 'assistant') {
          // Update existing assistant message with streaming content
          messages[messages.length - 1] = {
            ...lastMessage,
            content,
            object,
          }
          console.log('📝 Updated streaming assistant message')
        }
        
        return { ...prev, messages, streamingProgress }
      })
    }
  }, [object, isLoading])

  // Handle generation completion
  const handleGenerationComplete = useCallback(async (fragment: DeepPartial<FragmentSchema>) => {
    console.log('🎯 Starting generation completion for fragment:', fragment.template)
    setAppState(prev => ({ ...prev, isPreviewLoading: true }))
    
    try {
      posthog.capture('fragment_generated', {
        template: fragment?.template,
      })

      // Check if we should use browser preview
      const { shouldUseBrowserPreview, templateSupportsBrowserPreview } = await import('@/lib/feature-flags')
      
      // Get user ID for feature flag, fallback to 'demo' if no auth
      let userId = 'demo'
      try {
        const { supabase } = await import('@/lib/supabase')
        if (supabase) {
          const { data: { session } } = await supabase.auth.getSession()
          userId = session?.user?.id || 'demo'
        }
      } catch (error) {
        console.log('Auth not available, using demo mode')
      }
      
      let result: ExecutionResult | null = null
      
      if (shouldUseBrowserPreview(userId) && templateSupportsBrowserPreview(fragment.template || 'nextjs-developer')) {
        if (process.env.NODE_ENV === 'development') {
          console.log('🌐 Using browser preview for instant rendering')
        }
        
        // For browser preview, we don't create a result object
        // The FragmentPreview component will handle the browser preview directly
        result = null
        
        posthog.capture('browser_preview_used', { 
          template: fragment?.template,
          userId 
        })
      } else {
        if (process.env.NODE_ENV === 'development') {
          console.log('🚀 Using E2B sandbox for execution')
        }
        
        result = await getSandbox(
          appState.currentAppId || `session-${Date.now()}`, 
          fragment, 
          appState.currentAppId || undefined
        )

        if (result && 'url' in result) {
          posthog.capture('sandbox_created', { url: result.url })
        }
      }

      // Update logic to handle null result for browser preview
      if (process.env.NODE_ENV === 'development') {
        console.log('✅ Preview ready:', result ? 'E2B sandbox' : 'Browser preview')
      }

      // Update app state with results
      setAppState(prev => ({
        ...prev,
        fragment,
        result,
        isPreviewLoading: false,
        currentTab: 'fragment',
        streamingProgress: undefined // Clear streaming progress
      }))

      // Create version if system is available
      if (systemState.versionSystem) {
        try {
          const lastMessage = appState.messages[appState.messages.length - 1]
          const lastContent = lastMessage?.content[0]
          const messageText = lastContent?.type === 'text' ? lastContent.text : 'New version'
          const messageDescription = lastContent?.type === 'text' ? lastContent.text : undefined
          
          const version = systemState.versionSystem.createVersion(
            fragment,
            `Generated: ${messageText.substring(0, 50)}`,
            messageDescription,
            'user',
            ['generated', 'ai-assisted']
          )
          
          setSystemState(prev => ({
            ...prev,
            versions: [...prev.versions, version]
          }))
          console.log('📦 Created version:', version.metadata.message)
        } catch (versionError) {
          console.error('Failed to create version:', versionError)
        }
      }

      // Auto-save - only pass result if it exists
      if (result) {
        await handleAutoSave(fragment, result)
      } else {
        // For browser preview, create a minimal result for saving
        await handleAutoSave(fragment, {
          sbxId: `browser-${Date.now()}`,
          template: fragment.template || 'nextjs-developer'
        } as ExecutionResult)
      }
      
      console.log('🎉 Generation completion successful!')
    } catch (error) {
      console.error('❌ Generation completion error:', error)
      
      // Re-throw the error to be handled by onFinish
      throw error
    }
  }, [appState.currentAppId, appState.messages, systemState.versionSystem, posthog, getSandbox])

  // Auto-save handler with debouncing
  const handleAutoSave = useDebouncedCallback(async (
    fragment: DeepPartial<FragmentSchema>, 
    result: ExecutionResult
  ) => {
    if (!systemState.appLibrary) return

    setAppState(prev => ({ ...prev, isAutoSaving: true }))

    try {
      const savedApp = await trackNetworkRequest(
        'auto-save',
        '/api/save-app',
        'POST',
        async () => {
          const firstUserMessage = appState.messages.find(m => m.role === 'user')
          const firstUserContent = firstUserMessage?.content[0]
          const firstUserText = firstUserContent?.type === 'text' ? firstUserContent.text : 'App'
          const name = appState.appName || generateAppName(firstUserText)

          return systemState.appLibrary!.saveApp({
            id: appState.currentAppId || undefined,
            name,
            description: firstUserText || '',
            template: appState.selectedTemplate === 'auto' ? 'auto' : appState.selectedTemplate,
            code: fragment,
            messages: appState.messages
              .filter(msg => msg.role === 'user' || msg.role === 'assistant')
              .map(msg => ({
                id: crypto.randomUUID(),
                role: msg.role as 'user' | 'assistant',
                content: msg.content.map(c => c.type === 'text' ? c.text : '').join('\n'),
                createdAt: new Date().toISOString(),
              })),
            lastSandboxId: result.sbxId,
            sandboxConfig: result,
            fragmentVersions: systemState.versions.map(v => ({
              fragment: v.code,
              result: undefined, // We don't have execution result for each version
              timestamp: v.metadata.timestamp
            })),
            currentVersionIndex: systemState.versions.length - 1
          })
        },
        { ttl: 30000 } // Cache for 30 seconds
      )

      if (!appState.currentAppId) {
        setAppState(prev => ({ ...prev, currentAppId: savedApp.id }))
      }

      toast({
        title: 'App saved',
        description: `${savedApp.name} has been saved successfully.`,
      })
    } catch (error) {
      console.error('Auto-save error:', error)
      toast({
        title: 'Save failed',
        description: 'Could not save the app. Please try again.',
        variant: 'destructive'
      })
    } finally {
      setTimeout(() => setAppState(prev => ({ ...prev, isAutoSaving: false })), 1500)
    }
  }, 2000, { // Debounce for 2 seconds
    trailing: true,
    maxWait: 10000 // Max wait 10 seconds
  })

  // Generate app name from prompt
  const generateAppName = useCallback((prompt: string): string => {
    const words = prompt.toLowerCase().split(' ')
    const appKeywords = ['app', 'application', 'tool', 'calculator', 'generator', 'converter', 'manager', 'dashboard', 'tracker', 'game', 'quiz', 'form']
    const actionKeywords = ['create', 'build', 'make', 'generate', 'design', 'develop']
    
    const filteredWords = words.filter(word => 
      !actionKeywords.includes(word) && 
      !['a', 'an', 'the', 'with', 'that', 'for', 'to', 'of', 'in', 'on', 'at', 'by'].includes(word) &&
      word.length > 2
    )
    
    const appType = words.find(word => appKeywords.includes(word))
    
    if (filteredWords.length > 0) {
      const mainWords = filteredWords.slice(0, 3).map(word => 
        word.charAt(0).toUpperCase() + word.slice(1)
      ).join(' ')
      
      if (appType && !mainWords.toLowerCase().includes(appType)) {
        return `${mainWords} ${appType.charAt(0).toUpperCase() + appType.slice(1)}`
      }
      return mainWords
    }
    
    return `App ${new Date().toLocaleDateString()}`
  }, [])

  // Handle fork app
  const handleForkApp = useCallback(async (shareId: string) => {
    try {
      const result = await forkApp(shareId)
      
      if (!result.success || !result.appData) {
        toast({
          title: 'Failed to fork app',
          description: result.error || 'Unknown error occurred',
          variant: 'destructive'
        })
        setForkShareId(null)
        return
      }
      
      const { appData } = result
      setAppState(prev => ({
        ...prev,
        appName: appData.name,
        selectedTemplate: appData.template as 'auto' | TemplateId,
        fragment: appData.code,
        messages: [{
          role: 'user',
          content: [{ 
            type: 'text', 
            text: appData.description || `Forked from shared app: ${shareId}` 
          }]
        }]
      }))
      
      setForkShareId(null)
      
      toast({
        title: 'App forked successfully',
        description: 'You can now edit and save your own version.',
      })
      
      // Create sandbox if there's code
      if (appData.code) {
        setAppState(prev => ({ ...prev, isPreviewLoading: true }))
        try {
          // Check if we should use browser preview
          const { shouldUseBrowserPreview, templateSupportsBrowserPreview } = await import('@/lib/feature-flags')
          
          // Get user ID for feature flag, fallback to 'demo' if no auth
          let userId = 'demo'
          try {
            const { supabase } = await import('@/lib/supabase')
            if (supabase) {
              const { data: { session } } = await supabase.auth.getSession()
              userId = session?.user?.id || 'demo'
            }
          } catch (error) {
            console.log('Auth not available, using demo mode for fork')
          }
          
          let sandboxResult: ExecutionResult | null = null
          
          if (shouldUseBrowserPreview(userId) && templateSupportsBrowserPreview(appData.template || 'nextjs-developer')) {
            console.log('🌐 Using browser preview for forked app')
            
            // For browser preview, don't create a result
            sandboxResult = null
          } else {
            console.log('🚀 Using E2B sandbox for forked app')
            
            const response = await fetch('/api/sandbox', {
              method: 'POST',
              body: JSON.stringify({
                fragment: appData.code,
                sessionId: appData.id,
              }),
            })
            
            sandboxResult = await response.json()
          }
          
          setAppState(prev => ({
            ...prev,
            result: sandboxResult,
            currentTab: 'fragment',
            isPreviewLoading: false
          }))
        } catch (error) {
          console.error('Error creating preview for forked app:', error)
          setAppState(prev => ({ ...prev, isPreviewLoading: false }))
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

  // Handle fork parameter with useEffect after handleForkApp is defined
  useEffect(() => {
    if (debouncedForkShareId && appState.messages.length === 0) {
      handleForkApp(debouncedForkShareId)
    }
  }, [debouncedForkShareId, appState.messages.length, handleForkApp])

  // Handle input change
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value)
  }, [])

  // Handle streaming pause
  const handleStreamingPause = useCallback(() => {
    setAppState(prev => ({
      ...prev,
      streamingProgress: prev.streamingProgress ? {
        ...prev.streamingProgress,
        isPaused: !prev.streamingProgress.isPaused,
        message: prev.streamingProgress.isPaused ? 'Resuming generation...' : 'Paused generation'
      } : undefined
    }))
  }, [])

  // Handle streaming cancel
  const handleStreamingCancel = useCallback(() => {
    console.log('🛑 Cancelling generation')
    stop()
    setAppState(prev => ({
      ...prev,
      isGenerating: false,
      streamingProgress: undefined
    }))
    toast({
      title: 'Generation cancelled',
      description: 'The generation has been stopped.',
    })
  }, [stop])

  // Handle submit
  const handleSubmit = useCallback(async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    
    if (!input.trim()) {
      console.log('❌ Empty input, not submitting')
      return
    }

    console.log('🚀 Submitting message:', input)

    // Initialize app if needed
    if (!appState.currentAppId) {
      const newAppId = `app-${Date.now()}`
      console.log('🆔 Creating new app ID:', newAppId)
      setAppState(prev => ({ ...prev, currentAppId: newAppId }))
      await initializeSystems(newAppId)
    }

    const newMessage: Message = {
      role: 'user',
      content: [{ type: 'text', text: input }]
    }

    // Create updated messages array
    const updatedMessages = [...appState.messages, newMessage]
    console.log('📝 Messages before submit:', updatedMessages.length)
    
    // Clear input immediately for better UX
    const inputValue = input
    setInput('')

    // Add message to state and set generating state
    setAppState(prev => ({
      ...prev,
      messages: updatedMessages,
      isGenerating: true,
      streamingProgress: {
        stage: 'connecting',
        progress: 0,
        message: 'Connecting to AI...',
        canPause: false,
        isPaused: false
      }
    }))

    console.log('🔄 Calling submit with', updatedMessages.length, 'messages')
    
    try {
      await submit({
        messages: toAISDKMessages(updatedMessages),
        userID: 'user',
        template: appState.selectedTemplate,
        model: currentModel,
        config: languageModel,
      })
      console.log('✅ Submit call completed successfully')
    } catch (error) {
      console.error('❌ Submit error:', error)
      setAppState(prev => ({ 
        ...prev, 
        isGenerating: false,
        streamingProgress: undefined
      }))
      
      // Restore input on error
      setInput(inputValue)
      
      toast({
        title: 'Submit Error',
        description: error instanceof Error ? error.message : 'Failed to submit message',
        variant: 'destructive',
      })
    }
  }, [input, appState, languageModel, currentModel, submit, initializeSystems])

  // Handle diff update
  const handleDiffUpdate = useCallback(async (prompt: string) => {
    if (!appState.fragment) {
      toast({
        title: 'Diff update unavailable',
        description: 'Please generate some code first.',
        variant: 'destructive'
      })
      return
    }

    try {
      // Set generating state and show initial progress
      setAppState(prev => ({
        ...prev,
        isGenerating: true,
        streamingProgress: {
          stage: 'connecting',
          progress: 0,
          message: 'Starting incremental update...',
          canPause: false,
          isPaused: false
        }
      }))

      // Call the server-side diff API
      const response = await fetch('/api/diff', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          appId: appState.currentAppId || 'session',
          userPrompt: prompt,
          currentCode: typeof appState.fragment === 'string' ? appState.fragment : JSON.stringify(appState.fragment, null, 2),
          author: 'user',
          title: `Update: ${prompt.substring(0, 50)}...`,
          description: prompt,
          changeType: 'feature',
          priority: 'medium'
        })
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error('Diff API error response:', errorText)
        throw new Error(`Diff API failed: ${response.status} - ${errorText.substring(0, 100)}`)
      }

      let result
      try {
        const responseText = await response.text()
        result = JSON.parse(responseText)
      } catch (parseError) {
        console.error('Failed to parse diff API response:', parseError)
        throw new Error('Invalid response from diff API - not valid JSON')
      }

      // Update progress during processing
      setAppState(prev => ({
        ...prev,
        streamingProgress: {
          stage: 'reviewing',
          progress: 90,
          message: 'Processing diff results...',
          canPause: false,
          isPaused: false
        }
      }))

      if (result.success && result.previewCode) {
        // Parse the preview code
        let parsedCode: DeepPartial<FragmentSchema> | undefined = result.previewCode as any
        if (typeof result.previewCode === 'string') {
          try {
            parsedCode = JSON.parse(result.previewCode) as DeepPartial<FragmentSchema>
          } catch (error) {
            console.error('Failed to parse previewCode as JSON:', error)
            parsedCode = result.previewCode as any
          }
        }
        
        // Update the fragment
        setAppState(prev => ({
          ...prev,
          fragment: parsedCode,
          isPreviewLoading: true,
          streamingProgress: {
            stage: 'reviewing',
            progress: 95,
            message: 'Updating preview...',
            canPause: false,
            isPaused: false
          }
        }))

        // Handle version creation (server-side already created it, we just need to sync)
        if (result.versionId) {
          if (systemState.versionSystem) {
            try {
              // Try to sync with server-side version
              const serverVersion = systemState.versionSystem.getVersion(result.versionId)
              if (serverVersion) {
                // Update local versions list if the version exists
                setSystemState(prev => ({
                  ...prev,
                  versions: prev.versions.some(v => v.id === result.versionId) 
                    ? prev.versions 
                    : [...prev.versions, serverVersion]
                }))
              } else {
                // Version doesn't exist locally, but server created it
                // Just track the version ID for now
                if (process.env.NODE_ENV === 'development') {
                  console.log('📦 Server created version, but not available locally:', result.versionId)
                }
              }
              
              if (process.env.NODE_ENV === 'development') {
                console.log('📦 Version tracked for diff update:', result.versionId)
              }
            } catch (versionError) {
              console.error('Failed to sync version for diff update:', versionError)
              // Don't fail the entire diff update if version sync fails
              if (process.env.NODE_ENV === 'development') {
                console.log('⚠️ Version sync failed, but continuing with diff update')
              }
            }
          } else {
            // Version system not initialized, but server created a version
            if (process.env.NODE_ENV === 'development') {
              console.log('📦 Server created version but client version system not initialized:', result.versionId)
            }
          }
        }

        // Update sandbox/preview
        try {
          // Check if we should use browser preview
          const { shouldUseBrowserPreview, templateSupportsBrowserPreview } = await import('@/lib/feature-flags')
          
          // Get user ID for feature flag, fallback to 'demo' if no auth
          let userId = 'demo'
          try {
            const { supabase } = await import('@/lib/supabase')
            if (supabase) {
              const { data: { session } } = await supabase.auth.getSession()
              userId = session?.user?.id || 'demo'
            }
          } catch (error) {
            console.log('Auth not available, using demo mode for diff update')
          }
          
          let newResult: ExecutionResult | null = null
          
          if (shouldUseBrowserPreview(userId) && templateSupportsBrowserPreview(parsedCode?.template || 'nextjs-developer')) {
            if (process.env.NODE_ENV === 'development') {
              console.log('🌐 Using browser preview for diff update')
            }
            // For browser preview, don't create a result
            newResult = null
          } else {
            if (process.env.NODE_ENV === 'development') {
              console.log('🚀 Using E2B sandbox for diff update')
            }
            
            newResult = await getSandbox(
              appState.currentAppId || `session-${Date.now()}`,
              parsedCode,
              appState.currentAppId || undefined
            )
          }

          // Final state update
          setAppState(prev => ({
            ...prev,
            result: newResult,
            isGenerating: false,
            isPreviewLoading: false,
            streamingProgress: undefined
          }))

          // Auto-save after successful diff update
          if (newResult) {
            await handleAutoSave(parsedCode, newResult)
          } else {
            // For browser preview, create a minimal result for saving
            await handleAutoSave(parsedCode, {
              sbxId: `browser-diff-${Date.now()}`,
              template: parsedCode.template || 'nextjs-developer'
            } as ExecutionResult)
          }
          
        } catch (previewError) {
          console.error('Failed to update preview after diff:', previewError)
          setAppState(prev => ({
            ...prev,
            isGenerating: false,
            isPreviewLoading: false,
            streamingProgress: undefined
          }))
          
          // Still show success since the code was updated
          toast({
            title: 'Update applied',
            description: 'Changes applied successfully, but preview update failed. The code has been updated.',
          })
          return
        }
        
        toast({
          title: 'Incremental update successful!',
          description: `Applied changes: ${result.diffResult?.changes.length || 0} modifications${result.versionId ? ` (Version: ${result.versionId.substring(0, 8)}...)` : ''}`,
        })
        
      } else {
        throw new Error(result.errors?.join(', ') || 'Diff update failed')
      }
    } catch (error) {
      console.error('Diff update error:', error)
      setAppState(prev => ({
        ...prev,
        isGenerating: false,
        isPreviewLoading: false,
        streamingProgress: undefined
      }))
      
      toast({
        title: 'Incremental update failed',
        description: error instanceof Error ? error.message : 'Unknown error occurred',
        variant: 'destructive'
      })
    }
  }, [systemState.versionSystem, appState.fragment, appState.currentAppId, getSandbox, handleAutoSave])

  // Handle conversational modification
  const handleConversationalModification = useCallback(async (message: string) => {
    if (!systemState.conversationalSystem || !appState.fragment) return

    try {
      const response = await systemState.conversationalSystem.processConversation(
        appState.currentAppId || 'session',
        message,
        JSON.stringify(appState.fragment),
        {
          userId: 'user',
          enableSuggestions: true,
          requireConfirmation: true
        }
      )

      setSystemState(prev => ({
        ...prev,
        conversationResponse: response
      }))
    } catch (error) {
      console.error('Conversational modification error:', error)
    }
  }, [systemState.conversationalSystem, appState.fragment, appState.currentAppId])

  // Handle diff update from chat input
  const handleChatDiffUpdate = useCallback(() => {
    if (!input.trim()) {
      toast({
        title: 'No changes specified',
        description: 'Please describe what changes you want to make.',
        variant: 'destructive'
      })
      return
    }

    if (!appState.fragment) {
      toast({
        title: 'No code to modify',
        description: 'Please generate some code first before making incremental changes.',
        variant: 'destructive'
      })
      return
    }

    // Show info toast about diff system
    toast({
      title: '⚡ Using incremental updates',
      description: 'Applying changes without regenerating the entire app...',
    })

    // Use the diff system to apply incremental changes
    handleDiffUpdate(input.trim())
    setInput('') // Clear input after applying diff
  }, [input, appState.fragment, handleDiffUpdate])

  // UI event handlers
  const handleTabChange = useCallback((tab: string) => {
    setUIState(prev => ({ ...prev, currentTab: tab as UIState['currentTab'] }))
  }, [])

  const handleLayoutChange = useCallback((layout: UIState['layout']) => {
    setUIState(prev => ({ ...prev, layout }))
  }, [])

  const handlePanelToggle = useCallback((panel: 'left' | 'right', collapsed: boolean) => {
    if (panel === 'left') {
      setUIState(prev => ({ ...prev, leftPanelCollapsed: collapsed }))
    } else {
      setUIState(prev => ({ ...prev, rightPanelCollapsed: collapsed }))
    }
  }, [])

  const handleFullScreenToggle = useCallback(() => {
    setUIState(prev => ({ ...prev, fullScreenMode: !prev.fullScreenMode }))
  }, [])

  const handleSoundToggle = useCallback(() => {
    setUIState(prev => ({ ...prev, enableSoundEffects: !prev.enableSoundEffects }))
  }, [])

  // Render main content based on layout
  const renderMainContent = useCallback(() => {
    if (uiState.layout === 'conversational') {
      return (
        <ConversationalChatInterface
          messages={appState.messages}
          currentCode={appState.fragment ? JSON.stringify(appState.fragment) : ''}
          sessionId={appState.currentAppId || 'session'}
          isLoading={appState.isGenerating}
          onSendMessage={handleConversationalModification}
          onApplyModification={async (actionIds) => {
            // Handle modification application
            console.log('Applying modifications:', actionIds)
          }}
          onCodeChange={(code) => {
            try {
              const parsedCode = JSON.parse(code)
              setAppState(prev => ({ ...prev, fragment: parsedCode }))
            } catch (error) {
              console.error('Invalid code format:', error)
            }
          }}
          className="h-full"
        />
      )
    }

    if (uiState.layout === 'tabs') {
      return (
        <Tabs value={uiState.currentTab} onValueChange={handleTabChange} className="h-full flex flex-col">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="code">Code</TabsTrigger>
            <TabsTrigger value="fragment">Preview</TabsTrigger>
            <TabsTrigger value="chat">Chat</TabsTrigger>
            <TabsTrigger value="versions">Versions</TabsTrigger>
            <TabsTrigger value="changes">Changes</TabsTrigger>
          </TabsList>
          
          <TabsContent value="code" className="flex-1 overflow-hidden">
            <UnifiedPreview
              fragment={appState.fragment}
              result={appState.result}
              isLoading={appState.isGenerating}
              isGenerating={appState.isGenerating}
              isPreviewLoading={appState.isPreviewLoading}
              isAutoSaving={appState.isAutoSaving}
              streamingProgress={appState.streamingProgress}
              onStreamingPause={handleStreamingPause}
              onStreamingCancel={handleStreamingCancel}
              currentAppId={appState.currentAppId}
              appName={appState.appName}
              template={appState.selectedTemplate}
              messages={appState.messages}
              selectedTab="code"
              onSelectedTabChange={(tab) => handleTabChange(typeof tab === 'string' ? tab : 'code')}
              onAppNameChange={(name) => setAppState(prev => ({ ...prev, appName: name }))}
              showTabs={false}
              fullScreenMode={uiState.fullScreenMode}
              onFullScreenToggle={handleFullScreenToggle}
              enableSoundEffects={uiState.enableSoundEffects}
              onSoundToggle={handleSoundToggle}
            />
          </TabsContent>
          
          <TabsContent value="fragment" className="flex-1 overflow-hidden">
            <UnifiedPreview
              fragment={appState.fragment}
              result={appState.result}
              isLoading={appState.isGenerating}
              isGenerating={appState.isGenerating}
              isPreviewLoading={appState.isPreviewLoading}
              isAutoSaving={appState.isAutoSaving}
              streamingProgress={appState.streamingProgress}
              onStreamingPause={handleStreamingPause}
              onStreamingCancel={handleStreamingCancel}
              currentAppId={appState.currentAppId}
              appName={appState.appName}
              template={appState.selectedTemplate}
              messages={appState.messages}
              selectedTab="fragment"
              onSelectedTabChange={(tab) => handleTabChange(typeof tab === 'string' ? tab : 'fragment')}
              onAppNameChange={(name) => setAppState(prev => ({ ...prev, appName: name }))}
              showTabs={false}
              fullScreenMode={uiState.fullScreenMode}
              onFullScreenToggle={handleFullScreenToggle}
              enableSoundEffects={uiState.enableSoundEffects}
              onSoundToggle={handleSoundToggle}
            />
          </TabsContent>
          
          <TabsContent value="chat" className="flex-1 overflow-hidden flex flex-col">
            <div className="flex-1 overflow-auto px-4">
              <Chat
                messages={appState.messages}
                isLoading={appState.isGenerating}
                streamingProgress={appState.streamingProgress}
                setCurrentPreview={({ fragment, result }) => {
                  setAppState(prev => ({
                    ...prev,
                    fragment,
                    result
                  }))
                }}
                onEditMessage={(index, newContent) => {
                  const updatedMessages = [...appState.messages]
                  if (updatedMessages[index]?.content[0]?.type === 'text') {
                    updatedMessages[index].content[0] = { type: 'text', text: newContent }
                    setAppState(prev => ({ ...prev, messages: updatedMessages }))
                  }
                }}
              />
            </div>
            <div className="border-t p-4">
                          <ChatInput
              retry={() => {
                // Retry the last user message
                const lastUserMessage = appState.messages.filter(m => m.role === 'user').pop()
                if (lastUserMessage) {
                  const userText = lastUserMessage.content.find(c => c.type === 'text')?.text || ''
                  setInput(userText)
                  setAppState(prev => ({ ...prev, isGenerating: false, streamingProgress: undefined }))
                }
              }}
              isErrored={Boolean(error)}
              errorMessage={error?.message || ''}
              isLoading={appState.isGenerating}
              isRateLimited={false}
              stop={handleStreamingCancel}
              input={input}
              handleInputChange={handleInputChange}
              handleSubmit={handleSubmit}
              isMultiModal={currentModel?.multiModal || false}
              files={files}
              handleFileChange={setFiles}
              onDiffUpdate={handleChatDiffUpdate}
            >
                <ChatPicker
                  templates={templates}
                  selectedTemplate={appState.selectedTemplate}
                  onSelectedTemplateChange={(template) => 
                    setAppState(prev => ({ ...prev, selectedTemplate: template }))
                  }
                  models={filteredModels}
                  languageModel={languageModel}
                  onLanguageModelChange={setLanguageModel}
                />
              </ChatInput>
            </div>
          </TabsContent>
          
          <TabsContent value="versions" className="flex-1 overflow-hidden">
            {systemState.versionSystem && (
              <VersionManager
                appId={appState.currentAppId || 'session'}
                currentCode={appState.fragment}
                onVersionSelect={async (version) => {
                  setAppState(prev => ({
                    ...prev,
                    fragment: version.code,
                    isPreviewLoading: true
                  }))
                  
                  // Get sandbox for the version
                  const result = await getSandbox(
                    appState.currentAppId || 'session',
                    version.code,
                    appState.currentAppId || undefined
                  )
                  
                  if (result) {
                    setAppState(prev => ({
                      ...prev,
                      result,
                      isPreviewLoading: false
                    }))
                  }
                }}
                onVersionCreate={(version) => {
                  setSystemState(prev => ({
                    ...prev,
                    versions: [...prev.versions, version]
                  }))
                }}
                className="h-full"
              />
            )}
          </TabsContent>
          
          <TabsContent value="changes" className="flex-1 overflow-hidden">
            {systemState.changeManager && (
              <div className="p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold">Change Management</h3>
                  <Badge variant="outline">
                    {systemState.changes.length} changes
                  </Badge>
                </div>
                
                <div className="space-y-2">
                  {systemState.changes.map((change) => (
                    <Card key={change.id}>
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between">
                          <div>
                            <h4 className="font-medium">{change.title}</h4>
                            <p className="text-sm text-muted-foreground">
                              {change.description}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant={
                              change.status === 'approved' ? 'default' :
                              change.status === 'rejected' ? 'destructive' :
                              'secondary'
                            }>
                              {change.status}
                            </Badge>
                            <Badge variant="outline">
                              {change.priority}
                            </Badge>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>
      )
    }

    // Dual panel layout
    const leftPanel = (
      <div className="h-full flex flex-col">
        <div className="flex-1 overflow-auto">
          <Chat
            messages={appState.messages}
            isLoading={appState.isGenerating}
            streamingProgress={appState.streamingProgress}
            setCurrentPreview={({ fragment, result }) => {
              setAppState(prev => ({
                ...prev,
                fragment,
                result
              }))
            }}
            onEditMessage={(index, newContent) => {
              const updatedMessages = [...appState.messages]
              if (updatedMessages[index]?.content[0]?.type === 'text') {
                updatedMessages[index].content[0] = { type: 'text', text: newContent }
                setAppState(prev => ({ ...prev, messages: updatedMessages }))
              }
            }}
          />
        </div>
        <div className="border-t p-4">
                      <ChatInput
              retry={() => {
                // Retry the last user message
                const lastUserMessage = appState.messages.filter(m => m.role === 'user').pop()
                if (lastUserMessage) {
                  const userText = lastUserMessage.content.find(c => c.type === 'text')?.text || ''
                  setInput(userText)
                  setAppState(prev => ({ ...prev, isGenerating: false, streamingProgress: undefined }))
                }
              }}
              isErrored={Boolean(error)}
              errorMessage={error?.message || ''}
              isLoading={appState.isGenerating}
              isRateLimited={false}
              stop={handleStreamingCancel}
              input={input}
              handleInputChange={handleInputChange}
              handleSubmit={handleSubmit}
              isMultiModal={currentModel?.multiModal || false}
              files={files}
              handleFileChange={setFiles}
              onDiffUpdate={handleChatDiffUpdate}
            >
            <ChatPicker
              templates={templates}
              selectedTemplate={appState.selectedTemplate}
              onSelectedTemplateChange={(template) => 
                setAppState(prev => ({ ...prev, selectedTemplate: template }))
              }
              models={filteredModels}
              languageModel={languageModel}
              onLanguageModelChange={setLanguageModel}
            />
          </ChatInput>
        </div>
      </div>
    )

    const rightPanel = (
              <UnifiedPreview
          fragment={appState.fragment}
          result={appState.result}
          isLoading={appState.isGenerating}
          isGenerating={appState.isGenerating}
          isPreviewLoading={appState.isPreviewLoading}
          isAutoSaving={appState.isAutoSaving}
          streamingProgress={appState.streamingProgress}
          onStreamingPause={handleStreamingPause}
          onStreamingCancel={handleStreamingCancel}
          currentAppId={appState.currentAppId}
          appName={appState.appName}
          template={appState.selectedTemplate}
          messages={appState.messages}
          selectedTab={uiState.currentTab === 'code' || uiState.currentTab === 'fragment' ? uiState.currentTab : 'fragment'}
          onSelectedTabChange={(tab) => handleTabChange(typeof tab === 'string' ? tab : uiState.currentTab)}
          onAppNameChange={(name) => setAppState(prev => ({ ...prev, appName: name }))}
          showTabs={true}
          fullScreenMode={uiState.fullScreenMode}
          onFullScreenToggle={handleFullScreenToggle}
          enableSoundEffects={uiState.enableSoundEffects}
          onSoundToggle={handleSoundToggle}
        />
    )

    return (
      <DualPanelLayout
        leftPanel={leftPanel}
        rightPanel={rightPanel}
        leftPanelTitle="Chat"
        rightPanelTitle="Preview"
        leftPanelIcon={<MessageSquare className="h-4 w-4" />}
        rightPanelIcon={<Monitor className="h-4 w-4" />}
        leftPanelCollapsed={uiState.leftPanelCollapsed}
        rightPanelCollapsed={uiState.rightPanelCollapsed}
        onLeftPanelToggle={(collapsed) => handlePanelToggle('left', collapsed)}
        onRightPanelToggle={(collapsed) => handlePanelToggle('right', collapsed)}
        showPanelControls={true}
        isMobile={isMobile}
        className="h-full"
      />
    )
  }, [
    uiState.layout,
    uiState.currentTab,
    uiState.leftPanelCollapsed,
    uiState.rightPanelCollapsed,
    uiState.fullScreenMode,
    uiState.enableSoundEffects,
    appState,
    systemState,
    languageModel,
    currentModel,
    templates,
    filteredModels,
    input,
    files,
    error,
    handleInputChange,
    handleSubmit,
    handleStreamingCancel,
    handleStreamingPause,
    handleConversationalModification,
    handleTabChange,
    handlePanelToggle,
    handleFullScreenToggle,
    handleSoundToggle,
    getSandbox,
    isMobile,
    setFiles,
    handleChatDiffUpdate
  ])

  // Render layout controls
  const renderLayoutControls = useCallback(() => (
    <div className="flex items-center gap-2 border-l pl-4">
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={uiState.layout === 'tabs' ? 'default' : 'outline'}
              size="sm"
              onClick={() => handleLayoutChange('tabs')}
              className="h-8"
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Tab Layout</TooltipContent>
        </Tooltip>
      </TooltipProvider>
      
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={uiState.layout === 'dual-panel' ? 'default' : 'outline'}
              size="sm"
              onClick={() => handleLayoutChange('dual-panel')}
              className="h-8"
            >
              <Columns2 className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Dual Panel</TooltipContent>
        </Tooltip>
      </TooltipProvider>
      
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={uiState.layout === 'conversational' ? 'default' : 'outline'}
              size="sm"
              onClick={() => handleLayoutChange('conversational')}
              className="h-8"
            >
              <MessageSquare className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Conversational</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  ), [uiState.layout, handleLayoutChange])

  // Main render
  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Navigation */}
      <NavBar
        session={null} // TODO: Implement auth session
        showLogin={() => {}} // TODO: Implement login
        signOut={() => {}} // TODO: Implement sign out
        onClear={() => {
          setAppState(prev => ({ ...prev, messages: [] }))
        }}
        canClear={appState.messages.length > 0}
        onSocialClick={(target) => {
          const urls = {
            github: 'https://github.com/your-repo',
            x: 'https://x.com/your-handle',
            discord: 'https://discord.gg/your-invite'
          }
          window.open(urls[target], '_blank')
        }}
        onUndo={() => {
          // TODO: Implement undo functionality
        }}
        canUndo={false} // TODO: Implement undo state
        onNewChat={() => {
          setAppState(prev => ({
            ...prev,
            messages: [],
            fragment: undefined,
            result: undefined,
            currentAppId: null,
            appName: ''
          }))
        }}
        onRedo={() => {
          // TODO: Implement redo functionality
        }}
        canRedo={false} // TODO: Implement redo state
      />

      {/* Main content */}
      <div className="flex-1 overflow-hidden">
        {renderMainContent()}
      </div>

      {/* Dialogs */}
      <DiffPreviewDialog
        isOpen={uiState.isDiffDialogOpen}
        onOpenChange={(open) => setUIState(prev => ({ ...prev, isDiffDialogOpen: open }))}
        appId={appState.currentAppId || 'session'}
        currentCode={appState.fragment}
        userPrompt=""
        onApply={(result) => {
          // Handle DiffUpdateResult object
          console.log('Diff update result:', result)
          // TODO: Apply the diff result to the code
        }}
        onCancel={() => setUIState(prev => ({ ...prev, isDiffDialogOpen: false }))}
        className="max-w-4xl"
      />

      {/* Version Timeline - TODO: Implement with proper dialog wrapper */}
      {/* 
      {systemState.versionSystem && (
        <Dialog 
          open={uiState.isVersionTimelineOpen} 
          onOpenChange={(open) => setUIState(prev => ({ ...prev, isVersionTimelineOpen: open }))}
        >
          <DialogContent className="max-w-4xl">
            <DialogHeader>
              <DialogTitle>Version Timeline</DialogTitle>
            </DialogHeader>
            <VersionTimeline
              versionTree={systemState.versionSystem.getVersionTree()}
              selectedVersion={systemState.versions[systemState.versions.length - 1]?.id}
              onVersionSelect={async (versionId) => {
                const version = systemState.versionSystem?.getVersion(versionId)
                if (version) {
                  setAppState(prev => ({
                    ...prev,
                    fragment: version.code,
                    isPreviewLoading: true
                  }))
                  
                  const result = await getSandbox(
                    appState.currentAppId || 'session',
                    version.code,
                    appState.currentAppId || undefined
                  )
                  
                  if (result) {
                    setAppState(prev => ({
                      ...prev,
                      result,
                      isPreviewLoading: false
                    }))
                  }
                }
              }}
              className="max-w-3xl"
            />
          </DialogContent>
        </Dialog>
      )}
      */}
    </div>
  )
})

// Main export with error boundary
export default function MainPage() {
  return (
    <ErrorBoundary
      FallbackComponent={ErrorFallback}
      onError={(error, errorInfo) => {
        console.error('App error:', error, errorInfo)
      }}
    >
      <Suspense fallback={
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center space-y-4">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-muted-foreground">Loading Fragg...</p>
          </div>
        </div>
      }>
        <EnhancedApp />
      </Suspense>
    </ErrorBoundary>
  )
} 