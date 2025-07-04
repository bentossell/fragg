# Local-First MVP Plan

## Overview
Focus on creating an exceptional local experience for app generation with fast performance, persistent chat sessions, and smooth editing - all without requiring authentication or a database.

## Current Status
- ✅ Stage 1: Basic Local Setup - COMPLETE
- ✅ Stage 2: AI SDK in Apps - COMPLETE  
- 🚧 Stage 3: Local Performance & UX - IN PROGRESS

## Revised Stage 3: Local Performance & Chat Sessions (Days 6-10)

### Step 3.1: localStorage Chat Sessions
Create a robust local storage system for chat sessions:

```typescript
// lib/storage/local-sessions.ts
export interface ChatSession {
  id: string
  title: string
  sandboxId?: string
  template?: string
  lastCode?: string
  createdAt: string
  updatedAt: string
}

export interface ChatMessage {
  id: string
  sessionId: string
  role: 'user' | 'assistant'
  content: string
  createdAt: string
}

export class LocalSessionManager {
  private readonly SESSIONS_KEY = 'fragg_sessions'
  private readonly MESSAGES_KEY = 'fragg_messages'
  
  getSessions(): ChatSession[] {
    const data = localStorage.getItem(this.SESSIONS_KEY)
    return data ? JSON.parse(data) : []
  }
  
  getSession(id: string): ChatSession | null {
    const sessions = this.getSessions()
    return sessions.find(s => s.id === id) || null
  }
  
  createSession(title: string): ChatSession {
    const session: ChatSession = {
      id: crypto.randomUUID(),
      title,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
    
    const sessions = this.getSessions()
    sessions.unshift(session)
    localStorage.setItem(this.SESSIONS_KEY, JSON.stringify(sessions))
    
    return session
  }
  
  updateSession(id: string, updates: Partial<ChatSession>) {
    const sessions = this.getSessions()
    const index = sessions.findIndex(s => s.id === id)
    
    if (index !== -1) {
      sessions[index] = {
        ...sessions[index],
        ...updates,
        updatedAt: new Date().toISOString()
      }
      localStorage.setItem(this.SESSIONS_KEY, JSON.stringify(sessions))
    }
  }
  
  getMessages(sessionId: string): ChatMessage[] {
    const allMessages = this.getAllMessages()
    return allMessages.filter(m => m.sessionId === sessionId)
  }
  
  addMessage(sessionId: string, role: 'user' | 'assistant', content: string) {
    const message: ChatMessage = {
      id: crypto.randomUUID(),
      sessionId,
      role,
      content,
      createdAt: new Date().toISOString()
    }
    
    const messages = this.getAllMessages()
    messages.push(message)
    localStorage.setItem(this.MESSAGES_KEY, JSON.stringify(messages))
    
    return message
  }
  
  private getAllMessages(): ChatMessage[] {
    const data = localStorage.getItem(this.MESSAGES_KEY)
    return data ? JSON.parse(data) : []
  }
}
```

### Step 3.2: ChatGPT-style Sidebar UI
Build a session management sidebar:

```typescript
// components/chat/chat-sidebar.tsx
'use client'

import { useState, useEffect } from 'react'
import { Plus, MessageSquare, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import { LocalSessionManager } from '@/lib/storage/local-sessions'

export function ChatSidebar({
  currentSessionId,
  onSelectSession,
  onNewSession
}: {
  currentSessionId?: string
  onSelectSession: (sessionId: string | null) => void
  onNewSession: () => void
}) {
  const [sessions, setSessions] = useState<ChatSession[]>([])
  const sessionManager = new LocalSessionManager()
  
  useEffect(() => {
    setSessions(sessionManager.getSessions())
  }, [currentSessionId])
  
  return (
    <div className="w-64 border-r bg-muted/10 h-full flex flex-col">
      <div className="p-4">
        <Button 
          className="w-full" 
          onClick={onNewSession}
        >
          <Plus className="mr-2 h-4 w-4" />
          New Chat
        </Button>
      </div>
      
      <ScrollArea className="flex-1">
        <div className="px-2 py-1">
          {sessions.map((session) => (
            <button
              key={session.id}
              onClick={() => onSelectSession(session.id)}
              className={cn(
                "w-full text-left px-3 py-2 rounded-md mb-1",
                "hover:bg-muted transition-colors",
                "flex items-center gap-2",
                currentSessionId === session.id && "bg-muted"
              )}
            >
              <MessageSquare className="h-4 w-4 shrink-0" />
              <div className="flex-1 overflow-hidden">
                <div className="font-medium truncate">{session.title}</div>
                <div className="text-xs text-muted-foreground">
                  {formatRelativeTime(session.updatedAt)}
                </div>
              </div>
            </button>
          ))}
        </div>
      </ScrollArea>
    </div>
  )
}
```

### Step 3.3: Sandbox Reconnection
Implement sandbox persistence to prevent "sandbox not found" errors:

