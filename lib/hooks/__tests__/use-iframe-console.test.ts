import { renderHook, act } from '@testing-library/react'
import { useRef } from 'react'
import { useIframeConsole } from '../use-iframe-console'

// Mock postMessage and addEventListener
const mockPostMessage = jest.fn()
const mockAddEventListener = jest.fn()
const mockRemoveEventListener = jest.fn()

// Mock iframe
const createMockIframe = () => ({
  current: {
    contentWindow: {
      postMessage: mockPostMessage,
      document: {
        createElement: jest.fn().mockReturnValue({
          textContent: ''
        }),
        head: {
          insertBefore: jest.fn()
        },
        body: {
          insertBefore: jest.fn()
        }
      }
    },
    contentDocument: {
      readyState: 'complete'
    },
    addEventListener: mockAddEventListener,
    removeEventListener: mockRemoveEventListener
  } as any
})

// Store the real addEventListener/removeEventListener
const originalAddEventListener = window.addEventListener
const originalRemoveEventListener = window.removeEventListener

describe('useIframeConsole', () => {
  let mockWindowAddEventListener: jest.Mock
  let mockWindowRemoveEventListener: jest.Mock

  beforeEach(() => {
    jest.clearAllMocks()
    
    // Mock window methods
    mockWindowAddEventListener = jest.fn()
    mockWindowRemoveEventListener = jest.fn()
    
    Object.defineProperty(window, 'addEventListener', {
      value: mockWindowAddEventListener,
      configurable: true
    })
    
    Object.defineProperty(window, 'removeEventListener', {
      value: mockWindowRemoveEventListener,
      configurable: true
    })
  })

  afterEach(() => {
    // Restore original methods
    Object.defineProperty(window, 'addEventListener', {
      value: originalAddEventListener,
      configurable: true
    })
    
    Object.defineProperty(window, 'removeEventListener', {
      value: originalRemoveEventListener,
      configurable: true
    })
  })

  it('should initialize without errors', () => {
    const iframeRef = createMockIframe()
    
    const { result } = renderHook(() => useIframeConsole(iframeRef))
    
    expect(result.current.messages).toEqual([])
    expect(typeof result.current.clearMessages).toBe('function')
  })

  it('should handle iframe without contentWindow gracefully', () => {
    const iframeRef = {
      current: {
        contentWindow: null,
        contentDocument: null,
        addEventListener: mockAddEventListener,
        removeEventListener: mockRemoveEventListener
      } as any
    }
    
    expect(() => {
      renderHook(() => useIframeConsole(iframeRef))
    }).not.toThrow()
  })

  it('should add message event listeners', () => {
    const iframeRef = createMockIframe()
    
    renderHook(() => useIframeConsole(iframeRef))
    
    expect(mockWindowAddEventListener).toHaveBeenCalledWith('message', expect.any(Function))
    expect(mockAddEventListener).toHaveBeenCalledWith('load', expect.any(Function))
  })

  it('should handle console messages from iframe', async () => {
    const iframeRef = createMockIframe()
    
    const { result } = renderHook(() => useIframeConsole(iframeRef))
    
    // Get the message handler
    const messageHandler = mockWindowAddEventListener.mock.calls
      .find(call => call[0] === 'message')?.[1]
    
    expect(messageHandler).toBeDefined()
    
    if (messageHandler) {
      const mockEvent = {
        source: iframeRef.current.contentWindow,
        data: {
          type: 'console',
          method: 'log',
          message: 'Test message',
          args: ['Test', 'message']
        }
      }
      
      await act(async () => {
        messageHandler(mockEvent)
      })
      
      expect(result.current.messages).toHaveLength(1)
      expect(result.current.messages[0]).toMatchObject({
        type: 'log',
        message: 'Test message',
        args: ['Test', 'message']
      })
      expect(result.current.messages[0].timestamp).toBeDefined()
    }
  })

  it('should filter messages by capture types', async () => {
    const iframeRef = createMockIframe()
    
    const { result } = renderHook(() => 
      useIframeConsole(iframeRef, { captureTypes: ['error', 'warn'] })
    )
    
    const messageHandler = mockWindowAddEventListener.mock.calls
      .find(call => call[0] === 'message')?.[1]
    
    if (messageHandler) {
      await act(async () => {
        // Send a log message (should be filtered out)
        messageHandler({
          source: iframeRef.current.contentWindow,
          data: {
            type: 'console',
            method: 'log',
            message: 'Log message'
          }
        })
        
        // Send an error message (should be captured)
        messageHandler({
          source: iframeRef.current.contentWindow,
          data: {
            type: 'console',
            method: 'error',
            message: 'Error message'
          }
        })
      })
      
      expect(result.current.messages).toHaveLength(1)
      expect(result.current.messages[0].type).toBe('error')
    }
  })

  it('should ignore messages from other sources', async () => {
    const iframeRef = createMockIframe()
    
    const { result } = renderHook(() => useIframeConsole(iframeRef))
    
    const messageHandler = mockWindowAddEventListener.mock.calls
      .find(call => call[0] === 'message')?.[1]
    
    if (messageHandler) {
      await act(async () => {
        // Send message from different source
        messageHandler({
          source: window, // Different source
          data: {
            type: 'console',
            method: 'log',
            message: 'Should be ignored'
          }
        })
      })
      
      expect(result.current.messages).toHaveLength(0)
    }
  })

  it('should limit messages to maxMessages', async () => {
    const iframeRef = createMockIframe()
    
    const { result } = renderHook(() => 
      useIframeConsole(iframeRef, { maxMessages: 2 })
    )
    
    const messageHandler = mockWindowAddEventListener.mock.calls
      .find(call => call[0] === 'message')?.[1]
    
    if (messageHandler) {
      await act(async () => {
        // Send 3 messages
        for (let i = 0; i < 3; i++) {
          messageHandler({
            source: iframeRef.current.contentWindow,
            data: {
              type: 'console',
              method: 'log',
              message: `Message ${i}`
            }
          })
        }
      })
      
      expect(result.current.messages).toHaveLength(2)
      expect(result.current.messages[0].message).toBe('Message 1')
      expect(result.current.messages[1].message).toBe('Message 2')
    }
  })

  it('should clear messages when clearMessages is called', async () => {
    const iframeRef = createMockIframe()
    
    const { result } = renderHook(() => useIframeConsole(iframeRef))
    
    const messageHandler = mockWindowAddEventListener.mock.calls
      .find(call => call[0] === 'message')?.[1]
    
    if (messageHandler) {
      await act(async () => {
        // Add a message
        messageHandler({
          source: iframeRef.current.contentWindow,
          data: {
            type: 'console',
            method: 'log',
            message: 'Test message'
          }
        })
      })
      
      expect(result.current.messages).toHaveLength(1)
      
      act(() => {
        // Clear messages
        result.current.clearMessages()
      })
      
      expect(result.current.messages).toHaveLength(0)
    }
  })

  it('should clean up event listeners on unmount', () => {
    const iframeRef = createMockIframe()
    
    const { unmount } = renderHook(() => useIframeConsole(iframeRef))
    
    unmount()
    
    expect(mockWindowRemoveEventListener).toHaveBeenCalledWith('message', expect.any(Function))
    expect(mockRemoveEventListener).toHaveBeenCalledWith('load', expect.any(Function))
  })

  it('should handle iframe load event', () => {
    const iframeRef = createMockIframe()
    const mockCreateElement = jest.fn().mockReturnValue({
      textContent: ''
    })
    const mockInsertBefore = jest.fn()
    
    iframeRef.current.contentWindow.document.createElement = mockCreateElement
    iframeRef.current.contentWindow.document.head.insertBefore = mockInsertBefore
    
    renderHook(() => useIframeConsole(iframeRef))
    
    // Get and trigger the load handler
    const loadHandler = mockAddEventListener.mock.calls.find(call => call[0] === 'load')?.[1]
    expect(loadHandler).toBeDefined()
    
    if (loadHandler) {
      // Use a timer to simulate the setTimeout in the actual code
      jest.useFakeTimers()
      
      loadHandler()
      
      // Fast-forward time to trigger the setTimeout
      jest.advanceTimersByTime(100)
      
      expect(mockCreateElement).toHaveBeenCalledWith('script')
      expect(mockInsertBefore).toHaveBeenCalled()
      
      jest.useRealTimers()
    }
  })

  it('should prevent injection when contentWindow is not available', () => {
    const iframeRef = {
      current: {
        contentWindow: null,
        contentDocument: { readyState: 'complete' },
        addEventListener: mockAddEventListener,
        removeEventListener: mockRemoveEventListener
      } as any
    }
    
    expect(() => {
      renderHook(() => useIframeConsole(iframeRef))
      
      // Trigger load handler
      const loadHandler = mockAddEventListener.mock.calls.find(call => call[0] === 'load')?.[1]
      if (loadHandler) {
        loadHandler()
      }
    }).not.toThrow()
  })
}) 