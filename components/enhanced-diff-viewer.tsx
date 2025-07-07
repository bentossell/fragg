'use client'

import { useState, useEffect, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Progress } from '@/components/ui/progress'
import { 
  ChevronDown, 
  ChevronRight, 
  Plus, 
  Minus, 
  RotateCw,
  GitCommit,
  FileText,
  Code,
  Zap,
  Eye,
  EyeOff,
  Copy,
  Download
} from 'lucide-react'
import { VersionComparison } from '@/lib/storage/enhanced-version-system'

interface DiffLine {
  type: 'add' | 'remove' | 'modify' | 'context'
  oldLineNumber?: number
  newLineNumber?: number
  content: string
  isImportant?: boolean
}

interface DiffHunk {
  oldStart: number
  oldLines: number
  newStart: number
  newLines: number
  lines: DiffLine[]
}

interface SemanticChange {
  type: 'function_added' | 'function_removed' | 'function_modified' | 'import_added' | 'import_removed' | 'style_changed' | 'component_added' | 'component_removed'
  description: string
  location: string
  severity: 'low' | 'medium' | 'high'
  impact: string
}

interface EnhancedDiffViewerProps {
  comparison: VersionComparison
  showLineNumbers?: boolean
  showSemanticChanges?: boolean
  highlightSyntax?: boolean
  className?: string
}

