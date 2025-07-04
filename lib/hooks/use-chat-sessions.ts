'use client'

import { useCallback, useEffect, useState } from 'react'
import { ChatSession, LocalSessionManager } from '@/lib/storage/local-sessions'
import { Message } from '@/lib/messages'

const manager = new LocalSessionManager()

export function useChatSessions() {
  const [sessions, setSessions] = useState<ChatSession[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)

  // Load on mount
  useEffect(() => {
    setSessions(manager.getSessions())
    setActiveId(manager.getActiveSessionId())
  }, [])

  const refresh = useCallback(() => {
    setSessions(manager.getSessions())
    setActiveId(manager.getActiveSessionId())
  }, [])

  const createSession = useCallback((title: string) => {
    const s = manager.createSession(title)
    refresh()
    return s
  }, [refresh])

  const setActive = useCallback((id: string | null) => {
    manager.setActiveSession(id)
    refresh()
  }, [refresh])

  const updateCurrentSession = useCallback((updates: Partial<Omit<ChatSession, 'id' | 'createdAt'>>) => {
    if (activeId) {
      manager.updateSession(activeId, updates)
      setSessions(manager.getSessions())
    }
  }, [activeId])

  const saveMessage = useCallback((role: 'user' | 'assistant', content: string) => {
    if (activeId) {
      const message = manager.addMessage(activeId, role, content)
      
      // Update session title from first user message
      const messages = manager.getMessages(activeId)
      if (messages.length === 1 && role === 'user') {
        const title = manager.generateSessionTitle(content)
        updateCurrentSession({ title })
      }
      
      return message
    }
    return null
  }, [activeId, updateCurrentSession])

  const loadSessionMessages = useCallback((sessionId: string): Message[] => {
    const messages = manager.getMessages(sessionId)
    return messages.map(msg => ({
      role: msg.role,
      content: [{ type: 'text', text: msg.content }]
    }))
  }, [])

  const getCurrentSession = useCallback(() => {
    if (activeId) {
      return manager.getSession(activeId)
    }
    return null
  }, [activeId])

  return {
    sessions,
    activeId,
    getCurrentSession,
    createSession,
    setActive,
    updateCurrentSession,
    saveMessage,
    loadSessionMessages,
    refresh,
  }
}