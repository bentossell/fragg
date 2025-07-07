/**
 * Performance monitoring hook for browser preview
 * Tracks load times, memory usage, and other performance metrics
 */

import { useEffect, useRef, useState, useCallback } from 'react'

interface PerformanceMetrics {
  loadTime: number
  renderTime: number
  memoryUsage: number
  timestamp: number
}

interface PerformanceStats {
  current: PerformanceMetrics | null
  average: {
    loadTime: number
    renderTime: number
    memoryUsage: number
  }
  peak: {
    loadTime: number
    renderTime: number
    memoryUsage: number
  }
  samples: number
}

/**
 * Hook to monitor performance of a component or operation
 */
export function usePerformanceMonitor(
  name: string,
  options: {
    logToConsole?: boolean
    sampleRate?: number // 0-1, percentage of operations to track
    maxSamples?: number
  } = {}
) {
  const {
    logToConsole = process.env.NODE_ENV === 'development',
    sampleRate = 1,
    maxSamples = 100
  } = options

  const [stats, setStats] = useState<PerformanceStats>({
    current: null,
    average: { loadTime: 0, renderTime: 0, memoryUsage: 0 },
    peak: { loadTime: 0, renderTime: 0, memoryUsage: 0 },
    samples: 0
  })

  const metricsHistory = useRef<PerformanceMetrics[]>([])
  const startTimeRef = useRef<number>(0)
  const renderStartTimeRef = useRef<number>(0)

  /**
   * Start tracking load time
   */
  const startLoadTracking = useCallback(() => {
    if (Math.random() > sampleRate) return
    startTimeRef.current = performance.now()
  }, [sampleRate])

  /**
   * Start tracking render time
   */
  const startRenderTracking = useCallback(() => {
    if (Math.random() > sampleRate) return
    renderStartTimeRef.current = performance.now()
  }, [sampleRate])

  /**
   * End tracking and record metrics
   */
  const endTracking = useCallback(() => {
    if (!startTimeRef.current && !renderStartTimeRef.current) return

    const now = performance.now()
    const loadTime = startTimeRef.current ? now - startTimeRef.current : 0
    const renderTime = renderStartTimeRef.current ? now - renderStartTimeRef.current : 0
    const memoryUsage = getMemoryUsage()

    const metrics: PerformanceMetrics = {
      loadTime,
      renderTime,
      memoryUsage,
      timestamp: Date.now()
    }

    // Add to history
    metricsHistory.current.push(metrics)
    
    // Keep only maxSamples
    if (metricsHistory.current.length > maxSamples) {
      metricsHistory.current.shift()
    }

    // Calculate statistics
    const history = metricsHistory.current
    const samples = history.length

    const totals = history.reduce((acc, m) => ({
      loadTime: acc.loadTime + m.loadTime,
      renderTime: acc.renderTime + m.renderTime,
      memoryUsage: acc.memoryUsage + m.memoryUsage
    }), { loadTime: 0, renderTime: 0, memoryUsage: 0 })

    const average = {
      loadTime: totals.loadTime / samples,
      renderTime: totals.renderTime / samples,
      memoryUsage: totals.memoryUsage / samples
    }

    const peak = history.reduce((acc, m) => ({
      loadTime: Math.max(acc.loadTime, m.loadTime),
      renderTime: Math.max(acc.renderTime, m.renderTime),
      memoryUsage: Math.max(acc.memoryUsage, m.memoryUsage)
    }), { loadTime: 0, renderTime: 0, memoryUsage: 0 })

    setStats({
      current: metrics,
      average,
      peak,
      samples
    })

    // Log to console if enabled
    if (logToConsole) {
      console.log(`[Performance] ${name}:`, {
        loadTime: `${loadTime.toFixed(2)}ms`,
        renderTime: `${renderTime.toFixed(2)}ms`,
        memoryUsage: `${formatBytes(memoryUsage)}`,
        avgLoadTime: `${average.loadTime.toFixed(2)}ms`,
        samples
      })
    }

    // Reset timers
    startTimeRef.current = 0
    renderStartTimeRef.current = 0
  }, [name, logToConsole, maxSamples, sampleRate])

  /**
   * Mark a specific event
   */
  const mark = useCallback((eventName: string) => {
    if (typeof window !== 'undefined' && window.performance) {
      const markName = `${name}:${eventName}`
      performance.mark(markName)
      
      if (logToConsole) {
        console.log(`[Performance Mark] ${markName}`)
      }
    }
  }, [name, logToConsole])

  /**
   * Measure between two marks
   */
  const measure = useCallback((startMark: string, endMark: string) => {
    if (typeof window !== 'undefined' && window.performance) {
      const measureName = `${name}:${startMark}-${endMark}`
      try {
        performance.measure(
          measureName,
          `${name}:${startMark}`,
          `${name}:${endMark}`
        )
        
        const entries = performance.getEntriesByName(measureName)
        const duration = entries[entries.length - 1]?.duration || 0
        
        if (logToConsole) {
          console.log(`[Performance Measure] ${measureName}: ${duration.toFixed(2)}ms`)
        }
        
        return duration
      } catch (error) {
        console.error('Performance measure error:', error)
        return 0
      }
    }
    return 0
  }, [name, logToConsole])

  /**
   * Clear all performance marks and measures for this component
   */
  const clearMarks = useCallback(() => {
    if (typeof window !== 'undefined' && window.performance) {
      performance.getEntriesByType('mark')
        .filter(entry => entry.name.startsWith(`${name}:`))
        .forEach(entry => performance.clearMarks(entry.name))
      
      performance.getEntriesByType('measure')
        .filter(entry => entry.name.startsWith(`${name}:`))
        .forEach(entry => performance.clearMeasures(entry.name))
    }
  }, [name])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearMarks()
    }
  }, [clearMarks])

  return {
    startLoadTracking,
    startRenderTracking,
    endTracking,
    mark,
    measure,
    clearMarks,
    stats
  }
}

