'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useLocalStorage } from 'usehooks-ts'
import { cn } from '@/lib/utils'
import { Button } from './ui/button'
import { 
  PanelLeft, 
  PanelRight, 
  Maximize2, 
  Minimize2,
  ChevronLeft,
  ChevronRight,
  Monitor,
  Code
} from 'lucide-react'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from './ui/tooltip'

interface DualPanelLayoutProps {
  leftPanel: React.ReactNode
  rightPanel: React.ReactNode
  leftPanelTitle?: string
  rightPanelTitle?: string
  leftPanelIcon?: React.ReactNode
  rightPanelIcon?: React.ReactNode
  defaultSplit?: number // 0-100 percentage
  minPanelSize?: number // minimum percentage
  className?: string
  onSplitChange?: (split: number) => void
  leftPanelCollapsed?: boolean
  rightPanelCollapsed?: boolean
  onLeftPanelToggle?: (collapsed: boolean) => void
  onRightPanelToggle?: (collapsed: boolean) => void
  showPanelControls?: boolean
  isMobile?: boolean
}

export function DualPanelLayout({
  leftPanel,
  rightPanel,
  leftPanelTitle = 'Code',
  rightPanelTitle = 'Preview',
  leftPanelIcon = <Code className="h-4 w-4" />,
  rightPanelIcon = <Monitor className="h-4 w-4" />,
  defaultSplit = 50,
  minPanelSize = 20,
  className,
  onSplitChange,
  leftPanelCollapsed = false,
  rightPanelCollapsed = false,
  onLeftPanelToggle,
  onRightPanelToggle,
  showPanelControls = true,
  isMobile = false,
}: DualPanelLayoutProps) {
  const [splitPosition, setSplitPosition] = useLocalStorage('dual-panel-split', defaultSplit)
  const [isDragging, setIsDragging] = useState(false)
  const [isLeftMaximized, setIsLeftMaximized] = useState(false)
  const [isRightMaximized, setIsRightMaximized] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const splitterRef = useRef<HTMLDivElement>(null)
  
  // Handle split position changes
  const handleSplitChange = useCallback((newSplit: number) => {
    const clampedSplit = Math.max(minPanelSize, Math.min(100 - minPanelSize, newSplit))
    setSplitPosition(clampedSplit)
    onSplitChange?.(clampedSplit)
  }, [minPanelSize, onSplitChange, setSplitPosition])

  // Mouse/touch handlers for dragging
  const startDragging = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault()
    setIsDragging(true)
    
    const handleMove = (e: MouseEvent | TouchEvent) => {
      if (!containerRef.current) return
      
      const rect = containerRef.current.getBoundingClientRect()
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX
      const x = clientX - rect.left
      const newSplit = (x / rect.width) * 100
      
      handleSplitChange(newSplit)
    }
    
    const handleEnd = () => {
      setIsDragging(false)
      document.removeEventListener('mousemove', handleMove)
      document.removeEventListener('touchmove', handleMove)
      document.removeEventListener('mouseup', handleEnd)
      document.removeEventListener('touchend', handleEnd)
    }
    
    document.addEventListener('mousemove', handleMove)
    document.addEventListener('touchmove', handleMove)
    document.addEventListener('mouseup', handleEnd)
    document.addEventListener('touchend', handleEnd)
  }, [handleSplitChange])

  // Keyboard navigation for splitter
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowLeft') {
      handleSplitChange(splitPosition - 5)
    } else if (e.key === 'ArrowRight') {
      handleSplitChange(splitPosition + 5)
    }
  }, [splitPosition, handleSplitChange])

  // Panel maximization handlers
  const toggleLeftMaximize = useCallback(() => {
    if (isLeftMaximized) {
      setIsLeftMaximized(false)
      setIsRightMaximized(false)
    } else {
      setIsLeftMaximized(true)
      setIsRightMaximized(false)
    }
  }, [isLeftMaximized])

  const toggleRightMaximize = useCallback(() => {
    if (isRightMaximized) {
      setIsLeftMaximized(false)
      setIsRightMaximized(false)
    } else {
      setIsLeftMaximized(false)
      setIsRightMaximized(true)
    }
  }, [isRightMaximized])

  // Calculate actual split positions based on collapsed/maximized state
  const getActualSplit = useCallback(() => {
    if (leftPanelCollapsed) return 0
    if (rightPanelCollapsed) return 100
    if (isLeftMaximized) return 100
    if (isRightMaximized) return 0
    return splitPosition
  }, [leftPanelCollapsed, rightPanelCollapsed, isLeftMaximized, isRightMaximized, splitPosition])

  const actualSplit = getActualSplit()

  // Mobile layout (stacked)
  if (isMobile) {
    return (
      <div className={cn("flex flex-col h-full", className)}>
        {/* Mobile panel controls */}
        <div className="flex items-center justify-between p-2 border-b bg-muted/50">
          <div className="flex items-center gap-2">
            {leftPanelIcon}
            <span className="text-sm font-medium">{leftPanelTitle}</span>
          </div>
          <div className="flex items-center gap-2">
            {rightPanelIcon}
            <span className="text-sm font-medium">{rightPanelTitle}</span>
          </div>
        </div>
        
        {/* Mobile panels - stacked */}
        <div className="flex-1 overflow-hidden">
          <div className="h-1/2 border-b">
            {leftPanel}
          </div>
          <div className="h-1/2">
            {rightPanel}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div 
      ref={containerRef}
      className={cn("flex h-full relative", className)}
    >
      {/* Left Panel */}
      <div 
        className={cn(
          "transition-all duration-300 ease-in-out flex flex-col",
          "border-r bg-background"
        )}
        style={{ 
          width: `${actualSplit}%`,
          display: leftPanelCollapsed ? 'none' : 'flex'
        }}
      >
        {/* Left Panel Header */}
        {showPanelControls && (
          <div className="flex items-center justify-between p-2 border-b bg-muted/50">
            <div className="flex items-center gap-2">
              {leftPanelIcon}
              <span className="text-sm font-medium">{leftPanelTitle}</span>
            </div>
            <div className="flex items-center gap-1">
              <TooltipProvider>
                <Tooltip delayDuration={0}>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={toggleLeftMaximize}
                    >
                      {isLeftMaximized ? (
                        <Minimize2 className="h-3 w-3" />
                      ) : (
                        <Maximize2 className="h-3 w-3" />
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">
                    {isLeftMaximized ? 'Restore' : 'Maximize'}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              
              <TooltipProvider>
                <Tooltip delayDuration={0}>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => onLeftPanelToggle?.(true)}
                    >
                      <ChevronLeft className="h-3 w-3" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">Collapse panel</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>
        )}
        
        {/* Left Panel Content */}
        <div className="flex-1 overflow-hidden">
          {leftPanel}
        </div>
      </div>

      {/* Splitter */}
      {!leftPanelCollapsed && !rightPanelCollapsed && !isLeftMaximized && !isRightMaximized && (
        <div
          ref={splitterRef}
          className={cn(
            "w-1 bg-border hover:bg-muted cursor-col-resize flex-shrink-0 relative group",
            "transition-colors duration-200",
            isDragging && "bg-primary"
          )}
          onMouseDown={startDragging}
          onTouchStart={startDragging}
          onKeyDown={handleKeyDown}
          tabIndex={0}
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize panels"
        >
          {/* Splitter handle */}
          <div className="absolute inset-y-0 -left-1 -right-1 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
            <div className="w-1 h-8 bg-primary rounded-full" />
          </div>
        </div>
      )}

      {/* Right Panel */}
      <div 
        className={cn(
          "transition-all duration-300 ease-in-out flex flex-col",
          "bg-background"
        )}
        style={{ 
          width: `${100 - actualSplit}%`,
          display: rightPanelCollapsed ? 'none' : 'flex'
        }}
      >
        {/* Right Panel Header */}
        {showPanelControls && (
          <div className="flex items-center justify-between p-2 border-b bg-muted/50">
            <div className="flex items-center gap-2">
              {rightPanelIcon}
              <span className="text-sm font-medium">{rightPanelTitle}</span>
            </div>
            <div className="flex items-center gap-1">
              <TooltipProvider>
                <Tooltip delayDuration={0}>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => onRightPanelToggle?.(true)}
                    >
                      <ChevronRight className="h-3 w-3" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">Collapse panel</TooltipContent>
                </Tooltip>
              </TooltipProvider>
              
              <TooltipProvider>
                <Tooltip delayDuration={0}>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={toggleRightMaximize}
                    >
                      {isRightMaximized ? (
                        <Minimize2 className="h-3 w-3" />
                      ) : (
                        <Maximize2 className="h-3 w-3" />
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">
                    {isRightMaximized ? 'Restore' : 'Maximize'}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>
        )}
        
        {/* Right Panel Content */}
        <div className="flex-1 overflow-hidden">
          {rightPanel}
        </div>
      </div>

      {/* Collapsed panel indicators */}
      {leftPanelCollapsed && (
        <div className="w-8 border-r bg-muted/50 flex flex-col items-center py-2">
          <TooltipProvider>
            <Tooltip delayDuration={0}>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => onLeftPanelToggle?.(false)}
                >
                  <PanelLeft className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">Show {leftPanelTitle}</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      )}
      
      {rightPanelCollapsed && (
        <div className="w-8 border-l bg-muted/50 flex flex-col items-center py-2 ml-auto">
          <TooltipProvider>
            <Tooltip delayDuration={0}>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => onRightPanelToggle?.(false)}
                >
                  <PanelRight className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="left">Show {rightPanelTitle}</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      )}
    </div>
  )
} 