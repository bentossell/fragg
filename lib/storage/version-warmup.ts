import { DeepPartial } from 'ai'
import { FragmentSchema } from '@/lib/schema'
import { ExecutionResult } from '@/lib/types'

interface VersionCache {
  [key: string]: {
    result: ExecutionResult
    timestamp: number
  }
}

class SandboxVersionWarmup {
  private cache: VersionCache = {}
  private warmupInProgress = new Set<string>()
  private readonly CACHE_TTL = 5 * 60 * 1000 // 5 minutes
  
  /**
   * Get a cache key for a version
   */
  private getCacheKey(fragment: DeepPartial<FragmentSchema>, sessionId?: string): string {
    return `${sessionId || 'default'}_${JSON.stringify(fragment)}`
  }
  
  /**
   * Check if we have a cached sandbox for this version
   */
  getCachedSandbox(fragment: DeepPartial<FragmentSchema>, sessionId?: string): ExecutionResult | null {
    const key = this.getCacheKey(fragment, sessionId)
    const cached = this.cache[key]
    
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.result
    }
    
    // Clean up expired cache
    if (cached) {
      delete this.cache[key]
    }
    
    return null
  }
  
  /**
   * Warm up sandboxes for adjacent versions
   */
  async warmupAdjacentVersions(
    versions: Array<{ fragment: DeepPartial<FragmentSchema> }>,
    currentIndex: number,
    sessionId?: string
  ): Promise<void> {
    const indicesToWarmup = [
      currentIndex - 1,
      currentIndex + 1
    ].filter(i => i >= 0 && i < versions.length)
    
    const warmupPromises = indicesToWarmup.map(async (index) => {
      const version = versions[index]
      const key = this.getCacheKey(version.fragment, sessionId)
      
      // Skip if already warming up or cached
      if (this.warmupInProgress.has(key) || this.getCachedSandbox(version.fragment, sessionId)) {
        return
      }
      
      this.warmupInProgress.add(key)
      
      try {
        const response = await fetch('/api/sandbox', {
          method: 'POST',
          body: JSON.stringify({
            fragment: version.fragment,
            sessionId,
          }),
        })
        
        if (response.ok) {
          const result = await response.json()
          this.cache[key] = {
            result,
            timestamp: Date.now()
          }
        }
      } catch (error) {
        console.error('Error warming up sandbox:', error)
      } finally {
        this.warmupInProgress.delete(key)
      }
    })
    
    // Don't wait for warmup to complete
    Promise.all(warmupPromises).catch(console.error)
  }
  
  /**
   * Create or get sandbox with caching
   */
  async getOrCreateSandbox(
    fragment: DeepPartial<FragmentSchema>,
    sessionId?: string
  ): Promise<ExecutionResult | null> {
    // Check cache first
    const cached = this.getCachedSandbox(fragment, sessionId)
    if (cached) {
      return cached
    }
    
    const key = this.getCacheKey(fragment, sessionId)
    
    // Prevent duplicate requests
    if (this.warmupInProgress.has(key)) {
      // Wait for the warmup to complete
      let attempts = 0
      while (this.warmupInProgress.has(key) && attempts < 50) {
        await new Promise(resolve => setTimeout(resolve, 100))
        attempts++
      }
      return this.getCachedSandbox(fragment, sessionId)
    }
    
    this.warmupInProgress.add(key)
    
    try {
      const response = await fetch('/api/sandbox', {
        method: 'POST',
        body: JSON.stringify({
          fragment,
          sessionId,
        }),
      })
      
      if (response.ok) {
        const result = await response.json()
        this.cache[key] = {
          result,
          timestamp: Date.now()
        }
        return result
      }
      
      return null
    } catch (error) {
      console.error('Error creating sandbox:', error)
      return null
    } finally {
      this.warmupInProgress.delete(key)
    }
  }
  
  /**
   * Clear cache for a specific session
   */
  clearSessionCache(sessionId: string): void {
    Object.keys(this.cache).forEach(key => {
      if (key.startsWith(`${sessionId}_`)) {
        delete this.cache[key]
      }
    })
  }
  
  /**
   * Clear all cache
   */
  clearAllCache(): void {
    this.cache = {}
    this.warmupInProgress.clear()
  }
}

export const sandboxVersionWarmup = new SandboxVersionWarmup() 