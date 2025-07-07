import React, { useEffect, useRef, useState, useCallback } from 'react'

// Performance metrics interface
export interface PerformanceMetrics {
  componentRenderTime: number
  componentMountTime: number
  componentUpdateCount: number
  memoryUsage: number
  networkRequests: NetworkMetric[]
  rerenderReasons: string[]
  timestamp: number
}

export interface NetworkMetric {
  url: string
  method: string
  duration: number
  status: number
  cached: boolean
  deduped: boolean
  retries: number
  timestamp: number
}

// Performance monitor class
export class PerformanceMonitor {
  private static instance: PerformanceMonitor
  private metrics: Map<string, PerformanceMetrics> = new Map()
  private networkCache: Map<string, { data: any; timestamp: number; ttl: number }> = new Map()
  private ongoingRequests: Map<string, Promise<any>> = new Map()
  private observers: ((metrics: PerformanceMetrics) => void)[] = []

  static getInstance(): PerformanceMonitor {
    if (!PerformanceMonitor.instance) {
      PerformanceMonitor.instance = new PerformanceMonitor()
    }
    return PerformanceMonitor.instance
  }

  // Component performance tracking
  trackComponent(componentName: string, renderTime: number, mountTime?: number) {
    const existing = this.metrics.get(componentName)
    const metrics: PerformanceMetrics = {
      componentRenderTime: renderTime,
      componentMountTime: mountTime || existing?.componentMountTime || 0,
      componentUpdateCount: (existing?.componentUpdateCount || 0) + 1,
      memoryUsage: this.getMemoryUsage(),
      networkRequests: existing?.networkRequests || [],
      rerenderReasons: existing?.rerenderReasons || [],
      timestamp: Date.now()
    }
    
    this.metrics.set(componentName, metrics)
    this.notifyObservers(metrics)
  }

  // Network request tracking with caching and deduplication
  async trackNetworkRequest<T>(
    key: string,
    url: string,
    method: string,
    requestFn: () => Promise<T>,
    options: {
      ttl?: number
      retries?: number
      timeout?: number
    } = {}
  ): Promise<T> {
    const { ttl = 5 * 60 * 1000, retries = 3, timeout = 30000 } = options
    const cacheKey = `${method}:${url}`
    
    // Check cache first
    const cached = this.networkCache.get(cacheKey)
    if (cached && Date.now() - cached.timestamp < cached.ttl) {
      this.trackNetworkMetric(url, method, 0, 200, true, false, 0)
      return cached.data
    }

    // Check for ongoing request (deduplication)
    const ongoing = this.ongoingRequests.get(cacheKey)
    if (ongoing) {
      this.trackNetworkMetric(url, method, 0, 200, false, true, 0)
      return ongoing
    }

    // Execute request with retry logic
    const startTime = Date.now()
    let lastError: Error | null = null
    let attempt = 0

    const executeRequest = async (): Promise<T> => {
      try {
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('Request timeout')), timeout)
        })

        const result = await Promise.race([requestFn(), timeoutPromise])
        const duration = Date.now() - startTime
        
        // Cache successful results
        this.networkCache.set(cacheKey, {
          data: result,
          timestamp: Date.now(),
          ttl
        })

        this.trackNetworkMetric(url, method, duration, 200, false, false, attempt)
        return result
      } catch (error) {
        lastError = error as Error
        attempt++
        
        if (attempt <= retries) {
          // Exponential backoff
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000))
          return executeRequest()
        }
        
        const duration = Date.now() - startTime
        this.trackNetworkMetric(url, method, duration, 500, false, false, attempt)
        throw error
      }
    }

    const requestPromise = executeRequest()
    this.ongoingRequests.set(cacheKey, requestPromise)
    
    try {
      const result = await requestPromise
      return result
    } finally {
      this.ongoingRequests.delete(cacheKey)
    }
  }

  private trackNetworkMetric(
    url: string,
    method: string,
    duration: number,
    status: number,
    cached: boolean,
    deduped: boolean,
    retries: number
  ) {
    const metric: NetworkMetric = {
      url,
      method,
      duration,
      status,
      cached,
      deduped,
      retries,
      timestamp: Date.now()
    }

    // Add to all component metrics
    for (const [componentName, metrics] of this.metrics.entries()) {
      metrics.networkRequests.push(metric)
      this.notifyObservers(metrics)
    }
  }

  // Memory usage tracking
  private getMemoryUsage(): number {
    if (typeof window !== 'undefined' && 'performance' in window && 'memory' in performance) {
      return (performance as any).memory.usedJSHeapSize / 1024 / 1024 // MB
    }
    return 0
  }

  // Observer pattern for real-time monitoring
  subscribe(observer: (metrics: PerformanceMetrics) => void) {
    this.observers.push(observer)
    return () => {
      const index = this.observers.indexOf(observer)
      if (index > -1) {
        this.observers.splice(index, 1)
      }
    }
  }

  private notifyObservers(metrics: PerformanceMetrics) {
    this.observers.forEach(observer => observer(metrics))
  }

  // Get performance report
  getPerformanceReport(): Record<string, PerformanceMetrics> {
    const report: Record<string, PerformanceMetrics> = {}
    this.metrics.forEach((metrics, componentName) => {
      report[componentName] = metrics
    })
    return report
  }

  // Clear old metrics
  clearOldMetrics(maxAge: number = 5 * 60 * 1000) {
    const now = Date.now()
    for (const [key, metrics] of this.metrics.entries()) {
      if (now - metrics.timestamp > maxAge) {
        this.metrics.delete(key)
      }
    }
    
    // Clear old cache entries
    for (const [key, cache] of this.networkCache.entries()) {
      if (now - cache.timestamp > cache.ttl) {
        this.networkCache.delete(key)
      }
    }
  }
}

