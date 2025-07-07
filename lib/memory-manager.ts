import React, { useEffect, useRef, useCallback, useState } from 'react'

// Memory leak detection interface
export interface MemoryLeak {
  type: 'event-listener' | 'timer' | 'observer' | 'subscription' | 'cache' | 'dom-reference'
  source: string
  description: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  detectedAt: number
  estimatedSize: number
}

export interface MemoryMetrics {
  usedJSHeapSize: number
  totalJSHeapSize: number
  jsHeapSizeLimit: number
  leaks: MemoryLeak[]
  cleanupActions: number
  lastCleanup: number
}

// Memory manager class
export class MemoryManager {
  private static instance: MemoryManager
  private cleanupRegistry = new Map<string, () => void>()
  private timers = new Set<NodeJS.Timeout>()
  private intervals = new Set<NodeJS.Timeout>()
  private observers = new Set<IntersectionObserver | MutationObserver | ResizeObserver>()
  private eventListeners = new Map<string, { element: EventTarget; event: string; handler: EventListener }>()
  private subscriptions = new Set<{ unsubscribe: () => void }>()
  private caches = new Map<string, Map<string, any>>()
  private weakRefs = new Set<WeakRef<any>>()
  private memoryLeaks: MemoryLeak[] = []
  private monitoring = false

  static getInstance(): MemoryManager {
    if (!MemoryManager.instance) {
      MemoryManager.instance = new MemoryManager()
    }
    return MemoryManager.instance
  }

  // Start monitoring for memory leaks
  startMonitoring(): void {
    if (this.monitoring || typeof window === 'undefined') return

    this.monitoring = true
    
    // Monitor every 30 seconds
    const monitorInterval = setInterval(() => {
      this.detectMemoryLeaks()
      this.cleanupStaleReferences()
    }, 30000)

    // Monitor on visibility change
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        this.performEmergencyCleanup()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    
    // Cleanup monitoring on unload
    window.addEventListener('beforeunload', () => {
      clearInterval(monitorInterval)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      this.performEmergencyCleanup()
    })
  }

  // Register cleanup function
  registerCleanup(id: string, cleanup: () => void): void {
    this.cleanupRegistry.set(id, cleanup)
  }

  // Register timer for tracking
  registerTimer(timer: NodeJS.Timeout, type: 'timeout' | 'interval' = 'timeout'): NodeJS.Timeout {
    if (type === 'interval') {
      this.intervals.add(timer)
    } else {
      this.timers.add(timer)
    }
    return timer
  }

  // Register observer for tracking
  registerObserver<T extends IntersectionObserver | MutationObserver | ResizeObserver>(observer: T): T {
    this.observers.add(observer)
    return observer
  }

  // Register event listener for tracking
  registerEventListener(
    id: string,
    element: EventTarget,
    event: string,
    handler: EventListener,
    options?: AddEventListenerOptions
  ): void {
    element.addEventListener(event, handler, options)
    this.eventListeners.set(id, { element, event, handler })
  }

  // Register subscription for tracking
  registerSubscription(subscription: { unsubscribe: () => void }): void {
    this.subscriptions.add(subscription)
  }

  // Register cache for tracking
  registerCache(name: string, cache: Map<string, any>): void {
    this.caches.set(name, cache)
  }

  // Create tracked weak reference
  createWeakRef<T extends object>(object: T): WeakRef<T> {
    const weakRef = new WeakRef(object)
    this.weakRefs.add(weakRef)
    return weakRef
  }

  // Cleanup specific resource
  cleanup(id: string): void {
    const cleanupFn = this.cleanupRegistry.get(id)
    if (cleanupFn) {
      try {
        cleanupFn()
        this.cleanupRegistry.delete(id)
      } catch (error) {
        console.error(`Failed to cleanup resource ${id}:`, error)
      }
    }
  }

  // Cleanup all resources
  cleanupAll(): void {
    // Clear timers
    this.timers.forEach(timer => clearTimeout(timer))
    this.intervals.forEach(interval => clearInterval(interval))
    this.timers.clear()
    this.intervals.clear()

    // Disconnect observers
    this.observers.forEach(observer => observer.disconnect())
    this.observers.clear()

    // Remove event listeners
    this.eventListeners.forEach(({ element, event, handler }) => {
      try {
        element.removeEventListener(event, handler)
      } catch (error) {
        console.warn('Failed to remove event listener:', error)
      }
    })
    this.eventListeners.clear()

    // Unsubscribe from subscriptions
    this.subscriptions.forEach(subscription => {
      try {
        subscription.unsubscribe()
      } catch (error) {
        console.warn('Failed to unsubscribe:', error)
      }
    })
    this.subscriptions.clear()

    // Clear caches
    this.caches.forEach(cache => cache.clear())
    this.caches.clear()

    // Run registered cleanup functions
    this.cleanupRegistry.forEach((cleanupFn, id) => {
      try {
        cleanupFn()
      } catch (error) {
        console.error(`Failed to cleanup resource ${id}:`, error)
      }
    })
    this.cleanupRegistry.clear()
  }

