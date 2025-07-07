'use client'

import { ViewType } from '@/components/auth'
import { AuthDialog } from '@/components/auth-dialog'
import { ChatSession } from '@/components/chat-session'
// import { ChatSidebar } from '@/components/chat/chat-sidebar' // Removed
import { NavBar } from '@/components/navbar'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/lib/auth'
import { Message } from '@/lib/messages'
import { LLMModelConfig } from '@/lib/models'
import modelsList from '@/lib/models.json'
import { LocalSessionManager } from '@/lib/storage/local-sessions'
import { supabase } from '@/lib/supabase'
import { TemplateId } from '@/lib/templates'
import { usePostHog } from 'posthog-js/react'
import { useEffect, useState, useRef, useCallback } from 'react'
import { useLocalStorage } from 'usehooks-ts'
import { ChevronLeft } from 'lucide-react'
import { useChatSessions } from '@/lib/hooks/use-chat-sessions'
import { singleActiveSandboxManager } from '@/archive/sandbox/single-active-manager'

export default function Home() {
  const [chatInput, setChatInput] = useLocalStorage('chat', '')
  const [files, setFiles] = useState<File[]>([])
  const [selectedTemplate, setSelectedTemplate] = useState<'auto' | TemplateId>(
    'auto',
  )
  const [languageModel, setLanguageModel] = useLocalStorage<LLMModelConfig>(
    'languageModel',
    {
      model: 'anthropic/claude-sonnet-4',
    },
  )

  const posthog = usePostHog()

  // Session management
  const sessionManager = useRef(new LocalSessionManager())
  const { sessions, activeId, createSession, setActive, refresh } = useChatSessions()
  const [showSidebar, setShowSidebar] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [sessionGeneratingStates, setSessionGeneratingStates] = useState<Record<string, boolean>>({})
  const [sessionData, setSessionData] = useState<Record<string, any>>({})

  const [isAuthDialogOpen, setAuthDialog] = useState(false)
  const [authView, setAuthView] = useState<ViewType>('sign_in')
  const { session, userTeam } = useAuth(setAuthDialog, setAuthView)

  const filteredModels = modelsList.models.filter((model) => {
    if (process.env.NEXT_PUBLIC_HIDE_LOCAL_MODELS) {
      return model.providerId !== 'ollama'
    }
    return true
  })

  const handleMessagesChange = useCallback((messages: Message[]) => {
    if (activeId) {
      setSessionData(prev => ({
        ...prev,
        [activeId]: { ...prev[activeId], messages }
      }));
    }
  }, [activeId]);

  const handleNewMessage = useCallback((message: Message) => {
    if (activeId && message.content[0]?.type === 'text') {
      const textContent = message.content[0].text
      sessionManager.current.addMessage(activeId, message.role, textContent)
      
      // Update session title from first user message
      const currentMessages = sessionManager.current.getMessages(activeId)
      if (message.role === 'user' && currentMessages.length === 1) {
        const title = sessionManager.current.generateSessionTitle(textContent)
        sessionManager.current.updateSession(activeId, { title })
        refresh() // Update UI
      }
    }
  }, [activeId, refresh]);

  const handleSessionUpdate = useCallback((updates: any) => {
    if (activeId) {
      sessionManager.current.updateSession(activeId, updates)
      setSessionData(prev => ({
        ...prev,
        [activeId]: {
          ...prev[activeId],
          ...updates
        }
      }))
    }
  }, [activeId]);

  const handleGeneratingChange = useCallback((generating: boolean) => {
    if (activeId) {
      setSessionGeneratingStates(prev => ({ ...prev, [activeId]: generating }))
      sessionManager.current.updateSession(activeId, { isGenerating: generating })
    }
  }, [activeId]);

  // Initialize sessions on mount
  useEffect(() => {
    const initializeSessions = () => {
       // Initialize session data
       const initialData: Record<string, any> = {}
       sessions.forEach(session => {
        const messages = sessionManager.current.getMessages(session.id)
        const formattedMessages: Message[] = messages.map(msg => ({
          role: msg.role as 'user' | 'assistant',
          content: [{ type: 'text' as const, text: msg.content }]
        }))
        
        // If there's a fragment saved, ensure the last assistant message has it
        if (session.fragment && formattedMessages.length > 0) {
          const lastMessage = formattedMessages[formattedMessages.length - 1]
          if (lastMessage.role === 'assistant') {
            lastMessage.object = session.fragment
            lastMessage.result = session.result
          }
        }
        
        initialData[session.id] = {
          messages: formattedMessages,
          fragment: session.fragment,
          result: session.result,
          currentTab: session.currentTab || 'code',
          isPreviewLoading: session.isPreviewLoading || false
        }
        
        if (session.isGenerating) {
          setSessionGeneratingStates(prev => ({ ...prev, [session.id]: true }))
        }
      })
      setSessionData(initialData)
      
      if (!activeId) {
         // Create initial session
         const newSession = createSession('New Chat')
         setSessionData({
           [newSession.id]: {
             messages: [],
             fragment: undefined,
             result: undefined,
             currentTab: 'code',
             isPreviewLoading: false
           }
         })
      }
      
      // Show sidebar if there are multiple sessions
      setShowSidebar(sessions.length > 1)
    }
    
    initializeSessions()
  }, [sessions, activeId, createSession])


  function logout() {
    supabase
      ? supabase.auth.signOut()
      : console.warn('Supabase is not initialized')
  }


  function handleSocialClick(target: 'github' | 'x' | 'discord') {
    if (target === 'github') {
      window.open('https://github.com/e2b-dev/fragments', '_blank')
    } else if (target === 'x') {
      window.open('https://x.com/e2b_dev', '_blank')
    } else if (target === 'discord') {
      window.open('https://discord.gg/U7KEcGErtQ', '_blank')
    }

    posthog.capture(`${target}_click`)
  }

  function handleClearChat() {
    // Clear the current session's saved state
    if (activeId) {
      sessionManager.current.updateSession(activeId, {
        fragment: undefined,
        result: undefined,
        currentTab: 'code',
        isPreviewLoading: false
      })
      
      // Clear messages for current session
      const allMessages = JSON.parse(localStorage.getItem('fragg_messages') || '[]')
      const filteredMessages = allMessages.filter((m: any) => m.sessionId !== activeId)
      localStorage.setItem('fragg_messages', JSON.stringify(filteredMessages))
      
      // Reset session data
      setSessionData(prev => ({
        ...prev,
        [activeId]: {
          messages: [],
          fragment: undefined,
          result: undefined,
          currentTab: 'code',
          isPreviewLoading: false
        }
      }))
    }
  }

  const handleNewChat = useCallback(async () => {
    // If there's an active session, save its current state
    if (activeId && sessionData[activeId]) {
      // Close current sandbox if running
      await singleActiveSandboxManager.closeCurrent()
    }
    
    // Create new session
    const newSession = createSession('New Chat')
    
    // Initialize new session data
    setSessionData(prev => ({
      ...prev,
      [newSession.id]: {
        messages: [],
        fragment: undefined,
        result: undefined,
        currentTab: 'code',
        isPreviewLoading: false
      }
    }))
    
    // Update sidebar visibility
    const sessions = sessionManager.current.getSessions()
    setShowSidebar(sessions.length > 1)
    
    console.log('Created new chat session:', newSession.id)
  }, [activeId, sessionData, createSession, sessions.length])

  const handleSelectSession = useCallback(async (sessionId: string | null) => {
    if (!sessionId) {
      handleNewChat()
      return
    }
    
    // If switching sessions, close current sandbox
    if (activeId && activeId !== sessionId) {
      await singleActiveSandboxManager.closeCurrent()
    }

    const session = sessionManager.current.getSession(sessionId)
    if (!session) return

    setActive(sessionId)
    
    // Load session data if not already loaded
    if (!sessionData[sessionId]) {
      const messages = sessionManager.current.getMessages(sessionId)
      setSessionData(prev => ({
        ...prev,
        [sessionId]: {
          messages: messages.map(msg => ({
            role: msg.role,
            content: [{ type: 'text', text: msg.content }]
          })),
          fragment: session.fragment,
          result: session.result,
          currentTab: session.currentTab || 'code',
          isPreviewLoading: session.isPreviewLoading || false
        }
      }))
    }
  }, [activeId, handleNewChat, sessionData, setActive])

  return (
    <main className="flex min-h-screen max-h-screen">
      {supabase && (
        <AuthDialog
          open={isAuthDialogOpen}
          setOpen={setAuthDialog}
          view={authView}
          supabase={supabase}
        />
      )}
      
      {/* Sidebar */}
      {showSidebar && (
        <div className={`${sidebarCollapsed ? 'w-12' : 'w-64'} transition-all duration-300 relative`}>
          {sidebarCollapsed ? (
            <button
              onClick={() => setSidebarCollapsed(false)}
              className="absolute top-4 left-2 p-2 hover:bg-muted rounded-md"
            >
              <ChevronLeft className="h-4 w-4 rotate-180" />
            </button>
          ) : (
            <>
              {/* ChatSidebar removed - component no longer exists
              <ChatSidebar
                currentSessionId={activeId}
                onSelectSession={handleSelectSession}
                onNewSession={handleNewChat}
                className="h-full"
              />
              */}
              <div className="h-full bg-muted/10 p-4">
                <p className="text-sm text-muted-foreground">Sidebar removed</p>
              </div>
              <button
                onClick={() => setSidebarCollapsed(true)}
                className="absolute top-4 right-2 p-1 hover:bg-muted rounded-md z-10"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
            </>
          )}
        </div>
      )}
      
      <div className="flex-1 flex flex-col">
        <NavBar
          session={session}
          showLogin={() => setAuthDialog(true)}
          signOut={logout}
          onSocialClick={handleSocialClick}
          onClear={handleClearChat}
          canClear={activeId ? sessionData[activeId]?.messages?.length > 0 : false}
          canUndo={activeId ? sessionData[activeId]?.messages?.length > 1 && !sessionGeneratingStates[activeId] : false}
          onUndo={() => {/* handled in ChatSession */}}
          onNewChat={handleNewChat}
        />
        <div className="grid w-full md:grid-cols-2 flex-1">
          {activeId && sessionData[activeId] && (
            <ChatSession
              key={activeId} // This forces remount on session change
              sessionId={activeId}
              session={session}
              userTeam={userTeam}
              languageModel={languageModel}
              selectedTemplate={selectedTemplate}
              onAuthRequired={() => setAuthDialog(true)}
              onNewMessage={handleNewMessage}
              onSessionUpdate={handleSessionUpdate}
              messages={sessionData[activeId].messages || []}
              onMessagesChange={handleMessagesChange}
              initialFragment={sessionData[activeId].fragment}
              initialResult={sessionData[activeId].result}
              initialTab={sessionData[activeId].currentTab || 'code'}
              initialPreviewLoading={sessionData[activeId].isPreviewLoading || false}
              isGenerating={sessionGeneratingStates[activeId] || false}
              onGeneratingChange={handleGeneratingChange}
            />
          )}
        </div>
      </div>
    </main>
  )
}
