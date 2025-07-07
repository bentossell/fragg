'use client'

import React, { useEffect, useRef } from 'react'
import { Button } from './ui/button'
import { Trash2 } from 'lucide-react'

export interface LogEntry {
  type: 'log' | 'error' | 'warn' | 'info'
  message: string
  timestamp: string
}

interface BrowserConsoleProps {
  logs: LogEntry[]
  className?: string
  onClear?: () => void
}

export function BrowserConsole({ logs, className = '', onClear }: BrowserConsoleProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom when new logs are added
  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight
    }
  }, [logs])

  // Get color classes based on log type
  const getLogTypeColor = (type: LogEntry['type']) => {
    switch (type) {
      case 'error':
        return 'text-red-400'
      case 'warn':
        return 'text-yellow-400'
      case 'info':
        return 'text-blue-400'
      case 'log':
      default:
        return 'text-gray-300'
    }
  }

  // Get log type prefix
  const getLogTypePrefix = (type: LogEntry['type']) => {
    switch (type) {
      case 'error':
        return '[ERROR]'
      case 'warn':
        return '[WARN]'
      case 'info':
        return '[INFO]'
      case 'log':
      default:
        return '[LOG]'
    }
  }

  return (
    <div className={`relative flex flex-col bg-gray-900 ${className}`}>
      {/* Header with clear button */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-700">
        <h3 className="text-sm font-medium text-gray-300">Console</h3>
        {onClear && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onClear}
            className="h-7 px-2 text-gray-400 hover:text-gray-200 hover:bg-gray-800"
            title="Clear console"
          >
            <Trash2 className="h-4 w-4" />
            <span className="ml-1 text-xs">Clear</span>
          </Button>
        )}
      </div>

      {/* Console content */}
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto overflow-x-hidden p-3 font-mono text-xs"
      >
        {logs.length === 0 ? (
          <div className="text-gray-500 italic">Console output will appear here...</div>
        ) : (
          logs.map((log, index) => (
            <div
              key={index}
              className={`mb-1.5 break-words ${getLogTypeColor(log.type)}`}
            >
              {/* Timestamp */}
              <span className="text-gray-500 mr-2">
                [{log.timestamp}]
              </span>
              
              {/* Log type prefix */}
              <span className={`font-semibold mr-2 ${getLogTypeColor(log.type)}`}>
                {getLogTypePrefix(log.type)}
              </span>
              
              {/* Message - preserve whitespace and line breaks */}
              <span className="whitespace-pre-wrap">
                {log.message}
              </span>
            </div>
          ))
        )}
      </div>

      {/* Optional status bar */}
      <div className="px-3 py-1 border-t border-gray-700 bg-gray-850">
        <span className="text-xs text-gray-500">
          {logs.length} {logs.length === 1 ? 'entry' : 'entries'}
        </span>
      </div>
    </div>
  )
}

// Export type for use in other components
export type { LogEntry } 