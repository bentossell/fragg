/**
 * Performance optimization utilities for browser preview
 * Includes caching, debouncing, and lazy loading strategies
 */

import { LRUCache, htmlCache, compiledCodeCache, cacheUtils } from './cache'
import type { TemplateId } from '@/lib/templates'

/**
 * Performance metrics tracking
 */
export interface PerformanceMetrics {
  compilationTime: number
  renderTime: number
  cacheHit: boolean
  totalTime: number
  timestamp: number
}

/**
 * Babel compilation with caching
 */
export const compileBabelCode = cacheUtils.memoizeWithLRU(
  (code: string): string => {
    const startTime = performance.now()
    
    try {
      // Check if Babel is available
      if (typeof window !== 'undefined' && (window as any).Babel) {
        const result = (window as any).Babel.transform(code, {
          presets: ['react', 'typescript'],
          plugins: []
        }).code
        
        const endTime = performance.now()
        trackPerformance({
          compilationTime: endTime - startTime,
          renderTime: 0,
          cacheHit: false,
          totalTime: endTime - startTime,
          timestamp: Date.now()
        })
        
        return result
      }
    } catch (error) {
      console.error('Babel compilation error:', error)
    }
    
    return code // Return original code if compilation fails
  },
  (code: string) => `babel:${code.substring(0, 100)}:${code.length}`,
  compiledCodeCache
)

/**
 * Generate HTML with caching
 */
export function generateCachedHTML(
  code: string, 
  template: TemplateId,
  generateFn: (code: string, template: TemplateId) => string
): { html: string; cacheHit: boolean } {
  const key = LRUCache.generateKey(code, template)
  const cached = htmlCache.get(key)
  
  if (cached) {
    return { html: cached, cacheHit: true }
  }
  
  const html = generateFn(code, template)
  htmlCache.set(key, html)
  return { html, cacheHit: false }
}

/**
 * Performance tracking
 */
const performanceMetrics: PerformanceMetrics[] = []
const MAX_METRICS = 100

export function trackPerformance(metrics: PerformanceMetrics): void {
  performanceMetrics.push(metrics)
  
  // Keep only the latest metrics
  if (performanceMetrics.length > MAX_METRICS) {
    performanceMetrics.shift()
  }
}

export function getPerformanceStats() {
  if (performanceMetrics.length === 0) {
    return {
      avgCompilationTime: 0,
      avgRenderTime: 0,
      avgTotalTime: 0,
      cacheHitRate: 0,
      sampleSize: 0
    }
  }
  
  const totals = performanceMetrics.reduce((acc, m) => ({
    compilation: acc.compilation + m.compilationTime,
    render: acc.render + m.renderTime,
    total: acc.total + m.totalTime,
    cacheHits: acc.cacheHits + (m.cacheHit ? 1 : 0)
  }), { compilation: 0, render: 0, total: 0, cacheHits: 0 })
  
  const count = performanceMetrics.length
  
  return {
    avgCompilationTime: totals.compilation / count,
    avgRenderTime: totals.render / count,
    avgTotalTime: totals.total / count,
    cacheHitRate: totals.cacheHits / count,
    sampleSize: count
  }
}

/**
 * Lazy loading for heavy dependencies
 */
interface LazyDependency<T> {
  load(): Promise<T>
  get(): T | null
  isLoaded(): boolean
}

export function createLazyDependency<T>(
  loader: () => Promise<T>
): LazyDependency<T> {
  let instance: T | null = null
  let loadingPromise: Promise<T> | null = null
  
  return {
    async load(): Promise<T> {
      if (instance) return instance
      if (loadingPromise) return loadingPromise
      
      loadingPromise = loader()
      instance = await loadingPromise
      loadingPromise = null
      
      return instance
    },
    
    get(): T | null {
      return instance
    },
    
    isLoaded(): boolean {
      return instance !== null
    }
  }
}

/**
 * Optimized shouldUpdate logic for React components
 */
export function shouldUpdatePreview(
  prevCode: string,
  nextCode: string,
  prevTemplate: TemplateId,
  nextTemplate: TemplateId
): boolean {
  // Don't update if nothing changed
  if (prevCode === nextCode && prevTemplate === nextTemplate) {
    return false
  }
  
  // Always update if template changed
  if (prevTemplate !== nextTemplate) {
    return true
  }
  
  // For minor whitespace changes, don't update
  const normalizedPrev = prevCode.trim().replace(/\s+/g, ' ')
  const normalizedNext = nextCode.trim().replace(/\s+/g, ' ')
  
  return normalizedPrev !== normalizedNext
}

/**
 * Memory usage monitoring
 */
export function getMemoryUsage(): {
  used: number
  total: number
  percent: number
} | null {
  if (typeof window === 'undefined' || !(window.performance as any).memory) {
    return null
  }
  
  const memory = (window.performance as any).memory
  return {
    used: memory.usedJSHeapSize,
    total: memory.totalJSHeapSize,
    percent: (memory.usedJSHeapSize / memory.totalJSHeapSize) * 100
  }
}

/**
 * Request idle callback wrapper for non-critical updates
 */
export function scheduleIdleTask(
  callback: () => void,
  options?: { timeout?: number }
): number {
  if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
    return (window as any).requestIdleCallback(callback, options)
  }
  
  // Fallback to setTimeout
  return setTimeout(callback, options?.timeout || 1) as any
}

export function cancelIdleTask(id: number): void {
  if (typeof window !== 'undefined' && 'cancelIdleCallback' in window) {
    (window as any).cancelIdleCallback(id)
  } else {
    clearTimeout(id)
  }
}

/**
 * Batch updates for multiple preview changes
 */
export class BatchUpdateManager {
  private pendingUpdates: Map<string, () => void> = new Map()
  private flushTimeout: NodeJS.Timeout | null = null
  private readonly flushDelay: number

  constructor(flushDelay: number = 16) { // Default to ~1 frame
    this.flushDelay = flushDelay
  }

  add(key: string, update: () => void): void {
    this.pendingUpdates.set(key, update)
    this.scheduleFlush()
  }

  private scheduleFlush(): void {
    if (this.flushTimeout) return
    
    this.flushTimeout = setTimeout(() => {
      this.flush()
    }, this.flushDelay)
  }

  private flush(): void {
    const updates = Array.from(this.pendingUpdates.values())
    this.pendingUpdates.clear()
    this.flushTimeout = null
    
    // Execute all updates
    updates.forEach(update => update())
  }

  clear(): void {
    if (this.flushTimeout) {
      clearTimeout(this.flushTimeout)
      this.flushTimeout = null
    }
    this.pendingUpdates.clear()
  }
}

/**
 * Export performance utilities
 */
export const performanceUtils = {
  compileBabelCode,
  generateCachedHTML,
  trackPerformance,
  getPerformanceStats,
  shouldUpdatePreview,
  getMemoryUsage,
  scheduleIdleTask,
  cancelIdleTask,
  createLazyDependency,
  BatchUpdateManager,
  
  // Cache management
  clearCaches: () => {
    htmlCache.clear()
    compiledCodeCache.clear()
  },
  
  getCacheStats: () => ({
    html: htmlCache.getStats(),
    compiledCode: compiledCodeCache.getStats()
  })
} 