  // Detect memory leaks
  private detectMemoryLeaks(): void {
    const metrics = this.getMemoryMetrics()
    const now = Date.now()

    // Check for excessive memory growth
    if (metrics.usedJSHeapSize > metrics.jsHeapSizeLimit * 0.8) {
      this.memoryLeaks.push({
        type: 'cache',
        source: 'heap-overflow',
        description: 'JS heap size approaching limit',
        severity: 'critical',
        detectedAt: now,
        estimatedSize: metrics.usedJSHeapSize
      })
    }

    // Check for stale timers
    if (this.timers.size > 100) {
      this.memoryLeaks.push({
        type: 'timer',
        source: 'excessive-timers',
        description: `${this.timers.size} active timers detected`,
        severity: 'medium',
        detectedAt: now,
        estimatedSize: this.timers.size * 100 // Estimated bytes per timer
      })
    }

    // Check for stale observers
    if (this.observers.size > 50) {
      this.memoryLeaks.push({
        type: 'observer',
        source: 'excessive-observers',
        description: `${this.observers.size} active observers detected`,
        severity: 'medium',
        detectedAt: now,
        estimatedSize: this.observers.size * 500 // Estimated bytes per observer
      })
    }

    // Check for excessive event listeners
    if (this.eventListeners.size > 200) {
      this.memoryLeaks.push({
        type: 'event-listener',
        source: 'excessive-listeners',
        description: `${this.eventListeners.size} event listeners registered`,
        severity: 'high',
        detectedAt: now,
        estimatedSize: this.eventListeners.size * 200 // Estimated bytes per listener
      })
    }

    // Log critical leaks
    const criticalLeaks = this.memoryLeaks.filter(leak => leak.severity === 'critical')
    if (criticalLeaks.length > 0) {
      console.error('🚨 Critical memory leaks detected:', criticalLeaks)
    }
  }

  // Cleanup stale references
  private cleanupStaleReferences(): void {
    // Clean up dereferenced weak refs
    const staleWeakRefs = Array.from(this.weakRefs).filter(ref => ref.deref() === undefined)
    staleWeakRefs.forEach(ref => this.weakRefs.delete(ref))

    // Clean up old memory leaks (older than 5 minutes)
    const fiveMinutesAgo = Date.now() - 5 * 60 * 1000
    this.memoryLeaks = this.memoryLeaks.filter(leak => leak.detectedAt > fiveMinutesAgo)
  }

  // Perform emergency cleanup
  private performEmergencyCleanup(): void {
    console.log('🧹 Performing emergency cleanup...')
    
    // Clear large caches first
    this.caches.forEach((cache, name) => {
      if (cache.size > 1000) {
        cache.clear()
        console.log(`Cleared large cache: ${name}`)
      }
    })

    // Clear old timers
    const oldTimers = Array.from(this.timers).slice(0, Math.floor(this.timers.size / 2))
    oldTimers.forEach(timer => {
      clearTimeout(timer)
      this.timers.delete(timer)
    })

    // Force garbage collection if available
    if (typeof window !== 'undefined' && 'gc' in window) {
      (window as any).gc()
    }
  }

  // Get memory metrics
  getMemoryMetrics(): MemoryMetrics {
    const defaultMetrics = {
      usedJSHeapSize: 0,
      totalJSHeapSize: 0,
      jsHeapSizeLimit: 0,
      leaks: this.memoryLeaks,
      cleanupActions: this.cleanupRegistry.size,
      lastCleanup: Date.now()
    }

    if (typeof window === 'undefined' || !('performance' in window)) {
      return defaultMetrics
    }

    const memory = (performance as any).memory
    if (!memory) {
      return defaultMetrics
    }

    return {
      usedJSHeapSize: memory.usedJSHeapSize,
      totalJSHeapSize: memory.totalJSHeapSize,
      jsHeapSizeLimit: memory.jsHeapSizeLimit,
      leaks: this.memoryLeaks,
      cleanupActions: this.cleanupRegistry.size,
      lastCleanup: Date.now()
    }
  }

  // Get memory usage percentage
  getMemoryUsagePercentage(): number {
    const metrics = this.getMemoryMetrics()
    if (metrics.jsHeapSizeLimit === 0) return 0
    return (metrics.usedJSHeapSize / metrics.jsHeapSizeLimit) * 100
  }
}

