import { useEffect, useRef, useState } from 'react'

export interface ConsoleMessage {
  type: 'log' | 'error' | 'warn' | 'info' | 'debug'
  message: string
  timestamp: number
  args?: any[]
}

interface UseIframeConsoleOptions {
  maxMessages?: number
  captureTypes?: ConsoleMessage['type'][]
}

/**
 * Hook to capture console messages from an iframe
 * @param iframeRef - Reference to the iframe element
 * @param options - Configuration options
 * @returns Array of captured console messages and a clear function
 */
export function useIframeConsole(
  iframeRef: React.RefObject<HTMLIFrameElement>,
  options: UseIframeConsoleOptions = {}
) {
  const {
    maxMessages = 100,
    captureTypes = ['log', 'error', 'warn', 'info', 'debug']
  } = options

  const [messages, setMessages] = useState<ConsoleMessage[]>([])
  const messagesRef = useRef<ConsoleMessage[]>([])

  useEffect(() => {
    const iframe = iframeRef.current
    if (!iframe) return

    // Handle messages from iframe
    const handleMessage = (event: MessageEvent) => {
      // Ensure message is from our iframe
      if (event.source !== iframe.contentWindow) return

      // Check if it's a console message
      if (event.data?.type === 'console' && event.data?.method) {
        const method = event.data.method as ConsoleMessage['type']
        
        // Check if we should capture this type
        if (!captureTypes.includes(method)) return

        const newMessage: ConsoleMessage = {
          type: method,
          message: event.data.message || '',
          timestamp: Date.now(),
          args: event.data.args
        }

        // Update messages with max limit
        messagesRef.current = [...messagesRef.current, newMessage].slice(-maxMessages)
        setMessages(messagesRef.current)
      }
    }

    // Inject console capture script into iframe
    const injectConsoleCapture = () => {
      try {
        const iframeWindow = iframe.contentWindow
        if (!iframeWindow) return

        // Create script to override console methods
        const script = iframeWindow.document.createElement('script')
        script.textContent = `
          (function() {
            const originalConsole = window.console;
            const methods = ['log', 'error', 'warn', 'info', 'debug'];
            
            methods.forEach(method => {
              window.console[method] = function(...args) {
                // Call original method
                originalConsole[method].apply(originalConsole, args);
                
                // Send message to parent
                try {
                  window.parent.postMessage({
                    type: 'console',
                    method: method,
                    message: args.map(arg => {
                      if (typeof arg === 'object') {
                        try {
                          return JSON.stringify(arg, null, 2);
                        } catch {
                          return String(arg);
                        }
                      }
                      return String(arg);
                    }).join(' '),
                    args: args
                  }, '*');
                } catch (err) {
                  originalConsole.error('Failed to send console message to parent:', err);
                }
              };
            });
            
            // Capture unhandled errors
            window.addEventListener('error', (event) => {
              window.parent.postMessage({
                type: 'console',
                method: 'error',
                message: \`Uncaught Error: \${event.message} at \${event.filename}:\${event.lineno}:\${event.colno}\`,
                args: [event.error]
              }, '*');
            });
            
            // Capture unhandled promise rejections
            window.addEventListener('unhandledrejection', (event) => {
              window.parent.postMessage({
                type: 'console',
                method: 'error',
                message: \`Unhandled Promise Rejection: \${event.reason}\`,
                args: [event.reason]
              }, '*');
            });
          })();
        `
        
        // Inject script as first element in head or body
        const target = iframeWindow.document.head || iframeWindow.document.body
        if (target) {
          target.insertBefore(script, target.firstChild)
        }
      } catch (error) {
        console.error('Failed to inject console capture:', error)
      }
    }

    // Listen for iframe load event
    const handleIframeLoad = () => {
      // Small delay to ensure iframe is fully loaded
      setTimeout(injectConsoleCapture, 100)
    }

    // Add event listeners
    window.addEventListener('message', handleMessage)
    iframe.addEventListener('load', handleIframeLoad)

    // If iframe is already loaded, inject immediately
    if (iframe.contentDocument?.readyState === 'complete') {
      handleIframeLoad()
    }

    // Cleanup
    return () => {
      window.removeEventListener('message', handleMessage)
      iframe.removeEventListener('load', handleIframeLoad)
    }
  }, [iframeRef, captureTypes, maxMessages])

  // Clear all messages
  const clearMessages = () => {
    messagesRef.current = []
    setMessages([])
  }

  return {
    messages,
    clearMessages
  }
} 