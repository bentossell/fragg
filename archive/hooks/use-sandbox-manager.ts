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
    async (sessionId: string, fragment: DeepPartial<FragmentSchema>, appId?: string): Promise<ExecutionResult | undefined> => {
      // Use appId as the lock key if available, otherwise use sessionId
      const lockKey = appId || sessionId
      
      // If a request for this session/app is already in-flight, wait for it to complete
      if (requestLocks.has(lockKey)) {
        console.log(`[useSandboxManager] Waiting for existing request for: ${lockKey}`)
        return await requestLocks.get(lockKey)
      }

      const requestPromise = (async () => {
        setIsLoading(true)
        setError(null)
        try {
          console.log(`[useSandboxManager] Sending new sandbox request for session: ${sessionId}, app: ${appId || 'none'}`)
          const response = await fetch('/api/sandbox', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              fragment,
              sessionId,
              appId,
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
          // Clean up the lock
          requestLocks.delete(lockKey)
          console.log(`[useSandboxManager] Request lock released for: ${lockKey}`)
        }
      })();
      
      // Store the promise in the lock map
      requestLocks.set(lockKey, requestPromise as Promise<ExecutionResult>)

      return requestPromise
    },
    []
  )

  const releaseSandbox = useCallback(async (sessionId: string, template: string, appId?: string) => {
    try {
      await fetch('/api/sandbox', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, template, appId }),
      })
    } catch (e) {
      console.error('[useSandboxManager] Failed to release sandbox:', e)
    }
  }, [])

  return { getSandbox, releaseSandbox, isLoading, error }
} 