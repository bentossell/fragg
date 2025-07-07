import { useState, useEffect, useRef, useCallback } from 'react'

// Basic debounce hook
export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value)

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value)
    }, delay)

    return () => {
      clearTimeout(handler)
    }
  }, [value, delay])

  return debouncedValue
}

// Advanced debounce hook with immediate and trailing options
export function useAdvancedDebounce<T>(
  value: T,
  delay: number,
  options: {
    leading?: boolean
    trailing?: boolean
    maxWait?: number
  } = {}
): T {
  const { leading = false, trailing = true, maxWait } = options
  const [debouncedValue, setDebouncedValue] = useState<T>(value)
  const lastCallTime = useRef<number>(0)
  const lastInvokeTime = useRef<number>(0)
  const timerId = useRef<NodeJS.Timeout | null>(null)
  const maxTimerId = useRef<NodeJS.Timeout | null>(null)

  const invokeFunc = useCallback(() => {
    const time = Date.now()
    lastInvokeTime.current = time
    setDebouncedValue(value)
  }, [value])

  const leadingEdge = useCallback(() => {
    lastInvokeTime.current = Date.now()
    if (leading) {
      invokeFunc()
    }
  }, [leading, invokeFunc])

  const trailingEdge = useCallback(() => {
    if (trailing) {
      invokeFunc()
    }
  }, [trailing, invokeFunc])

  const shouldInvoke = useCallback(() => {
    const time = Date.now()
    const timeSinceLastCall = time - lastCallTime.current
    const timeSinceLastInvoke = time - lastInvokeTime.current

    return (
      lastCallTime.current === 0 ||
      timeSinceLastCall >= delay ||
      (maxWait !== undefined && timeSinceLastInvoke >= maxWait)
    )
  }, [delay, maxWait])

  useEffect(() => {
    const time = Date.now()
    lastCallTime.current = time

    if (shouldInvoke()) {
      if (timerId.current) {
        clearTimeout(timerId.current)
      }
      if (maxTimerId.current) {
        clearTimeout(maxTimerId.current)
      }
      leadingEdge()
    } else {
      if (timerId.current) {
        clearTimeout(timerId.current)
      }
      timerId.current = setTimeout(trailingEdge, delay)

      if (maxWait !== undefined && !maxTimerId.current) {
        maxTimerId.current = setTimeout(() => {
          invokeFunc()
          maxTimerId.current = null
        }, maxWait)
      }
    }

    return () => {
      if (timerId.current) {
        clearTimeout(timerId.current)
      }
      if (maxTimerId.current) {
        clearTimeout(maxTimerId.current)
      }
    }
  }, [value, delay, shouldInvoke, leadingEdge, trailingEdge, invokeFunc, maxWait])

  return debouncedValue
}

// Debounced callback hook
export function useDebouncedCallback<T extends (...args: any[]) => any>(
  callback: T,
  delay: number,
  options: {
    leading?: boolean
    trailing?: boolean
    maxWait?: number
  } = {}
): T {
  const { leading = false, trailing = true, maxWait } = options
  const lastCallTime = useRef<number>(0)
  const lastInvokeTime = useRef<number>(0)
  const timerId = useRef<NodeJS.Timeout | null>(null)
  const maxTimerId = useRef<NodeJS.Timeout | null>(null)
  const lastArgsRef = useRef<Parameters<T>>([] as any)

  const invokeFunc = useCallback(() => {
    const time = Date.now()
    lastInvokeTime.current = time
    if (lastArgsRef.current) {
      callback(...lastArgsRef.current)
    }
  }, [callback])

  const leadingEdge = useCallback(() => {
    lastInvokeTime.current = Date.now()
    if (leading) {
      invokeFunc()
    }
  }, [leading, invokeFunc])

  const trailingEdge = useCallback(() => {
    if (trailing) {
      invokeFunc()
    }
  }, [trailing, invokeFunc])

  const shouldInvoke = useCallback(() => {
    const time = Date.now()
    const timeSinceLastCall = time - lastCallTime.current
    const timeSinceLastInvoke = time - lastInvokeTime.current

    return (
      lastCallTime.current === 0 ||
      timeSinceLastCall >= delay ||
      (maxWait !== undefined && timeSinceLastInvoke >= maxWait)
    )
  }, [delay, maxWait])

  const debouncedCallback = useCallback(
    (...args: Parameters<T>) => {
      const time = Date.now()
      lastCallTime.current = time
      lastArgsRef.current = args

      if (shouldInvoke()) {
        if (timerId.current) {
          clearTimeout(timerId.current)
        }
        if (maxTimerId.current) {
          clearTimeout(maxTimerId.current)
        }
        leadingEdge()
      } else {
        if (timerId.current) {
          clearTimeout(timerId.current)
        }
        timerId.current = setTimeout(trailingEdge, delay)

        if (maxWait !== undefined && !maxTimerId.current) {
          maxTimerId.current = setTimeout(() => {
            invokeFunc()
            maxTimerId.current = null
          }, maxWait)
        }
      }
    },
    [delay, shouldInvoke, leadingEdge, trailingEdge, invokeFunc, maxWait]
  ) as T

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerId.current) {
        clearTimeout(timerId.current)
      }
      if (maxTimerId.current) {
        clearTimeout(maxTimerId.current)
      }
    }
  }, [])

  return debouncedCallback
}