// React hooks for memory management
export function useMemoryCleanup(id: string, cleanup: () => void): void {
  const manager = MemoryManager.getInstance()
  
  useEffect(() => {
    manager.registerCleanup(id, cleanup)
    
    return () => {
      manager.cleanup(id)
    }
  }, [id, cleanup, manager])
}

export function useTimerCleanup(): {
  setTimeout: (callback: () => void, delay: number) => NodeJS.Timeout
  setInterval: (callback: () => void, delay: number) => NodeJS.Timeout
  clearAll: () => void
} {
  const manager = MemoryManager.getInstance()
  const timersRef = useRef(new Set<NodeJS.Timeout>())

  const setTimeoutTracked = useCallback((callback: () => void, delay: number) => {
    const timer = setTimeout(() => {
      callback()
      timersRef.current.delete(timer)
    }, delay)
    
    timersRef.current.add(timer)
    return manager.registerTimer(timer, 'timeout')
  }, [manager])

  const setIntervalTracked = useCallback((callback: () => void, delay: number) => {
    const interval = setInterval(callback, delay)
    timersRef.current.add(interval)
    return manager.registerTimer(interval, 'interval')
  }, [manager])

  const clearAll = useCallback(() => {
    timersRef.current.forEach(timer => {
      clearTimeout(timer)
      clearInterval(timer)
    })
    timersRef.current.clear()
  }, [])

  useEffect(() => {
    return clearAll
  }, [clearAll])

  return { setTimeout: setTimeoutTracked, setInterval: setIntervalTracked, clearAll }
}

export function useEventListenerCleanup(): {
  addEventListener: (
    element: EventTarget,
    event: string,
    handler: EventListener,
    options?: AddEventListenerOptions
  ) => void
  removeAllListeners: () => void
} {
  const manager = MemoryManager.getInstance()
  const listenersRef = useRef(new Map<string, { element: EventTarget; event: string; handler: EventListener }>())

  const addEventListener = useCallback((
    element: EventTarget,
    event: string,
    handler: EventListener,
    options?: AddEventListenerOptions
  ) => {
    const id = `${Date.now()}-${Math.random()}`
    manager.registerEventListener(id, element, event, handler, options)
    listenersRef.current.set(id, { element, event, handler })
  }, [manager])

  const removeAllListeners = useCallback(() => {
    listenersRef.current.forEach(({ element, event, handler }, id) => {
      try {
        element.removeEventListener(event, handler)
      } catch (error) {
        console.warn('Failed to remove event listener:', error)
      }
      manager.cleanup(id)
    })
    listenersRef.current.clear()
  }, [manager])

  useEffect(() => {
    return removeAllListeners
  }, [removeAllListeners])

  return { addEventListener, removeAllListeners }
}

export function useObserverCleanup(): {
  createIntersectionObserver: (callback: IntersectionObserverCallback, options?: IntersectionObserverInit) => IntersectionObserver
  createMutationObserver: (callback: MutationCallback) => MutationObserver
  createResizeObserver: (callback: ResizeObserverCallback) => ResizeObserver
  disconnectAll: () => void
} {
  const manager = MemoryManager.getInstance()
  const observersRef = useRef(new Set<IntersectionObserver | MutationObserver | ResizeObserver>())

  const createIntersectionObserver = useCallback((
    callback: IntersectionObserverCallback,
    options?: IntersectionObserverInit
  ) => {
    const observer = new IntersectionObserver(callback, options)
    observersRef.current.add(observer)
    return manager.registerObserver(observer)
  }, [manager])

  const createMutationObserver = useCallback((callback: MutationCallback) => {
    const observer = new MutationObserver(callback)
    observersRef.current.add(observer)
    return manager.registerObserver(observer)
  }, [manager])

  const createResizeObserver = useCallback((callback: ResizeObserverCallback) => {
    const observer = new ResizeObserver(callback)
    observersRef.current.add(observer)
    return manager.registerObserver(observer)
  }, [manager])

  const disconnectAll = useCallback(() => {
    observersRef.current.forEach(observer => observer.disconnect())
    observersRef.current.clear()
  }, [])

  useEffect(() => {
    return disconnectAll
  }, [disconnectAll])

  return {
    createIntersectionObserver,
    createMutationObserver,
    createResizeObserver,
    disconnectAll
  }
}

export function useMemoryMonitoring(): MemoryMetrics {
  const manager = MemoryManager.getInstance()
  const [metrics, setMetrics] = useState<MemoryMetrics>(manager.getMemoryMetrics())

  useEffect(() => {
    manager.startMonitoring()
    
    const interval = setInterval(() => {
      setMetrics(manager.getMemoryMetrics())
    }, 5000) // Update every 5 seconds

    return () => clearInterval(interval)
  }, [manager])

  return metrics
}

// Export singleton instance
export const memoryManager = MemoryManager.getInstance() 