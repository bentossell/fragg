import { useState, useCallback, useRef, useEffect } from 'react'
import { ExecutionResult } from '@/lib/types'
import { FragmentSchema } from '@/lib/schema'
import { DeepPartial } from 'ai'

// A map to hold promises for in-flight sandbox requests
const requestLocks = new Map<string, Promise<ExecutionResult>>()

export function useSandboxManager() {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const getSandbox = useCallback(
    async (sessionId: string, fragment: DeepPartial<FragmentSchema>): Promise<ExecutionResult | undefined> => {
      // If a request for this session is already in-flight, wait for it to complete
      if (requestLocks.has(sessionId)) {
        console.log(`[useSandboxManager] Waiting for existing request for session: ${sessionId}`)
        return await requestLocks.get(sessionId)
      }

      const requestPromise = (async () => {
        setIsLoading(true)
        setError(null)
        try {
          console.log(`[useSandboxManager] Sending new sandbox request for session: ${sessionId}`)
          const response = await fetch('/api/sandbox', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              fragment,
              sessionId,
              template: fragment.template,
            }),
          })

          const result = await response.json()

          if (!response.ok) {
            throw new Error(result.details || result.error || 'Failed to create sandbox')
          }
          
          return result as ExecutionResult
        } catch (e: any) {
          console.error('[useSandboxManager] Error:', e)
          setError(e.message)
          // Return undefined or re-throw, depending on desired error handling
          return undefined
        } finally {
          setIsLoading(false)
          // Clean up the lock for this session
          requestLocks.delete(sessionId)
          console.log(`[useSandboxManager] Request lock released for session: ${sessionId}`)
        }
      })();
      
      // Store the promise in the lock map
      requestLocks.set(sessionId, requestPromise as Promise<ExecutionResult>)

      return requestPromise
    },
    []
  )

  const releaseSandbox = useCallback(async (sessionId: string, template: string) => {
    try {
      await fetch('/api/sandbox', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, template }),
      })
    } catch (e) {
      console.error('[useSandboxManager] Failed to release sandbox:', e)
    }
  }, [])

  return { getSandbox, releaseSandbox, isLoading, error }
} 