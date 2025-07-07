/**
 * LRU Cache implementation for browser preview compiled code
 * Optimizes performance by caching HTML generation results
 */

interface CacheEntry<T> {
  value: T
  timestamp: number
  accessCount: number
  lastAccessed: number
}

export class LRUCache<T> {
  private cache: Map<string, CacheEntry<T>>
  private readonly maxSize: number
  private readonly maxAge: number // in milliseconds
  private accessOrder: string[] = []

  constructor(maxSize: number = 50, maxAge: number = 30 * 60 * 1000) { // 30 minutes default
    this.cache = new Map()
    this.maxSize = maxSize
    this.maxAge = maxAge
  }

  /**
   * Generate cache key based on code content and template
   */
  static generateKey(code: string, template: string, dependencies?: Record<string, string>): string {
    const depStr = dependencies ? JSON.stringify(dependencies) : ''
    // Simple hash function for cache key generation
    const hash = `${code}::${template}::${depStr}`.split('').reduce((a, b) => {
      const h = ((a << 5) - a) + b.charCodeAt(0)
      return h & h
    }, 0)
    return `${template}-${hash}`
  }

  /**
   * Get value from cache
   */
  get(key: string): T | null {
    const entry = this.cache.get(key)
    
    if (!entry) {
      return null
    }

    // Check if entry has expired
    const now = Date.now()
    if (now - entry.timestamp > this.maxAge) {
      this.cache.delete(key)
      this.removeFromAccessOrder(key)
      return null
    }

    // Update access metadata
    entry.lastAccessed = now
    entry.accessCount++
    
    // Update access order
    this.updateAccessOrder(key)
    
    return entry.value
  }

  /**
   * Set value in cache
   */
  set(key: string, value: T): void {
    const now = Date.now()

    // If cache is at max size, evict least recently used
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      this.evictLRU()
    }

    this.cache.set(key, {
      value,
      timestamp: now,
      accessCount: 1,
      lastAccessed: now
    })

    this.updateAccessOrder(key)
  }

  /**
   * Update access order for LRU tracking
   */
  private updateAccessOrder(key: string): void {
    // Remove from current position
    this.removeFromAccessOrder(key)
    // Add to end (most recently used)
    this.accessOrder.push(key)
  }

  /**
   * Remove key from access order
   */
  private removeFromAccessOrder(key: string): void {
    const index = this.accessOrder.indexOf(key)
    if (index > -1) {
      this.accessOrder.splice(index, 1)
    }
  }

  /**
   * Evict least recently used item
   */
  private evictLRU(): void {
    if (this.accessOrder.length === 0) return

    // Get least recently used key (first in array)
    const lruKey = this.accessOrder.shift()
    if (lruKey) {
      this.cache.delete(lruKey)
    }
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.clear()
    this.accessOrder = []
  }

  /**
   * Get cache size
   */
  size(): number {
    return this.cache.size
  }

  /**
   * Get cache statistics
   */
  getStats(): {
    size: number
    maxSize: number
    hitRate: number
    entries: Array<{ key: string; accessCount: number; age: number }>
  } {
    const now = Date.now()
    const entries = Array.from(this.cache.entries()).map(([key, entry]) => ({
      key,
      accessCount: entry.accessCount,
      age: now - entry.timestamp
    }))

    const totalAccesses = entries.reduce((sum, e) => sum + e.accessCount, 0)
    const hitRate = totalAccesses > 0 ? entries.length / totalAccesses : 0

    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      hitRate,
      entries: entries.sort((a, b) => b.accessCount - a.accessCount)
    }
  }

  /**
   * Prune expired entries
   */
  prune(): void {
    const now = Date.now()
    const keysToDelete: string[] = []

    this.cache.forEach((entry, key) => {
      if (now - entry.timestamp > this.maxAge) {
        keysToDelete.push(key)
      }
    })

    keysToDelete.forEach(key => {
      this.cache.delete(key)
      this.removeFromAccessOrder(key)
    })
  }
}

// Singleton instance for browser preview HTML cache
export const htmlCache = new LRUCache<string>(50, 30 * 60 * 1000) // 50 entries, 30 minutes

// Singleton instance for compiled code cache (for Babel transformations)
export const compiledCodeCache = new LRUCache<string>(100, 60 * 60 * 1000) // 100 entries, 1 hour

// Auto-prune caches every 5 minutes
if (typeof window !== 'undefined') {
  setInterval(() => {
    htmlCache.prune()
    compiledCodeCache.prune()
  }, 5 * 60 * 1000)
}

/**
 * Higher-level caching utilities
 */
export const cacheUtils = {
  /**
   * Memoize a function with LRU caching
   */
  memoizeWithLRU<TArgs extends any[], TResult>(
    fn: (...args: TArgs) => TResult,
    generateKey: (...args: TArgs) => string,
    cache: LRUCache<TResult> = new LRUCache<TResult>()
  ): (...args: TArgs) => TResult {
    return (...args: TArgs): TResult => {
      const key = generateKey(...args)
      const cached = cache.get(key)
      
      if (cached !== null) {
        return cached
      }
      
      const result = fn(...args)
      cache.set(key, result)
      return result
    }
  },

  /**
   * Create a cache key from multiple parameters
   */
  createKey(...parts: any[]): string {
    return parts.map(p => {
      if (typeof p === 'object') {
        return JSON.stringify(p)
      }
      return String(p)
    }).join('::')
  }
} 