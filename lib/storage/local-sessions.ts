'use client'

export interface ChatSession {
  id: string
  title: string
  sandboxId?: string
  template?: string
  lastCode?: string
  fragment?: any // Store the fragment object
  result?: any // Store execution result
  currentTab?: 'code' | 'fragment'
  isPreviewLoading?: boolean
  isGenerating?: boolean // Track if this session is generating
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

/**
 * LocalSessionManager persists chat sessions & messages in localStorage.
 * Keys:
 *  - fragg_sessions : ChatSession[]
 *  - fragg_messages : ChatMessage[]
 *  - fragg_active_session : string | null
 */
export class LocalSessionManager {
  private readonly SESSIONS_KEY = 'fragg_sessions'
  private readonly MESSAGES_KEY = 'fragg_messages'
  private readonly ACTIVE_KEY = 'fragg_active_session'

  /** Sessions **/
  getSessions(): ChatSession[] {
    if (typeof window === 'undefined') return []
    try {
      const data = localStorage.getItem(this.SESSIONS_KEY)
      return data ? (JSON.parse(data) as ChatSession[]) : []
    } catch {
      return []
    }
  }

  private saveSessions(sessions: ChatSession[]) {
    localStorage.setItem(this.SESSIONS_KEY, JSON.stringify(sessions))
  }

  createSession(title: string): ChatSession {
    const session: ChatSession = {
      id: crypto.randomUUID(),
      title,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    const sessions = this.getSessions()
    sessions.unshift(session)
    this.saveSessions(sessions)
    this.setActiveSession(session.id)
    return session
  }

  updateSession(id: string, updates: Partial<ChatSession>) {
    const sessions = this.getSessions()
    const idx = sessions.findIndex((s) => s.id === id)
    if (idx === -1) return
    sessions[idx] = {
      ...sessions[idx],
      ...updates,
      updatedAt: new Date().toISOString(),
    }
    this.saveSessions(sessions)
  }

  deleteSession(id: string) {
    const sessions = this.getSessions().filter((s) => s.id !== id)
    this.saveSessions(sessions)
    if (this.getActiveSessionId() === id) {
      this.clearActiveSession()
    }
  }

  /** Active session helpers **/
  getActiveSessionId(): string | null {
    return localStorage.getItem(this.ACTIVE_KEY)
  }

  setActiveSession(id: string | null) {
    if (id) localStorage.setItem(this.ACTIVE_KEY, id)
    else this.clearActiveSession()
  }

  clearActiveSession() {
    localStorage.removeItem(this.ACTIVE_KEY)
  }

  /** Messages **/
  private getAllMessages(): ChatMessage[] {
    try {
      const data = localStorage.getItem(this.MESSAGES_KEY)
      return data ? (JSON.parse(data) as ChatMessage[]) : []
    } catch {
      return []
    }
  }

  private saveAllMessages(msgs: ChatMessage[]) {
    localStorage.setItem(this.MESSAGES_KEY, JSON.stringify(msgs))
  }

  getMessages(sessionId: string): ChatMessage[] {
    return this.getAllMessages().filter((m) => m.sessionId === sessionId)
  }

  addMessage(sessionId: string, role: 'user' | 'assistant', content: string) {
    const message: ChatMessage = {
      id: crypto.randomUUID(),
      sessionId,
      role,
      content,
      createdAt: new Date().toISOString(),
    }
    const msgs = this.getAllMessages()
    msgs.push(message)
    this.saveAllMessages(msgs)
    return message
  }

  // Utility methods
  generateSessionTitle(text: string): string {
    return text.slice(0, 30).trim() + (text.length > 30 ? '…' : '')
  }
  
  exportData() {
    return {
      sessions: this.getSessions(),
      messages: this.getAllMessages(),
      exportedAt: new Date().toISOString()
    }
  }
  
  importData(data: { sessions: ChatSession[], messages: ChatMessage[] }) {
    localStorage.setItem(this.SESSIONS_KEY, JSON.stringify(data.sessions))
    localStorage.setItem(this.MESSAGES_KEY, JSON.stringify(data.messages))
  }

  getSession(id: string): ChatSession | null {
    return this.getSessions().find((s) => s.id === id) || null
  }
}