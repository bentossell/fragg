'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Progress } from '@/components/ui/progress'
import { 
  GitBranch, 
  GitCommit, 
  GitMerge, 
  Plus, 
  Settings, 
  GitCompare, 
  Tag, 
  Download,
  Upload,
  Trash2,
  Eye,
  Clock,
  User,
  MessageSquare,
  ChevronRight,
  ChevronDown,
  Circle,
  CheckCircle,
  XCircle,
  AlertCircle,
  Star,
  RotateCcw,
  Copy,
  Edit
} from 'lucide-react'
import { 
  EnhancedVersionSystem, 
  VersionTree, 
  AppVersion, 
  VersionBranch, 
  VersionComparison 
} from '@/lib/storage/enhanced-version-system'

interface VersionManagerProps {
  appId: string
  currentCode?: any
  onVersionSelect?: (version: AppVersion) => void
  onBranchSwitch?: (branchId: string) => void
  onVersionCreate?: (version: AppVersion) => void
  className?: string
}

export function VersionManager({
  appId,
  currentCode,
  onVersionSelect,
  onBranchSwitch,
  onVersionCreate,
  className
}: VersionManagerProps) {
  const [versionSystem] = useState(() => new EnhancedVersionSystem(appId))
  const [versionTree, setVersionTree] = useState<VersionTree | null>(null)
  const [selectedVersion, setSelectedVersion] = useState<string | null>(null)
  const [selectedBranch, setSelectedBranch] = useState<string>('main')
  const [expandedBranches, setExpandedBranches] = useState<Set<string>>(new Set(['main']))
  const [compareVersions, setCompareVersions] = useState<{ a: string | null, b: string | null }>({ a: null, b: null })
  const [showCreateBranch, setShowCreateBranch] = useState(false)
  const [showCreateVersion, setShowCreateVersion] = useState(false)
  const [showComparison, setShowComparison] = useState(false)
  const [comparison, setComparison] = useState<VersionComparison | null>(null)
  const [activeTab, setActiveTab] = useState<'timeline' | 'branches' | 'compare'>('timeline')

  // Load version tree on mount
  useEffect(() => {
    const tree = versionSystem.getVersionTree()
    if (tree) {
      setVersionTree(tree)
      setSelectedBranch(tree.currentBranch)
      setSelectedVersion(tree.currentVersion)
    } else if (currentCode) {
      // Initialize version system with current code
      const newTree = versionSystem.initializeVersionSystem(currentCode)
      setVersionTree(newTree)
      setSelectedBranch(newTree.currentBranch)
      setSelectedVersion(newTree.currentVersion)
    }
  }, [appId, currentCode, versionSystem])

  // Refresh version tree
  const refreshVersionTree = useCallback(() => {
    const tree = versionSystem.getVersionTree()
    if (tree) {
      setVersionTree(tree)
    }
  }, [versionSystem])

  // Handle version selection
  const handleVersionSelect = useCallback((versionId: string) => {
    setSelectedVersion(versionId)
    const version = versionSystem.getVersion(versionId)
    if (version && onVersionSelect) {
      onVersionSelect(version)
    }
  }, [versionSystem, onVersionSelect])

  // Handle branch switch
  const handleBranchSwitch = useCallback((branchId: string) => {
    versionSystem.switchBranch(branchId)
    setSelectedBranch(branchId)
    refreshVersionTree()
    if (onBranchSwitch) {
      onBranchSwitch(branchId)
    }
  }, [versionSystem, onBranchSwitch, refreshVersionTree])

  // Create new version
  const handleCreateVersion = useCallback((data: { message: string, description?: string }) => {
    if (!currentCode) return
    
    const newVersion = versionSystem.createVersion(
      currentCode,
      data.message,
      data.description,
      'user'
    )
    
    refreshVersionTree()
    setSelectedVersion(newVersion.id)
    setShowCreateVersion(false)
    
    if (onVersionCreate) {
      onVersionCreate(newVersion)
    }
  }, [currentCode, versionSystem, refreshVersionTree, onVersionCreate])

  // Create new branch
  const handleCreateBranch = useCallback((data: { name: string, description?: string }) => {
    const newBranch = versionSystem.createBranch(
      data.name,
      data.description,
      selectedVersion || undefined,
      'user'
    )
    
    refreshVersionTree()
    setShowCreateBranch(false)
    
    // Switch to new branch
    handleBranchSwitch(newBranch.id)
  }, [versionSystem, selectedVersion, refreshVersionTree, handleBranchSwitch])

  // Compare versions
  const handleCompareVersions = useCallback(() => {
    if (compareVersions.a && compareVersions.b) {
      const comp = versionSystem.compareVersions(compareVersions.a, compareVersions.b)
      setComparison(comp)
      setShowComparison(true)
    }
  }, [versionSystem, compareVersions])

  // Toggle branch expansion
  const toggleBranchExpansion = useCallback((branchId: string) => {
    setExpandedBranches(prev => {
      const newSet = new Set(prev)
      if (newSet.has(branchId)) {
        newSet.delete(branchId)
      } else {
        newSet.add(branchId)
      }
      return newSet
    })
  }, [])

  // Format timestamp
  const formatTimestamp = useCallback((timestamp: number) => {
    return new Date(timestamp).toLocaleString()
  }, [])

  // Get version status color
  const getVersionStatusColor = useCallback((version: AppVersion) => {
    if (version.metadata.tags?.includes('stable')) return 'bg-green-500'
    if (version.metadata.tags?.includes('beta')) return 'bg-yellow-500'
    if (version.metadata.tags?.includes('alpha')) return 'bg-red-500'
    return 'bg-blue-500'
  }, [])

  if (!versionTree) {
    return (
      <Card className={className}>
        <CardContent className="p-6">
          <div className="text-center text-muted-foreground">
            No version history available
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <GitBranch className="h-5 w-5" />
            Version Manager
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowCreateVersion(true)}
              className="h-8"
            >
              <Plus className="h-4 w-4 mr-1" />
              Version
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowCreateBranch(true)}
              className="h-8"
            >
              <GitBranch className="h-4 w-4 mr-1" />
              Branch
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as any)}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="timeline">Timeline</TabsTrigger>
            <TabsTrigger value="branches">Branches</TabsTrigger>
            <TabsTrigger value="compare">Compare</TabsTrigger>
          </TabsList>

          <TabsContent value="timeline" className="p-4">
            <ScrollArea className="h-[400px]">
              <div className="space-y-4">
                {versionTree.branches.map(branch => (
                  <div key={branch.id} className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleBranchExpansion(branch.id)}
                        className="h-6 w-6 p-0"
                      >
                        {expandedBranches.has(branch.id) ? 
                          <ChevronDown className="h-4 w-4" /> : 
                          <ChevronRight className="h-4 w-4" />
                        }
                      </Button>
                      <div 
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: branch.color }}
                      />
                      <span className="font-medium">{branch.name}</span>
                      {branch.isActive && (
                        <Badge variant="secondary" className="text-xs">Active</Badge>
                      )}
                    </div>

                    {expandedBranches.has(branch.id) && (
                      <div className="ml-8 space-y-2">
                        {versionTree.versions
                          .filter(v => v.branchId === branch.id)
                          .sort((a, b) => b.internalVersion - a.internalVersion)
                          .map(version => (
                            <div
                              key={version.id}
                              className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer hover:bg-muted/50 ${
                                selectedVersion === version.id ? 'bg-muted' : ''
                              }`}
                              onClick={() => handleVersionSelect(version.id)}
                            >
                              <div className="flex-shrink-0">
                                <div className={`w-2 h-2 rounded-full ${getVersionStatusColor(version)}`} />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="font-medium text-sm">{version.versionNumber}</span>
                                  {version.mergeInfo?.isMergeCommit && (
                                    <GitMerge className="h-3 w-3 text-muted-foreground" />
                                  )}
                                  {version.metadata.tags?.map(tag => (
                                    <Badge key={tag} variant="outline" className="text-xs">
                                      {tag}
                                    </Badge>
                                  ))}
                                </div>
                                <div className="text-xs text-muted-foreground truncate">
                                  {version.metadata.message}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  {formatTimestamp(version.metadata.timestamp)}
                                </div>
                              </div>
                              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                <span className="text-green-600">+{version.metadata.changes.additions}</span>
                                <span className="text-red-600">-{version.metadata.changes.deletions}</span>
                              </div>
                            </div>
                          ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="branches" className="p-4">
            <div className="space-y-3">
              {versionTree.branches.map(branch => (
                <Card key={branch.id} className="p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div 
                        className="w-4 h-4 rounded-full"
                        style={{ backgroundColor: branch.color }}
                      />
                      <div>
                        <div className="font-medium">{branch.name}</div>
                        {branch.description && (
                          <div className="text-sm text-muted-foreground">{branch.description}</div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {branch.isActive && (
                        <Badge variant="secondary">Active</Badge>
                      )}
                      {!branch.isActive && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleBranchSwitch(branch.id)}
                        >
                          Switch
                        </Button>
                      )}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="compare" className="p-4">
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Version A</Label>
                  <Select
                    value={compareVersions.a || ''}
                    onValueChange={(value) => setCompareVersions(prev => ({ ...prev, a: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select version A" />
                    </SelectTrigger>
                    <SelectContent>
                      {versionTree.versions.map(version => (
                        <SelectItem key={version.id} value={version.id}>
                          {version.versionNumber} - {version.metadata.message}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Version B</Label>
                  <Select
                    value={compareVersions.b || ''}
                    onValueChange={(value) => setCompareVersions(prev => ({ ...prev, b: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select version B" />
                    </SelectTrigger>
                    <SelectContent>
                      {versionTree.versions.map(version => (
                        <SelectItem key={version.id} value={version.id}>
                          {version.versionNumber} - {version.metadata.message}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <Button
                onClick={handleCompareVersions}
                disabled={!compareVersions.a || !compareVersions.b}
                className="w-full"
              >
                <GitCompare className="h-4 w-4 mr-2" />
                Compare Versions
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>

      {/* Create Version Dialog */}
      <Dialog open={showCreateVersion} onOpenChange={setShowCreateVersion}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Version</DialogTitle>
          </DialogHeader>
          <CreateVersionForm
            onSubmit={handleCreateVersion}
            onCancel={() => setShowCreateVersion(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Create Branch Dialog */}
      <Dialog open={showCreateBranch} onOpenChange={setShowCreateBranch}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Branch</DialogTitle>
          </DialogHeader>
          <CreateBranchForm
            onSubmit={handleCreateBranch}
            onCancel={() => setShowCreateBranch(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Version Comparison Dialog */}
      <Dialog open={showComparison} onOpenChange={setShowComparison}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Version Comparison</DialogTitle>
          </DialogHeader>
          {comparison && (
            <VersionComparisonView comparison={comparison} />
          )}
        </DialogContent>
      </Dialog>
    </Card>
  )
}

// Create Version Form Component
interface CreateVersionFormProps {
  onSubmit: (data: { message: string, description?: string }) => void
  onCancel: () => void
}

function CreateVersionForm({ onSubmit, onCancel }: CreateVersionFormProps) {
  const [message, setMessage] = useState('')
  const [description, setDescription] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (message.trim()) {
      onSubmit({ message: message.trim(), description: description.trim() || undefined })
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label htmlFor="message">Commit Message</Label>
        <Input
          id="message"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Describe your changes..."
          required
        />
      </div>
      <div>
        <Label htmlFor="description">Description (optional)</Label>
        <Textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Additional details about this version..."
          rows={3}
        />
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit">Create Version</Button>
      </div>
    </form>
  )
}

// Create Branch Form Component
interface CreateBranchFormProps {
  onSubmit: (data: { name: string, description?: string }) => void
  onCancel: () => void
}

function CreateBranchForm({ onSubmit, onCancel }: CreateBranchFormProps) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (name.trim()) {
      onSubmit({ name: name.trim(), description: description.trim() || undefined })
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label htmlFor="name">Branch Name</Label>
        <Input
          id="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="feature/new-feature"
          required
        />
      </div>
      <div>
        <Label htmlFor="description">Description (optional)</Label>
        <Textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What is this branch for?"
          rows={3}
        />
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit">Create Branch</Button>
      </div>
    </form>
  )
}

// Version Comparison View Component
interface VersionComparisonViewProps {
  comparison: VersionComparison
}

function VersionComparisonView({ comparison }: VersionComparisonViewProps) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <Card className="p-3">
          <div className="font-medium">Version A</div>
          <div className="text-sm text-muted-foreground">
            {comparison.versionA.versionNumber} - {comparison.versionA.metadata.message}
          </div>
        </Card>
        <Card className="p-3">
          <div className="font-medium">Version B</div>
          <div className="text-sm text-muted-foreground">
            {comparison.versionB.versionNumber} - {comparison.versionB.metadata.message}
          </div>
        </Card>
      </div>
      
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
      </div>
      
      <Card className="p-3">
        <div className="font-medium mb-2">Diff</div>
        <ScrollArea className="h-[300px]">
          <pre className="text-xs font-mono whitespace-pre-wrap">
            {comparison.diff.unified}
          </pre>
        </ScrollArea>
      </Card>
    </div>
  )
} 