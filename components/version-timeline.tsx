'use client'

import { useState, useEffect, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { 
  GitBranch, 
  GitCommit, 
  GitMerge, 
  Clock, 
  User, 
  Tag, 
  Star,
  ArrowRight,
  Circle,
  ChevronRight,
  ChevronDown,
  Code,
  FileText,
  Plus,
  Minus,
  RotateCw
} from 'lucide-react'
import { 
  AppVersion, 
  VersionBranch, 
  VersionTree 
} from '@/lib/storage/enhanced-version-system'

interface TimelineNode {
  version: AppVersion
  branch: VersionBranch
  x: number
  y: number
  connections: {
    to: string
    type: 'parent' | 'merge' | 'branch'
    path: string
  }[]
}

interface VersionTimelineProps {
  versionTree: VersionTree
  selectedVersion?: string
  onVersionSelect?: (versionId: string) => void
  onBranchSelect?: (branchId: string) => void
  showDetails?: boolean
  maxHeight?: number
  className?: string
}

export function VersionTimeline({
  versionTree,
  selectedVersion,
  onVersionSelect,
  onBranchSelect,
  showDetails = true,
  maxHeight = 600,
  className
}: VersionTimelineProps) {
  const [hoveredVersion, setHoveredVersion] = useState<string | null>(null)
  const [expandedVersions, setExpandedVersions] = useState<Set<string>>(new Set())
  const [viewMode, setViewMode] = useState<'tree' | 'linear'>('tree')

  // Calculate timeline layout
  const timelineData = useMemo(() => {
    return calculateTimelineLayout(versionTree)
  }, [versionTree])

  // Format relative time
  const formatRelativeTime = (timestamp: number) => {
    const now = Date.now()
    const diff = now - timestamp
    const seconds = Math.floor(diff / 1000)
    const minutes = Math.floor(seconds / 60)
    const hours = Math.floor(minutes / 60)
    const days = Math.floor(hours / 24)

    if (days > 0) return `${days}d ago`
    if (hours > 0) return `${hours}h ago`
    if (minutes > 0) return `${minutes}m ago`
    return 'Just now'
  }

  // Toggle version details
  const toggleVersionDetails = (versionId: string) => {
    setExpandedVersions(prev => {
      const newSet = new Set(prev)
      if (newSet.has(versionId)) {
        newSet.delete(versionId)
      } else {
        newSet.add(versionId)
      }
      return newSet
    })
  }

  // Get branch by ID
  const getBranchById = (branchId: string) => {
    return versionTree.branches.find(b => b.id === branchId)
  }

  // Get version status icon
  const getVersionStatusIcon = (version: AppVersion) => {
    if (version.mergeInfo?.isMergeCommit) {
      return <GitMerge className="h-4 w-4" />
    }
    if (version.metadata.tags?.includes('stable')) {
      return <Star className="h-4 w-4 text-yellow-500" />
    }
    return <GitCommit className="h-4 w-4" />
  }

  // Render tree view
  const renderTreeView = () => (
    <div className="relative">
      <svg 
        width="100%" 
        height={Math.max(timelineData.height + 40, 200)}
        className="absolute top-0 left-0 pointer-events-none"
        style={{ zIndex: 1 }}
      >
        {/* Render connection lines */}
        {timelineData.nodes.map(node => 
          node.connections.map((connection, index) => {
            const targetNode = timelineData.nodes.find(n => n.version.id === connection.to)
            if (!targetNode) return null

            return (
              <line
                key={`${node.version.id}-${connection.to}-${index}`}
                x1={node.x + 12}
                y1={node.y + 12}
                x2={targetNode.x + 12}
                y2={targetNode.y + 12}
                stroke={node.branch.color}
                strokeWidth="2"
                strokeDasharray={connection.type === 'merge' ? '5,5' : undefined}
                opacity={0.6}
              />
            )
          })
        )}
      </svg>

      <div className="relative" style={{ zIndex: 2 }}>
        {timelineData.nodes.map(node => (
          <div
            key={node.version.id}
            className="absolute"
            style={{
              left: node.x,
              top: node.y,
              transform: 'translate(-50%, -50%)'
            }}
          >
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div
                    className={`relative cursor-pointer group ${
                      selectedVersion === node.version.id ? 'z-10' : ''
                    }`}
                    onClick={() => onVersionSelect?.(node.version.id)}
                    onMouseEnter={() => setHoveredVersion(node.version.id)}
                    onMouseLeave={() => setHoveredVersion(null)}
                  >
                    {/* Branch line */}
                    <div 
                      className="w-1 h-16 absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2"
                      style={{ backgroundColor: node.branch.color, opacity: 0.3 }}
                    />
                    
                    {/* Version node */}
                    <div 
                      className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
                        selectedVersion === node.version.id
                          ? 'bg-white border-blue-500 shadow-lg scale-125'
                          : hoveredVersion === node.version.id
                          ? 'bg-white border-gray-400 shadow-md scale-110'
                          : 'bg-white border-gray-300'
                      }`}
                      style={{
                        borderColor: selectedVersion === node.version.id ? '#3b82f6' : node.branch.color
                      }}
                    >
                      <div 
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: node.branch.color }}
                      />
                    </div>

                    {/* Version info card (on hover/selection) */}
                    {(hoveredVersion === node.version.id || selectedVersion === node.version.id) && (
                      <Card className="absolute left-8 top-0 w-64 shadow-lg z-20 pointer-events-auto">
                        <CardContent className="p-3">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              {getVersionStatusIcon(node.version)}
                              <span className="font-medium text-sm">
                                {node.version.versionNumber}
                              </span>
                            </div>
                            <Badge 
                              variant="secondary" 
                              className="text-xs"
                              style={{ backgroundColor: node.branch.color + '20', color: node.branch.color }}
                            >
                              {node.branch.name}
                            </Badge>
                          </div>
                          
                          <div className="text-sm text-muted-foreground mb-2">
                            {node.version.metadata.message}
                          </div>
                          
                          <div className="flex items-center gap-4 text-xs text-muted-foreground mb-2">
                            <div className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {formatRelativeTime(node.version.metadata.timestamp)}
                            </div>
                            {node.version.metadata.author && (
                              <div className="flex items-center gap-1">
                                <User className="h-3 w-3" />
                                {node.version.metadata.author}
                              </div>
                            )}
                          </div>

                          {/* Change stats */}
                          <div className="flex items-center gap-3 text-xs">
                            <div className="flex items-center gap-1 text-green-600">
                              <Plus className="h-3 w-3" />
                              {node.version.metadata.changes.additions}
                            </div>
                            <div className="flex items-center gap-1 text-red-600">
                              <Minus className="h-3 w-3" />
                              {node.version.metadata.changes.deletions}
                            </div>
                            <div className="flex items-center gap-1 text-blue-600">
                              <RotateCw className="h-3 w-3" />
                              {node.version.metadata.changes.modifications}
                            </div>
                          </div>

                          {/* Tags */}
                          {node.version.metadata.tags && node.version.metadata.tags.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-2">
                              {node.version.metadata.tags.map(tag => (
                                <Badge key={tag} variant="outline" className="text-xs">
                                  <Tag className="h-2 w-2 mr-1" />
                                  {tag}
                                </Badge>
                              ))}
                            </div>
                          )}

                          {/* Expand button for details */}
                          <Button
                            variant="ghost"
                            size="sm"
                            className="w-full mt-2 h-6 text-xs"
                            onClick={(e) => {
                              e.stopPropagation()
                              toggleVersionDetails(node.version.id)
                            }}
                          >
                            {expandedVersions.has(node.version.id) ? (
                              <>
                                <ChevronDown className="h-3 w-3 mr-1" />
                                Less
                              </>
                            ) : (
                              <>
                                <ChevronRight className="h-3 w-3 mr-1" />
                                More
                              </>
                            )}
                          </Button>
                        </CardContent>
                      </Card>
                    )}
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <div className="text-xs">
                    <div className="font-medium">{node.version.versionNumber}</div>
                    <div>{node.version.metadata.message}</div>
                    <div className="text-muted-foreground">
                      {formatRelativeTime(node.version.metadata.timestamp)}
                    </div>
                  </div>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        ))}
      </div>
    </div>
  )

  // Render linear view
  const renderLinearView = () => {
    const sortedVersions = [...versionTree.versions].sort(
      (a, b) => b.internalVersion - a.internalVersion
    )

    return (
      <div className="space-y-2">
        {sortedVersions.map((version, index) => {
          const branch = getBranchById(version.branchId)
          if (!branch) return null

          return (
            <Card 
              key={version.id}
              className={`cursor-pointer transition-all hover:shadow-md ${
                selectedVersion === version.id ? 'ring-2 ring-blue-500' : ''
              }`}
              onClick={() => onVersionSelect?.(version.id)}
            >
              <CardContent className="p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div 
                      className="w-4 h-4 rounded-full"
                      style={{ backgroundColor: branch.color }}
                    />
                    <div>
                      <div className="flex items-center gap-2">
                        {getVersionStatusIcon(version)}
                        <span className="font-medium">{version.versionNumber}</span>
                        <Badge variant="outline" className="text-xs">
                          {branch.name}
                        </Badge>
                        {version.metadata.tags?.map(tag => (
                          <Badge key={tag} variant="secondary" className="text-xs">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                      <div className="text-sm text-muted-foreground mt-1">
                        {version.metadata.message}
                      </div>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground mt-1">
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatRelativeTime(version.metadata.timestamp)}
                        </div>
                        {version.metadata.author && (
                          <div className="flex items-center gap-1">
                            <User className="h-3 w-3" />
                            {version.metadata.author}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3 text-xs">
                    <div className="flex items-center gap-1 text-green-600">
                      <Plus className="h-3 w-3" />
                      {version.metadata.changes.additions}
                    </div>
                    <div className="flex items-center gap-1 text-red-600">
                      <Minus className="h-3 w-3" />
                      {version.metadata.changes.deletions}
                    </div>
                    <div className="flex items-center gap-1 text-blue-600">
                      <RotateCw className="h-3 w-3" />
                      {version.metadata.changes.modifications}
                    </div>
                  </div>
                </div>

                {/* Expanded details */}
                {expandedVersions.has(version.id) && (
                  <div className="mt-3 pt-3 border-t">
                    {version.metadata.description && (
                      <div className="text-sm text-muted-foreground mb-2">
                        {version.metadata.description}
                      </div>
                    )}
                    
                    {version.diffFromParent && (
                      <div className="text-xs">
                        <div className="font-medium mb-1">Changes:</div>
                        <div className="space-y-1">
                          {version.diffFromParent.fileChanges.map((fileChange, idx) => (
                            <div key={idx} className="flex items-center gap-2">
                              <FileText className="h-3 w-3" />
                              <span>{fileChange.file}</span>
                              <Badge variant="outline" className="text-xs">
                                {fileChange.type}
                              </Badge>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {version.mergeInfo && (
                      <div className="text-xs mt-2">
                        <div className="font-medium mb-1">Merge Info:</div>
                        <div className="text-muted-foreground">
                          Merged from {version.mergeInfo.mergedFromBranch} 
                          ({version.mergeInfo.mergedFromVersion})
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>
    )
  }

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <GitBranch className="h-5 w-5" />
            Version Timeline
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button
              variant={viewMode === 'tree' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewMode('tree')}
              className="h-8"
            >
              Tree
            </Button>
            <Button
              variant={viewMode === 'linear' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewMode('linear')}
              className="h-8"
            >
              Linear
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        <ScrollArea style={{ height: maxHeight }}>
          <div className="p-4">
            {viewMode === 'tree' ? renderTreeView() : renderLinearView()}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  )
}

// Helper function to calculate timeline layout
function calculateTimelineLayout(versionTree: VersionTree): {
  nodes: TimelineNode[]
  width: number
  height: number
} {
  const nodes: TimelineNode[] = []
  const branchPositions = new Map<string, number>()
  
  // Assign horizontal positions to branches
  versionTree.branches.forEach((branch, index) => {
    branchPositions.set(branch.id, index * 80 + 40)
  })

  // Sort versions by internal version number
  const sortedVersions = [...versionTree.versions].sort(
    (a, b) => a.internalVersion - b.internalVersion
  )

  // Calculate positions
  sortedVersions.forEach((version, index) => {
    const branch = versionTree.branches.find(b => b.id === version.branchId)
    if (!branch) return

    const x = branchPositions.get(version.branchId) || 0
    const y = index * 60 + 40

    // Find connections
    const connections: TimelineNode['connections'] = []
    
    if (version.parentVersionId) {
      connections.push({
        to: version.parentVersionId,
        type: 'parent',
        path: `M${x},${y} L${x},${y - 60}`
      })
    }

    if (version.mergeInfo) {
      const mergeFromVersion = versionTree.versions.find(v => 
        v.versionNumber === version.mergeInfo?.mergedFromVersion
      )
      if (mergeFromVersion) {
        connections.push({
          to: mergeFromVersion.id,
          type: 'merge',
          path: `M${x},${y} Q${x + 20},${y - 30} ${branchPositions.get(mergeFromVersion.branchId) || 0},${y - 60}`
        })
      }
    }

    nodes.push({
      version,
      branch,
      x,
      y,
      connections
    })
  })

  const width = Math.max(...Array.from(branchPositions.values())) + 80
  const height = sortedVersions.length * 60 + 80

  return { nodes, width, height }
} 