```typescript
// lib/sandbox/reconnect.ts
import { Sandbox } from 'e2b'

export class SandboxReconnectionManager {
  private reconnectAttempts = new Map<string, number>()
  private maxAttempts = 3
  
  async getOrCreateSandbox(
    sessionId: string,
    sandboxId: string | undefined,
    template: string
  ): Promise<{ sandbox: Sandbox, isNew: boolean }> {
    // Try to reconnect to existing sandbox
    if (sandboxId) {
      try {
        const sandbox = await Sandbox.reconnect(sandboxId)
        console.log('Reconnected to existing sandbox:', sandboxId)
        return { sandbox, isNew: false }
      } catch (error) {
        console.log('Failed to reconnect, creating new sandbox')
        // Sandbox no longer exists, we'll create a new one
      }
    }
    
    // Create new sandbox
    const sandbox = await Sandbox.create(template, {
      metadata: { sessionId }
    })
    
    return { sandbox, isNew: true }
  }
  
  async keepAlive(sandbox: Sandbox) {
    // Implement periodic keep-alive to prevent sandbox timeout
    const interval = setInterval(async () => {
      try {
        await sandbox.filesystem.list('/')
      } catch (error) {
        clearInterval(interval)
      }
    }, 30000) // Every 30 seconds
    
    return () => clearInterval(interval)
  }
}
```

### Step 3.4: Update Main Chat Interface
Integrate all components:

```typescript
// app/page.tsx updates
export default function Home() {
  const [currentSessionId, setCurrentSessionId] = useState<string>()
  const [sandbox, setSandbox] = useState<Sandbox>()
  const sessionManager = new LocalSessionManager()
  const reconnectManager = new SandboxReconnectionManager()
  
  const handleNewSession = () => {
    const session = sessionManager.createSession('New Chat')
    setCurrentSessionId(session.id)
    setSandbox(undefined) // Clear sandbox for new session
  }
  
  const handleSelectSession = async (sessionId: string | null) => {
    if (!sessionId) {
      handleNewSession()
      return
    }
    
    setCurrentSessionId(sessionId)
    const session = sessionManager.getSession(sessionId)
    
    if (session?.sandboxId && session.template) {
      const { sandbox } = await reconnectManager.getOrCreateSandbox(
        sessionId,
        session.sandboxId,
        session.template
      )
      setSandbox(sandbox)
    }
  }
  
  const handleGenerateApp = async (messages, template) => {
    const { sandbox, isNew } = await reconnectManager.getOrCreateSandbox(
      currentSessionId!,
      sessionManager.getSession(currentSessionId!)?.sandboxId,
      template
    )
    
    setSandbox(sandbox)
    
    // Update session with sandbox info
    sessionManager.updateSession(currentSessionId!, {
      sandboxId: sandbox.id,
      template,
      lastCode: generatedCode
    })
    
    // Continue with app generation...
  }
  
  return (
    <div className="flex h-screen">
      <ChatSidebar
        currentSessionId={currentSessionId}
        onSelectSession={handleSelectSession}
        onNewSession={handleNewSession}
      />
      <div className="flex-1">
        {/* Existing chat interface */}
      </div>
    </div>
  )
}
```

### Step 3.5: Incremental Code Updates
Instead of regenerating everything, apply diffs:

```typescript
// lib/code/incremental-update.ts
import { diffLines } from 'diff'

export async function applyIncrementalUpdate(
  sandbox: Sandbox,
  filePath: string,
  oldCode: string,
  newCode: string
) {
  // For small files or major changes, just replace
  if (oldCode.length < 1000 || similarity(oldCode, newCode) < 0.3) {
    await sandbox.filesystem.write(filePath, newCode)
    return
  }
  
  // For larger files with minor changes, consider applying patches
  const diff = diffLines(oldCode, newCode)
  
  // Apply diff intelligently...
  await sandbox.filesystem.write(filePath, newCode)
}
```

## Benefits of Local-First Approach

1. **Zero Setup**: No Supabase project needed, works immediately
2. **Fast Iteration**: All data in memory/localStorage
3. **Privacy**: All data stays on user's machine
4. **Offline-First**: Works without internet (except for AI calls)
5. **Simple Migration**: Easy to add database later

## Next Stages (Deferred)

### Stage 4: Optional Cloud Features
- Add Supabase only when needed for:
  - Multi-device sync
  - Sharing apps
  - Team collaboration

### Stage 5: Performance Optimization
- Sandbox pooling (pre-warm 3 sandboxes)
- CDN-first templates
- Edge caching

## Success Metrics for Local MVP

- [ ] Chat sessions persist across page refreshes
- [ ] Can switch between multiple app projects instantly
- [ ] Sandbox reconnection eliminates "not found" errors  
- [ ] App generation takes <15 seconds
- [ ] Edits apply in <5 seconds
- [ ] Smooth, responsive UI with no lag

## Implementation Order

1. localStorage session management (2 hours)
2. ChatGPT-style sidebar UI (2 hours)
3. Sandbox reconnection logic (1 hour)
4. Integration with existing chat (2 hours)
5. Testing and polish (1 hour)

Total: ~8 hours for a dramatically improved local experience