export function EnhancedDiffViewer({
  comparison,
  showLineNumbers = true,
  showSemanticChanges = true,
  highlightSyntax = true,
  className
}: EnhancedDiffViewerProps) {
  const [activeTab, setActiveTab] = useState<'unified' | 'split' | 'semantic'>('unified')
  const [expandedHunks, setExpandedHunks] = useState<Set<number>>(new Set())
  const [showWhitespace, setShowWhitespace] = useState(false)
  const [selectedLines, setSelectedLines] = useState<Set<number>>(new Set())

  // Parse unified diff into structured format
  const parsedDiff = useMemo(() => {
    return parseUnifiedDiff(comparison.diff.unified)
  }, [comparison.diff.unified])

  // Analyze semantic changes
  const semanticChanges = useMemo(() => {
    return analyzeSemanticChanges(comparison.versionA.code, comparison.versionB.code)
  }, [comparison.versionA.code, comparison.versionB.code])

  // Toggle hunk expansion
  const toggleHunkExpansion = (hunkIndex: number) => {
    setExpandedHunks(prev => {
      const newSet = new Set(prev)
      if (newSet.has(hunkIndex)) {
        newSet.delete(hunkIndex)
      } else {
        newSet.add(hunkIndex)
      }
      return newSet
    })
  }

  // Toggle line selection
  const toggleLineSelection = (lineIndex: number) => {
    setSelectedLines(prev => {
      const newSet = new Set(prev)
      if (newSet.has(lineIndex)) {
        newSet.delete(lineIndex)
      } else {
        newSet.add(lineIndex)
      }
      return newSet
    })
  }

  // Copy diff to clipboard
  const copyDiffToClipboard = () => {
    navigator.clipboard.writeText(comparison.diff.unified)
  }

  // Download diff as file
  const downloadDiff = () => {
    const blob = new Blob([comparison.diff.unified], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `diff-${comparison.versionA.versionNumber}-${comparison.versionB.versionNumber}.diff`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <GitCommit className="h-5 w-5" />
            Diff Viewer
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={copyDiffToClipboard}
              className="h-8"
            >
              <Copy className="h-4 w-4 mr-1" />
              Copy
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={downloadDiff}
              className="h-8"
            >
              <Download className="h-4 w-4 mr-1" />
              Download
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowWhitespace(!showWhitespace)}
              className="h-8"
            >
              {showWhitespace ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </Button>
          </div>
        </div>
        
        {/* Diff stats */}
        <div className="flex items-center gap-4 text-sm">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-green-500 rounded-full" />
            <span>+{comparison.diff.stats.additions} additions</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-red-500 rounded-full" />
            <span>-{comparison.diff.stats.deletions} deletions</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-blue-500 rounded-full" />
            <span>{comparison.diff.stats.modifications} modifications</span>
          </div>
          <div className="flex items-center gap-1">
            <FileText className="h-4 w-4" />
            <span>{comparison.diff.stats.filesChanged} files</span>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as any)}>
          <div className="px-4">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="unified">Unified</TabsTrigger>
              <TabsTrigger value="split">Split</TabsTrigger>
              <TabsTrigger value="semantic">Semantic</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="unified" className="p-4">
            <ScrollArea className="h-[500px]">
              <div className="space-y-2">
                {parsedDiff.map((hunk, hunkIndex) => (
                  <Card key={hunkIndex} className="overflow-hidden">
                    <div 
                      className="flex items-center justify-between p-2 bg-muted/50 cursor-pointer hover:bg-muted/70"
                      onClick={() => toggleHunkExpansion(hunkIndex)}
                    >
                      <div className="flex items-center gap-2">
                        {expandedHunks.has(hunkIndex) ? 
                          <ChevronDown className="h-4 w-4" /> : 
                          <ChevronRight className="h-4 w-4" />
                        }
                        <code className="text-sm font-mono">
                          @@ -{hunk.oldStart},{hunk.oldLines} +{hunk.newStart},{hunk.newLines} @@
                        </code>
                      </div>
                      <div className="flex items-center gap-2 text-xs">
                        <span className="text-green-600">
                          +{hunk.lines.filter(l => l.type === 'add').length}
                        </span>
                        <span className="text-red-600">
                          -{hunk.lines.filter(l => l.type === 'remove').length}
                        </span>
                      </div>
                    </div>
                    
                    {expandedHunks.has(hunkIndex) && (
                      <div className="font-mono text-sm">
                        {hunk.lines.map((line, lineIndex) => (
                          <div
                            key={lineIndex}
                            className={`flex items-center hover:bg-muted/30 cursor-pointer ${
                              selectedLines.has(lineIndex) ? 'bg-muted/50' : ''
                            } ${
                              line.type === 'add' ? 'bg-green-50 dark:bg-green-900/20' :
                              line.type === 'remove' ? 'bg-red-50 dark:bg-red-900/20' :
                              line.type === 'modify' ? 'bg-blue-50 dark:bg-blue-900/20' :
                              ''
                            }`}
                            onClick={() => toggleLineSelection(lineIndex)}
                          >
                            {showLineNumbers && (
                              <div className="flex-shrink-0 w-20 px-2 py-1 text-xs text-muted-foreground border-r">
                                <span className="inline-block w-8 text-right">
                                  {line.oldLineNumber || ''}
                                </span>
                                <span className="inline-block w-8 text-right">
                                  {line.newLineNumber || ''}
                                </span>
                              </div>
                            )}
                            <div className="flex-shrink-0 w-6 px-1 py-1 text-center">
                              {line.type === 'add' ? (
                                <Plus className="h-3 w-3 text-green-600 mx-auto" />
                              ) : line.type === 'remove' ? (
                                <Minus className="h-3 w-3 text-red-600 mx-auto" />
                              ) : line.type === 'modify' ? (
                                <RotateCw className="h-3 w-3 text-blue-600 mx-auto" />
                              ) : (
                                <span className="text-muted-foreground">·</span>
                              )}
                            </div>
                            <div className="flex-1 px-2 py-1 overflow-x-auto">
                              <code className={`whitespace-pre ${showWhitespace ? 'whitespace-pre-wrap' : ''}`}>
                                {highlightSyntax ? highlightCode(line.content) : line.content}
                              </code>
                            </div>
                            {line.isImportant && (
                              <div className="flex-shrink-0 px-2">
                                <Badge variant="outline" className="text-xs">Important</Badge>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </Card>
                ))}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="split" className="p-4">
            <div className="grid grid-cols-2 gap-4 h-[500px]">
              <Card className="overflow-hidden">
                <div className="bg-red-50 dark:bg-red-900/20 p-2 border-b">
                  <div className="font-medium text-sm">
                    Version {comparison.versionA.versionNumber} (Before)
                  </div>
                </div>
                <ScrollArea className="h-[450px]">
                  <pre className="p-4 text-sm font-mono whitespace-pre-wrap">
                    {JSON.stringify(comparison.versionA.code, null, 2)}
                  </pre>
                </ScrollArea>
              </Card>
              
              <Card className="overflow-hidden">
                <div className="bg-green-50 dark:bg-green-900/20 p-2 border-b">
                  <div className="font-medium text-sm">
                    Version {comparison.versionB.versionNumber} (After)
                  </div>
                </div>
                <ScrollArea className="h-[450px]">
                  <pre className="p-4 text-sm font-mono whitespace-pre-wrap">
                    {JSON.stringify(comparison.versionB.code, null, 2)}
                  </pre>
                </ScrollArea>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="semantic" className="p-4">
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Zap className="h-5 w-5 text-yellow-500" />
                <span className="font-medium">Semantic Changes</span>
                <Badge variant="outline">{semanticChanges.length} changes</Badge>
              </div>
              
              <ScrollArea className="h-[450px]">
                <div className="space-y-3">
                  {semanticChanges.map((change, index) => (
                    <Card key={index} className="p-3">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge 
                              variant={change.severity === 'high' ? 'destructive' : 
                                     change.severity === 'medium' ? 'default' : 'secondary'}
                              className="text-xs"
                            >
                              {change.severity}
                            </Badge>
                            <span className="font-medium text-sm">{change.type.replace('_', ' ')}</span>
                          </div>
                          <div className="text-sm text-muted-foreground mb-1">
                            {change.description}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Location: {change.location}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Impact: {change.impact}
                          </div>
                        </div>
                      </div>
                    </Card>
                  ))}
                  
                  {semanticChanges.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      No semantic changes detected
                    </div>
                  )}
                </div>
              </ScrollArea>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}

// Helper functions

function parseUnifiedDiff(unifiedDiff: string): DiffHunk[] {
  const lines = unifiedDiff.split('\n')
  const hunks: DiffHunk[] = []
  let currentHunk: DiffHunk | null = null
  let oldLineNumber = 0
  let newLineNumber = 0

  for (const line of lines) {
    // Skip file headers
    if (line.startsWith('---') || line.startsWith('+++')) {
      continue
    }

    // Parse hunk header
    const hunkMatch = line.match(/^@@ -(\d+),(\d+) \+(\d+),(\d+) @@/)
    if (hunkMatch) {
      if (currentHunk) {
        hunks.push(currentHunk)
      }
      
      const [, oldStart, oldLines, newStart, newLines] = hunkMatch
      currentHunk = {
        oldStart: parseInt(oldStart),
        oldLines: parseInt(oldLines),
        newStart: parseInt(newStart),
        newLines: parseInt(newLines),
        lines: []
      }
      oldLineNumber = parseInt(oldStart)
      newLineNumber = parseInt(newStart)
      continue
    }

    // Parse diff lines
    if (currentHunk) {
      const diffLine: DiffLine = {
        type: 'context',
        content: line.slice(1) || line
      }

      if (line.startsWith('+')) {
        diffLine.type = 'add'
        diffLine.newLineNumber = newLineNumber++
      } else if (line.startsWith('-')) {
        diffLine.type = 'remove'
        diffLine.oldLineNumber = oldLineNumber++
      } else {
        diffLine.type = 'context'
        diffLine.oldLineNumber = oldLineNumber++
        diffLine.newLineNumber = newLineNumber++
      }

      // Mark important lines
      if (diffLine.content.includes('function') || 
          diffLine.content.includes('import') ||
          diffLine.content.includes('export') ||
          diffLine.content.includes('const') ||
          diffLine.content.includes('let') ||
          diffLine.content.includes('var')) {
        diffLine.isImportant = true
      }

      currentHunk.lines.push(diffLine)
    }
  }

  if (currentHunk) {
    hunks.push(currentHunk)
  }

  return hunks
}

function analyzeSemanticChanges(codeA: any, codeB: any): SemanticChange[] {
  const changes: SemanticChange[] = []
  
  // Convert to strings for analysis
  const strA = JSON.stringify(codeA, null, 2)
  const strB = JSON.stringify(codeB, null, 2)
  
  // Simple semantic analysis - in a real implementation, this would use AST parsing
  const linesA = strA.split('\n')
  const linesB = strB.split('\n')
  
  // Check for function changes
  const functionsA = linesA.filter(line => line.includes('function') || line.includes('=>'))
  const functionsB = linesB.filter(line => line.includes('function') || line.includes('=>'))
  
  if (functionsA.length !== functionsB.length) {
    changes.push({
      type: functionsA.length > functionsB.length ? 'function_removed' : 'function_added',
      description: `${Math.abs(functionsA.length - functionsB.length)} function(s) ${functionsA.length > functionsB.length ? 'removed' : 'added'}`,
      location: 'Global scope',
      severity: 'medium',
      impact: 'May affect functionality'
    })
  }
  
  // Check for import changes
  const importsA = linesA.filter(line => line.includes('import'))
  const importsB = linesB.filter(line => line.includes('import'))
  
  if (importsA.length !== importsB.length) {
    changes.push({
      type: importsA.length > importsB.length ? 'import_removed' : 'import_added',
      description: `${Math.abs(importsA.length - importsB.length)} import(s) ${importsA.length > importsB.length ? 'removed' : 'added'}`,
      location: 'File header',
      severity: 'low',
      impact: 'Dependencies changed'
    })
  }
  
  // Check for component changes
  const componentsA = linesA.filter(line => line.includes('component') || line.includes('Component'))
  const componentsB = linesB.filter(line => line.includes('component') || line.includes('Component'))
  
  if (componentsA.length !== componentsB.length) {
    changes.push({
      type: componentsA.length > componentsB.length ? 'component_removed' : 'component_added',
      description: `${Math.abs(componentsA.length - componentsB.length)} component(s) ${componentsA.length > componentsB.length ? 'removed' : 'added'}`,
      location: 'Component tree',
      severity: 'high',
      impact: 'UI structure changed'
    })
  }
  
  return changes
}

function highlightCode(code: string): string {
  // Simple syntax highlighting - in a real implementation, use a proper syntax highlighter
  return code
    .replace(/\b(function|const|let|var|import|export|return|if|else|for|while)\b/g, '<span class="text-purple-600">$1</span>')
    .replace(/\b(true|false|null|undefined)\b/g, '<span class="text-blue-600">$1</span>')
    .replace(/["'`]([^"'`]*?)["'`]/g, '<span class="text-green-600">"$1"</span>')
    .replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '<span class="text-gray-500">$&</span>')
} 