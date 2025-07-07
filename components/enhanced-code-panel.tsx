'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { CodeView } from './code-view'
import { CodeStreaming } from './code-streaming'
import { Button } from './ui/button'
import { CopyButton } from './ui/copy-button'
import { ScrollArea } from './ui/scroll-area'
import { Badge } from './ui/badge'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from './ui/tooltip'
import { 
  Download, 
  FileText, 
  Folder, 
  FolderOpen,
  Search,
  MoreHorizontal,
  Zap,
  Type,
  Hash,
  ChevronRight,
  ChevronDown,
  Code,
  RefreshCw
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Input } from './ui/input'

interface FileNode {
  name: string
  content: string
  type: 'file' | 'folder'
  path: string
  children?: FileNode[]
  isOpen?: boolean
}

interface EnhancedCodePanelProps {
  files: { name: string; content: string }[]
  isStreaming?: boolean
  streamingFile?: string
  currentFile?: string
  onFileSelect?: (fileName: string) => void
  showLineNumbers?: boolean
  showMinimap?: boolean
  enableSearch?: boolean
  readOnly?: boolean
  className?: string
  title?: string
  onRefresh?: () => void
}

// Helper function to build file tree structure
function buildFileTree(files: { name: string; content: string }[]): FileNode[] {
  const tree: FileNode[] = []
  const pathMap = new Map<string, FileNode>()
  
  // Sort files by path depth and name
  const sortedFiles = [...files].sort((a, b) => {
    const depthA = a.name.split('/').length
    const depthB = b.name.split('/').length
    if (depthA !== depthB) return depthA - depthB
    return a.name.localeCompare(b.name)
  })
  
  sortedFiles.forEach(file => {
    const parts = file.name.split('/')
    let currentPath = ''
    
    parts.forEach((part, index) => {
      const isLast = index === parts.length - 1
      const parentPath = currentPath
      currentPath = currentPath ? `${currentPath}/${part}` : part
      
      if (!pathMap.has(currentPath)) {
        const node: FileNode = {
          name: part,
          content: isLast ? file.content : '',
          type: isLast ? 'file' : 'folder',
          path: currentPath,
          children: isLast ? undefined : [],
          isOpen: false
        }
        
        pathMap.set(currentPath, node)
        
        if (parentPath) {
          const parent = pathMap.get(parentPath)
          if (parent && parent.children) {
            parent.children.push(node)
          }
        } else {
          tree.push(node)
        }
      }
    })
  })
  
  return tree
}

// Helper function to get file extension
function getFileExtension(fileName: string): string {
  return fileName.split('.').pop()?.toLowerCase() || 'txt'
}

// Helper function to get language from file extension
function getLanguageFromExtension(ext: string): string {
  const langMap: Record<string, string> = {
    'js': 'javascript',
    'jsx': 'jsx',
    'ts': 'typescript',
    'tsx': 'tsx',
    'py': 'python',
    'html': 'html',
    'css': 'css',
    'json': 'json',
    'md': 'markdown',
    'yaml': 'yaml',
    'yml': 'yaml',
    'xml': 'xml',
    'sql': 'sql',
    'sh': 'bash',
    'rs': 'rust',
    'go': 'go',
    'php': 'php',
    'rb': 'ruby',
    'java': 'java',
    'c': 'c',
    'cpp': 'cpp',
    'h': 'c',
    'hpp': 'cpp',
  }
  return langMap[ext] || 'text'
}

// Helper function to get file icon
function getFileIcon(fileName: string, isFolder: boolean = false, isOpen: boolean = false) {
  if (isFolder) {
    return isOpen ? <FolderOpen className="h-4 w-4" /> : <Folder className="h-4 w-4" />
  }
  
  const ext = getFileExtension(fileName)
  const iconMap: Record<string, React.ReactNode> = {
    'js': <Code className="h-4 w-4 text-yellow-500" />,
    'jsx': <Code className="h-4 w-4 text-blue-500" />,
    'ts': <Code className="h-4 w-4 text-blue-600" />,
    'tsx': <Code className="h-4 w-4 text-blue-600" />,
    'py': <Code className="h-4 w-4 text-green-500" />,
    'html': <Code className="h-4 w-4 text-orange-500" />,
    'css': <Code className="h-4 w-4 text-blue-400" />,
    'json': <Code className="h-4 w-4 text-yellow-600" />,
    'md': <FileText className="h-4 w-4 text-gray-500" />,
  }
  
  return iconMap[ext] || <FileText className="h-4 w-4 text-gray-400" />
}