/**
 * Hook to track React component render performance
 */
export function useRenderPerformance(componentName: string) {
  const renderCount = useRef(0)
  const renderTimes = useRef<number[]>([])
  const lastRenderTime = useRef<number>(0)

  useEffect(() => {
    const startTime = performance.now()
    
    return () => {
      const endTime = performance.now()
      const renderTime = endTime - startTime
      
      renderCount.current++
      renderTimes.current.push(renderTime)
      
      // Keep only last 10 render times
      if (renderTimes.current.length > 10) {
        renderTimes.current.shift()
      }
      
      lastRenderTime.current = renderTime
      
      if (process.env.NODE_ENV === 'development') {
        console.log(`[Render] ${componentName}: ${renderTime.toFixed(2)}ms (render #${renderCount.current})`)
      }
    }
  })

  return {
    renderCount: renderCount.current,
    lastRenderTime: lastRenderTime.current,
    averageRenderTime: renderTimes.current.length > 0
      ? renderTimes.current.reduce((a, b) => a + b, 0) / renderTimes.current.length
      : 0
  }
}

/**
 * Hook to monitor memory usage
 */
export function useMemoryMonitor(options: { interval?: number } = {}) {
  const { interval = 5000 } = options // Default 5 seconds
  const [memoryInfo, setMemoryInfo] = useState<{
    used: number
    total: number
    percent: number
  } | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined' || !(window.performance as any).memory) {
      return
    }

    const updateMemory = () => {
      const memory = (window.performance as any).memory
      setMemoryInfo({
        used: memory.usedJSHeapSize,
        total: memory.totalJSHeapSize,
        percent: (memory.usedJSHeapSize / memory.totalJSHeapSize) * 100
      })
    }

    updateMemory()
    const intervalId = setInterval(updateMemory, interval)

    return () => clearInterval(intervalId)
  }, [interval])

  return memoryInfo
}

/**
 * Utility functions
 */
function getMemoryUsage(): number {
  if (typeof window !== 'undefined' && (window.performance as any).memory) {
    return (window.performance as any).memory.usedJSHeapSize
  }
  return 0
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes'
  
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

/**
 * Performance observer for long tasks
 */
export function useLongTaskMonitor(threshold: number = 50) {
  const [longTasks, setLongTasks] = useState<PerformanceEntry[]>([])

  useEffect(() => {
    if (typeof window === 'undefined' || !('PerformanceObserver' in window)) {
      return
    }

    try {
      const observer = new PerformanceObserver((list) => {
        const entries = list.getEntries()
        setLongTasks(prev => [...prev, ...entries].slice(-10)) // Keep last 10
        
        if (process.env.NODE_ENV === 'development') {
          entries.forEach(entry => {
            console.warn(`[Long Task] Duration: ${entry.duration.toFixed(2)}ms`, entry)
          })
        }
      })

      observer.observe({ entryTypes: ['longtask'] })

      return () => observer.disconnect()
    } catch (error) {
      console.error('Failed to setup long task observer:', error)
    }
  }, [threshold])

  return longTasks
} 