// Debounced state hook
export function useDebouncedState<T>(
  initialValue: T,
  delay: number,
  options: {
    leading?: boolean
    trailing?: boolean
    maxWait?: number
  } = {}
): [T, T, (value: T) => void] {
  const [value, setValue] = useState<T>(initialValue)
  const debouncedValue = useAdvancedDebounce(value, delay, options)

  return [value, debouncedValue, setValue]
}

// Debounced effect hook
export function useDebouncedEffect(
  effect: () => void | (() => void),
  deps: React.DependencyList,
  delay: number,
  options: {
    leading?: boolean
    trailing?: boolean
    maxWait?: number
  } = {}
) {
  const { leading = false, trailing = true, maxWait } = options
  const lastCallTime = useRef<number>(0)
  const lastInvokeTime = useRef<number>(0)
  const timerId = useRef<NodeJS.Timeout | null>(null)
  const maxTimerId = useRef<NodeJS.Timeout | null>(null)
  const cleanupRef = useRef<(() => void) | null>(null)

  const invokeFunc = useCallback(() => {
    const time = Date.now()
    lastInvokeTime.current = time
    
    // Clean up previous effect
    if (cleanupRef.current) {
      cleanupRef.current()
      cleanupRef.current = null
    }
    
    // Run new effect
    const cleanup = effect()
    if (typeof cleanup === 'function') {
      cleanupRef.current = cleanup
    }
  }, [effect])

  const leadingEdge = useCallback(() => {
    lastInvokeTime.current = Date.now()
    if (leading) {
      invokeFunc()
    }
  }, [leading, invokeFunc])

  const trailingEdge = useCallback(() => {
    if (trailing) {
      invokeFunc()
    }
  }, [trailing, invokeFunc])

  const shouldInvoke = useCallback(() => {
    const time = Date.now()
    const timeSinceLastCall = time - lastCallTime.current
    const timeSinceLastInvoke = time - lastInvokeTime.current

    return (
      lastCallTime.current === 0 ||
      timeSinceLastCall >= delay ||
      (maxWait !== undefined && timeSinceLastInvoke >= maxWait)
    )
  }, [delay, maxWait])

  useEffect(() => {
    const time = Date.now()
    lastCallTime.current = time

    if (shouldInvoke()) {
      if (timerId.current) {
        clearTimeout(timerId.current)
      }
      if (maxTimerId.current) {
        clearTimeout(maxTimerId.current)
      }
      leadingEdge()
    } else {
      if (timerId.current) {
        clearTimeout(timerId.current)
      }
      timerId.current = setTimeout(trailingEdge, delay)

      if (maxWait !== undefined && !maxTimerId.current) {
        maxTimerId.current = setTimeout(() => {
          invokeFunc()
          maxTimerId.current = null
        }, maxWait)
      }
    }

    return () => {
      if (timerId.current) {
        clearTimeout(timerId.current)
      }
      if (maxTimerId.current) {
        clearTimeout(maxTimerId.current)
      }
    }
  }, deps)

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerId.current) {
        clearTimeout(timerId.current)
      }
      if (maxTimerId.current) {
        clearTimeout(maxTimerId.current)
      }
      if (cleanupRef.current) {
        cleanupRef.current()
      }
    }
  }, [])
}

// Throttle hook for high-frequency events
export function useThrottle<T>(value: T, limit: number): T {
  const [throttledValue, setThrottledValue] = useState<T>(value)
  const lastRan = useRef<number>(Date.now())

  useEffect(() => {
    const handler = setTimeout(() => {
      if (Date.now() - lastRan.current >= limit) {
        setThrottledValue(value)
        lastRan.current = Date.now()
      }
    }, limit - (Date.now() - lastRan.current))

    return () => {
      clearTimeout(handler)
    }
  }, [value, limit])

  return throttledValue
} 