// Tree node component
function TreeNode({ 
  node, 
  level = 0, 
  currentFile, 
  onFileSelect, 
  onToggleFolder 
}: { 
  node: FileNode
  level?: number
  currentFile?: string
  onFileSelect?: (fileName: string) => void
  onToggleFolder?: (path: string) => void
}) {
  const isSelected = currentFile === node.path
  const hasChildren = node.children && node.children.length > 0
  
  return (
    <div>
      <div
        className={cn(
          "flex items-center gap-2 px-2 py-1 hover:bg-muted/50 cursor-pointer text-sm",
          isSelected && "bg-accent text-accent-foreground",
          "transition-colors"
        )}
        style={{ paddingLeft: `${level * 12 + 8}px` }}
        onClick={() => {
          if (node.type === 'file') {
            onFileSelect?.(node.path)
          } else {
            onToggleFolder?.(node.path)
          }
        }}
      >
        {node.type === 'folder' && hasChildren && (
          <button className="p-0 hover:bg-muted rounded">
            {node.isOpen ? (
              <ChevronDown className="h-3 w-3" />
            ) : (
              <ChevronRight className="h-3 w-3" />
            )}
          </button>
        )}
        {node.type === 'folder' && !hasChildren && (
          <div className="w-3" />
        )}
        
        {getFileIcon(node.name, node.type === 'folder', node.isOpen)}
        <span className="truncate">{node.name}</span>
        
        {node.type === 'file' && (
          <Badge variant="secondary" className="ml-auto text-xs">
            {getFileExtension(node.name)}
          </Badge>
        )}
      </div>
      
      {node.type === 'folder' && node.isOpen && node.children && (
        <div>
          {node.children.map((child, index) => (
            <TreeNode
              key={`${child.path}-${index}`}
              node={child}
              level={level + 1}
              currentFile={currentFile}
              onFileSelect={onFileSelect}
              onToggleFolder={onToggleFolder}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export function EnhancedCodePanel({
  files,
  isStreaming = false,
  streamingFile,
  currentFile,
  onFileSelect,
  showLineNumbers = true,
  showMinimap = false,
  enableSearch = true,
  readOnly = true,
  className,
  title = 'Code',
  onRefresh
}: EnhancedCodePanelProps) {
  const [selectedFile, setSelectedFile] = useState(currentFile || files[0]?.name)
  const [fileTree, setFileTree] = useState<FileNode[]>([])
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set())
  const [searchQuery, setSearchQuery] = useState('')
  const [showSearch, setShowSearch] = useState(false)
  const [view, setView] = useState<'tree' | 'tabs'>('tree')
  const codeRef = useRef<HTMLDivElement>(null)
  
  // Build file tree when files change
  useEffect(() => {
    if (files.length > 0) {
      const tree = buildFileTree(files)
      setFileTree(tree)
      
      // Auto-expand folders if there are few files
      if (files.length <= 5) {
        const allFolders = new Set<string>()
        const collectFolders = (nodes: FileNode[]) => {
          nodes.forEach(node => {
            if (node.type === 'folder') {
              allFolders.add(node.path)
              if (node.children) {
                collectFolders(node.children)
              }
            }
          })
        }
        collectFolders(tree)
        setExpandedFolders(allFolders)
      }
    }
  }, [files])
  
  // Update tree with expanded state
  useEffect(() => {
    const updateTreeState = (nodes: FileNode[]): FileNode[] => {
      return nodes.map(node => ({
        ...node,
        isOpen: expandedFolders.has(node.path),
        children: node.children ? updateTreeState(node.children) : undefined
      }))
    }
    
    setFileTree(prevTree => updateTreeState(prevTree))
  }, [expandedFolders])
  
  // Handle file selection
  const handleFileSelect = useCallback((fileName: string) => {
    setSelectedFile(fileName)
    onFileSelect?.(fileName)
  }, [onFileSelect])
  
  // Handle folder toggle
  const handleToggleFolder = useCallback((path: string) => {
    setExpandedFolders(prev => {
      const newSet = new Set(prev)
      if (newSet.has(path)) {
        newSet.delete(path)
      } else {
        newSet.add(path)
      }
      return newSet
    })
  }, [])
  
  // Get current file content
  const currentFileContent = files.find(f => f.name === selectedFile)?.content || ''
  const currentFileExtension = getFileExtension(selectedFile || '')
  const currentLanguage = getLanguageFromExtension(currentFileExtension)
  
  // Filter files based on search
  const filteredFiles = files.filter(file => 
    file.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    file.content.toLowerCase().includes(searchQuery.toLowerCase())
  )
  
  // Download file
  const downloadFile = useCallback((fileName: string, content: string) => {
    const blob = new Blob([content], { type: 'text/plain' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.style.display = 'none'
    a.href = url
    a.download = fileName
    document.body.appendChild(a)
    a.click()
    window.URL.revokeObjectURL(url)
    document.body.removeChild(a)
  }, [])
  
  // Download all files as zip (simplified version)
  const downloadAllFiles = useCallback(() => {
    // For now, just download the current file
    // In a real implementation, you'd create a zip file
    if (selectedFile && currentFileContent) {
      downloadFile(selectedFile, currentFileContent)
    }
  }, [selectedFile, currentFileContent, downloadFile])
  
  const showFileTree = files.length > 1 && view === 'tree'
  const showTabs = files.length > 1 && view === 'tabs'
  
  return (
    <div className={cn("flex flex-col h-full bg-background", className)}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b bg-muted/50">
        <div className="flex items-center gap-2">
          <Code className="h-4 w-4" />
          <span className="text-sm font-medium">{title}</span>
          {files.length > 1 && (
            <Badge variant="secondary" className="text-xs">
              {files.length} files
            </Badge>
          )}
        </div>
        
        <div className="flex items-center gap-1">
          {files.length > 1 && (
            <div className="flex items-center border rounded-md">
              <Button
                variant={view === 'tree' ? 'default' : 'ghost'}
                size="sm"
                className="h-6 px-2 text-xs"
                onClick={() => setView('tree')}
              >
                Tree
              </Button>
              <Button
                variant={view === 'tabs' ? 'default' : 'ghost'}
                size="sm"
                className="h-6 px-2 text-xs"
                onClick={() => setView('tabs')}
              >
                Tabs
              </Button>
            </div>
          )}
          
          {enableSearch && (
            <TooltipProvider>
              <Tooltip delayDuration={0}>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => setShowSearch(!showSearch)}
                  >
                    <Search className="h-3 w-3" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Search files</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          
          {onRefresh && (
            <TooltipProvider>
              <Tooltip delayDuration={0}>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={onRefresh}
                  >
                    <RefreshCw className="h-3 w-3" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Refresh</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          
          <TooltipProvider>
            <Tooltip delayDuration={0}>
              <TooltipTrigger asChild>
                <CopyButton
                  content={currentFileContent}
                  className="h-7 w-7"
                  variant="ghost"
                />
              </TooltipTrigger>
              <TooltipContent>Copy code</TooltipContent>
            </Tooltip>
          </TooltipProvider>
          
          <TooltipProvider>
            <Tooltip delayDuration={0}>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={downloadAllFiles}
                >
                  <Download className="h-3 w-3" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Download</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>
      
      {/* Search */}
      {showSearch && (
        <div className="px-3 py-2 border-b">
          <Input
            type="text"
            placeholder="Search files and content..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-8"
          />
        </div>
      )}
      
      {/* File Navigation */}
      {showFileTree && (
        <div className="border-b bg-muted/20">
          <ScrollArea className="h-32">
            <div className="py-1">
              {fileTree.map((node, index) => (
                <TreeNode
                  key={`${node.path}-${index}`}
                  node={node}
                  currentFile={selectedFile}
                  onFileSelect={handleFileSelect}
                  onToggleFolder={handleToggleFolder}
                />
              ))}
            </div>
          </ScrollArea>
        </div>
      )}
      
      {/* Tabs */}
      {showTabs && (
        <div className="flex items-center gap-1 px-2 py-1 border-b bg-muted/20 overflow-x-auto">
          {(searchQuery ? filteredFiles : files).map((file) => (
            <button
              key={file.name}
              className={cn(
                "flex items-center gap-2 px-3 py-1 rounded-md text-sm whitespace-nowrap",
                "hover:bg-muted transition-colors",
                selectedFile === file.name && "bg-accent text-accent-foreground"
              )}
              onClick={() => handleFileSelect(file.name)}
            >
              {getFileIcon(file.name)}
              <span className="truncate max-w-32">{file.name}</span>
            </button>
          ))}
        </div>
      )}
      
      {/* Current File Info */}
      {selectedFile && (
        <div className="flex items-center justify-between px-3 py-1 border-b bg-muted/10">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            {getFileIcon(selectedFile)}
            <span className="truncate">{selectedFile}</span>
            <Badge variant="outline" className="text-xs">
              {currentLanguage}
            </Badge>
          </div>
          
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {isStreaming && streamingFile === selectedFile && (
              <div className="flex items-center gap-1">
                <Zap className="h-3 w-3 text-yellow-500" />
                <span>Streaming...</span>
              </div>
            )}
            <span>{currentFileContent.split('\n').length} lines</span>
            <span>{currentFileContent.length} chars</span>
          </div>
        </div>
      )}
      
      {/* Code Content */}
      <div ref={codeRef} className="flex-1 overflow-hidden">
        {isStreaming && streamingFile === selectedFile ? (
          <CodeStreaming 
            code={currentFileContent}
            isStreaming={true}
            language={currentLanguage}
          />
        ) : (
          <ScrollArea className="h-full">
            <div className="p-0">
              <CodeView 
                code={currentFileContent || '// No file selected'} 
                lang={currentLanguage}
              />
            </div>
          </ScrollArea>
        )}
      </div>
    </div>
  )
} 