// React hooks for performance monitoring
export function usePerformanceMonitor(componentName: string) {
  const monitor = PerformanceMonitor.getInstance()
  const renderStartTime = useRef(Date.now())
  const mountTime = useRef<number | null>(null)
  const updateCount = useRef(0)

  useEffect(() => {
    if (mountTime.current === null) {
      mountTime.current = Date.now() - renderStartTime.current
    }
  }, [])

  useEffect(() => {
    updateCount.current++
    const renderTime = Date.now() - renderStartTime.current
    monitor.trackComponent(componentName, renderTime, mountTime.current || undefined)
  })

  return {
    trackNetworkRequest: useCallback(
      <T>(key: string, url: string, method: string, requestFn: () => Promise<T>, options?: any) =>
        monitor.trackNetworkRequest(key, url, method, requestFn, options),
      [monitor]
    ),
    getMetrics: useCallback(() => monitor.getPerformanceReport()[componentName], [monitor, componentName])
  }
}

// Hook for tracking re-render reasons
export function useRerenderTracker(componentName: string, props: Record<string, any>) {
  const prevProps = useRef<Record<string, any>>({})
  const monitor = PerformanceMonitor.getInstance()

  useEffect(() => {
    const changedProps = Object.keys(props).filter(
      key => prevProps.current[key] !== props[key]
    )
    
    if (changedProps.length > 0) {
      const metrics = monitor.getPerformanceReport()[componentName]
      if (metrics) {
        metrics.rerenderReasons.push(`Props changed: ${changedProps.join(', ')}`)
      }
    }
    
    prevProps.current = props
  })
}

// HOC for automatic performance monitoring
export function withPerformanceMonitor<T extends Record<string, any>>(
  Component: React.ComponentType<T>,
  componentName?: string
) {
  const WrappedComponent = (props: T) => {
    const name = componentName || Component.displayName || Component.name || 'Unknown'
    usePerformanceMonitor(name)
    useRerenderTracker(name, props)
    
    return React.createElement(Component, props)
  }
  
  WrappedComponent.displayName = `withPerformanceMonitor(${componentName || Component.displayName || Component.name})`
  
  return WrappedComponent
}

// Performance debugging utilities
export const performanceUtils = {
  logSlowComponents: (threshold: number = 16) => {
    const monitor = PerformanceMonitor.getInstance()
    const report = monitor.getPerformanceReport()
    
    Object.entries(report).forEach(([name, metrics]) => {
      if (metrics.componentRenderTime > threshold) {
        console.warn(`🐌 Slow component: ${name} (${metrics.componentRenderTime}ms)`)
      }
    })
  },
  
  logMemoryUsage: () => {
    const monitor = PerformanceMonitor.getInstance()
    const report = monitor.getPerformanceReport()
    
    Object.entries(report).forEach(([name, metrics]) => {
      console.log(`📊 ${name}: ${metrics.memoryUsage.toFixed(2)}MB`)
    })
  },
  
  logNetworkStats: () => {
    const monitor = PerformanceMonitor.getInstance()
    const report = monitor.getPerformanceReport()
    
    Object.entries(report).forEach(([name, metrics]) => {
      const { networkRequests } = metrics
      const cached = networkRequests.filter(r => r.cached).length
      const deduped = networkRequests.filter(r => r.deduped).length
      
      console.log(`🌐 ${name}: ${networkRequests.length} requests, ${cached} cached, ${deduped} deduped`)
    })
  }
} 